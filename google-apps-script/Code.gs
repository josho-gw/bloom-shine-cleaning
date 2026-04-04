/**
 * ============================================================
 * Bloom & Shine Cleaning Services — API Backend
 * ============================================================
 *
 * Three separate workbooks (IDs in Script Properties):
 *   CRM_SPREADSHEET_ID        — business data
 *   ADMIN_SPREADSHEET_ID      — auth, sessions, settings, audit
 *   FINANCIALS_SPREADSHEET_ID — ledger, categories
 *
 * PUBLIC endpoints: contact, estimate, contract
 * AUTH endpoints: login, forgot, resetPassword
 * PROTECTED endpoints: CRUD, users, finance
 * ============================================================
 */

// ============================================
// WORKBOOK ACCESS
// ============================================

function crm_()  { return SpreadsheetApp.openById(getProp_('CRM_SPREADSHEET_ID')); }
function admin_() { return SpreadsheetApp.openById(getProp_('ADMIN_SPREADSHEET_ID')); }
function fin_()   { return SpreadsheetApp.openById(getProp_('FINANCIALS_SPREADSHEET_ID')); }

// ============================================
// REQUEST ROUTING
// ============================================

function doGet(e) {
  try {
    var action = p_(e, 'action', 'ping');
    if (action === 'ping') return j_({ result: 'pong' });

    var session = validateSession_(p_(e, 'token'));
    if (!session) return j_({ result: 'error', code: 'UNAUTHORIZED', message: 'Invalid or expired session' });

    switch (action) {
      case 'getAll':        return j_(getAllData_(session));
      case 'getContacts':   return j_({ result: 'success', data: rows_(crm_(), 'Contacts') });
      case 'getEstimates':  return j_({ result: 'success', data: rows_(crm_(), 'Estimates') });
      case 'getContracts':  return j_({ result: 'success', data: rows_(crm_(), 'Contracts') });
      case 'getInvoices':   return j_({ result: 'success', data: rows_(crm_(), 'Invoices') });
      case 'getActivity':   return j_({ result: 'success', data: rows_(crm_(), 'Activity Log') });
      case 'getUsers':      return j_(getUsers_(session));
      case 'getSettings':   return j_(getSettings_(session));
      case 'getLedger':     return j_(getLedger_(session));
      case 'getCategories': return j_(getCategories_(session));
      case 'getFinSummary': return j_(getFinSummary_(session));
      default:              return j_({ result: 'error', message: 'Unknown action' });
    }
  } catch (err) { return j_({ result: 'error', message: err.toString() }); }
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var action = data.action || data.source || 'contact';

    // Public
    if (action === 'contact')  return j_(handleContact_(data));
    if (action === 'estimate') return j_(handleEstimate_(data));
    if (action === 'contract') return j_(handleContract_(data));

    // Auth (no session)
    if (action === 'login')         return j_(handleLogin_(data));
    if (action === 'forgot')        return j_(handleForgotPassword_(data));
    if (action === 'resetPassword') return j_(handleResetPassword_(data));

    // Protected
    var session = validateSession_(data.token);
    if (!session) return j_({ result: 'error', code: 'UNAUTHORIZED', message: 'Invalid or expired session' });

    switch (action) {
      case 'logout':          return j_(handleLogout_(data, session));
      case 'changePassword':  return j_(handleChangePassword_(data, session));
      case 'updateRow':       return j_(handleUpdateRow_(data, session));
      case 'deleteRow':       return j_(handleDeleteRow_(data, session));
      case 'addInvoice':      return j_(handleAddInvoice_(data, session));
      case 'addUser':         return j_(handleAddUser_(data, session));
      case 'removeUser':      return j_(handleRemoveUser_(data, session));
      case 'resetUserPw':     return j_(handleResetUserPw_(data, session));
      case 'addLedgerEntry':  return j_(handleAddLedgerEntry_(data, session));
      case 'addCategory':     return j_(handleAddCategory_(data, session));
      default:                return j_({ result: 'error', message: 'Unknown action' });
    }
  } catch (err) { return j_({ result: 'error', message: err.toString() }); }
}

// ============================================
// AUTH
// ============================================

function handleLogin_(data) {
  var email = (data.email || '').trim().toLowerCase();
  var pw = data.password || '';
  if (!email || !pw) return { result: 'error', message: 'Email and password required' };

  var ss = admin_();
  var sheet = ss.getSheetByName('_Users');
  if (!sheet || sheet.getLastRow() <= 1) return { result: 'error', message: 'Invalid credentials' };

  var users = sheet.getDataRange().getValues();
  var hash = hashPw_(pw, getProp_('ENCRYPTION_SALT'));

  for (var i = 1; i < users.length; i++) {
    if (users[i][0].toLowerCase() === email && users[i][7] === 'active' && users[i][3] === hash) {
      var token = genToken_();
      var hours = parseInt(getSetting_('session_duration_hours') || '4');
      var expires = new Date(Date.now() + hours * 3600000);

      var sess = ss.getSheetByName('_Sessions');
      if (sess) sess.appendRow([token, email, users[i][2], new Date(), expires, '']);

      audit_('Login', email);
      return {
        result: 'success', token: token,
        user: { email: users[i][0], name: users[i][1], role: users[i][2], mustChangePassword: users[i][4] === 'Yes' }
      };
    }
  }
  audit_('Login failed', email);
  return { result: 'error', message: 'Invalid credentials' };
}

function handleLogout_(data, session) {
  var ss = admin_();
  var sheet = ss.getSheetByName('_Sessions');
  if (sheet) {
    var rows = sheet.getDataRange().getValues();
    for (var i = rows.length - 1; i >= 1; i--) {
      if (rows[i][0] === data.token) { sheet.deleteRow(i + 1); break; }
    }
  }
  audit_('Logout', session.email);
  return { result: 'success' };
}

function handleChangePassword_(data, session) {
  var newPw = data.newPassword || '';
  if (!newPw || newPw.length < 6) return { result: 'error', message: 'Password must be at least 6 characters' };

  var ss = admin_();
  var sheet = ss.getSheetByName('_Users');
  var users = sheet.getDataRange().getValues();
  var salt = getProp_('ENCRYPTION_SALT');

  for (var i = 1; i < users.length; i++) {
    if (users[i][0].toLowerCase() === session.email) {
      if (users[i][4] !== 'Yes' && hashPw_(data.currentPassword || '', salt) !== users[i][3]) {
        return { result: 'error', message: 'Current password is incorrect' };
      }
      sheet.getRange(i + 1, 4).setValue(hashPw_(newPw, salt));
      sheet.getRange(i + 1, 5).setValue('No');
      audit_('Password changed', session.email);
      return { result: 'success' };
    }
  }
  return { result: 'error', message: 'User not found' };
}

function handleForgotPassword_(data) {
  var email = (data.email || '').trim().toLowerCase();
  if (!email) return { result: 'success' };

  var ss = admin_();
  var sheet = ss.getSheetByName('_Users');
  if (!sheet) return { result: 'success' };
  var users = sheet.getDataRange().getValues();

  for (var i = 1; i < users.length; i++) {
    if (users[i][0].toLowerCase() === email && users[i][7] === 'active') {
      var code = genResetCode_();
      var expiry = parseInt(getSetting_('reset_code_expiry_minutes') || '30');
      PropertiesService.getScriptProperties().setProperty('RESET_' + email, JSON.stringify({
        code: hashPw_(code, getProp_('ENCRYPTION_SALT')), expiry: Date.now() + expiry * 60000, attempts: 0
      }));
      try {
        MailApp.sendEmail(email, '🔐 Bloom & Shine — Password Reset',
          'Hi ' + users[i][1] + ',\n\nYour reset code: ' + code + '\nExpires in ' + expiry + ' min.\n\n— Bloom & Shine');
      } catch(e) {}
      audit_('Password reset requested', email);
      break;
    }
  }
  return { result: 'success' };
}

function handleResetPassword_(data) {
  var email = (data.email || '').trim().toLowerCase();
  var code = (data.code || '').trim().toUpperCase();
  var newPw = data.newPassword || '';
  if (!email || !code || !newPw || newPw.length < 6) return { result: 'error', message: 'All fields required, password min 6 chars' };

  var props = PropertiesService.getScriptProperties();
  var raw = props.getProperty('RESET_' + email);
  if (!raw) return { result: 'error', message: 'No reset request found' };

  var reset = JSON.parse(raw);
  if (Date.now() > reset.expiry) { props.deleteProperty('RESET_' + email); return { result: 'error', message: 'Code expired' }; }
  reset.attempts = (reset.attempts || 0) + 1;
  if (reset.attempts > 5) { props.deleteProperty('RESET_' + email); return { result: 'error', message: 'Too many attempts' }; }

  var salt = getProp_('ENCRYPTION_SALT');
  if (hashPw_(code, salt) !== reset.code) {
    props.setProperty('RESET_' + email, JSON.stringify(reset));
    return { result: 'error', message: 'Invalid code. ' + (5 - reset.attempts) + ' left.' };
  }

  var ss = admin_();
  var sheet = ss.getSheetByName('_Users');
  var users = sheet.getDataRange().getValues();
  for (var i = 1; i < users.length; i++) {
    if (users[i][0].toLowerCase() === email) {
      sheet.getRange(i + 1, 4).setValue(hashPw_(newPw, salt));
      sheet.getRange(i + 1, 5).setValue('No');
      break;
    }
  }
  props.deleteProperty('RESET_' + email);
  audit_('Password reset completed', email);
  return { result: 'success' };
}

function validateSession_(token) {
  if (!token) return null;
  var sheet = admin_().getSheetByName('_Sessions');
  if (!sheet || sheet.getLastRow() <= 1) return null;
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0] === token && new Date(rows[i][4]) > new Date())
      return { email: rows[i][1], role: rows[i][2] };
  }
  return null;
}

function cleanExpiredSessions() {
  var sheet = admin_().getSheetByName('_Sessions');
  if (!sheet || sheet.getLastRow() <= 1) return;
  var rows = sheet.getDataRange().getValues();
  var now = new Date();
  for (var i = rows.length - 1; i >= 1; i--) {
    if (new Date(rows[i][4]) <= now) sheet.deleteRow(i + 1);
  }
}

// ============================================
// DATA READ
// ============================================

function getAllData_(session) {
  var ss = crm_();
  return {
    result: 'success',
    contacts: rows_(ss, 'Contacts'),
    estimates: rows_(ss, 'Estimates'),
    contracts: rows_(ss, 'Contracts'),
    invoices: rows_(ss, 'Invoices')
  };
}

function rows_(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet || sheet.getLastRow() <= 1) return [];
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  return data.map(function(row, idx) {
    var obj = { _row: idx + 2 };
    headers.forEach(function(h, c) { obj[h] = row[c]; });
    return obj;
  });
}

function getUsers_(session) {
  if (session.role !== 'developer' && session.role !== 'owner') return { result: 'error', message: 'Insufficient permissions' };
  var sheet = admin_().getSheetByName('_Users');
  if (!sheet || sheet.getLastRow() <= 1) return { result: 'success', users: [] };
  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  return {
    result: 'success',
    users: data.map(function(r, i) {
      return { _row: i + 2, email: r[0], name: r[1], role: r[2], mustChangePassword: r[4], protected: r[5], created: r[6], status: r[7] };
    })
  };
}

function getSettings_(session) {
  if (session.role !== 'developer' && session.role !== 'owner') return { result: 'error', message: 'Insufficient permissions' };
  var sheet = admin_().getSheetByName('_Settings');
  if (!sheet || sheet.getLastRow() <= 1) return { result: 'success', settings: {} };
  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
  var s = {}; data.forEach(function(r) { s[r[0]] = r[1]; });
  return { result: 'success', settings: s };
}

// ============================================
// FINANCIALS READ
// ============================================

function getLedger_(session) {
  if (session.role !== 'developer' && session.role !== 'owner') return { result: 'error', message: 'Insufficient permissions' };
  return { result: 'success', data: rows_(fin_(), 'Ledger') };
}

function getCategories_(session) {
  if (session.role !== 'developer' && session.role !== 'owner') return { result: 'error', message: 'Insufficient permissions' };
  return { result: 'success', data: rows_(fin_(), 'Categories') };
}

function getFinSummary_(session) {
  if (session.role !== 'developer' && session.role !== 'owner') return { result: 'error', message: 'Insufficient permissions' };
  var ss = fin_();
  var ledgerData = rows_(ss, 'Ledger');

  var now = new Date();
  var thisMonth = now.getMonth();
  var thisYear = now.getFullYear();

  var ytdIncome = 0, ytdExpense = 0, mtdIncome = 0, mtdExpense = 0;
  var expenseByCategory = {};

  ledgerData.forEach(function(r) {
    var date = new Date(r.Date);
    var yr = date.getFullYear();
    if (yr === thisYear) {
      if (r.Type === 'Income') { ytdIncome += Number(r.Credit) || 0; }
      if (r.Type === 'Expense') { ytdExpense += Number(r.Debit) || 0; }
      if (date.getMonth() === thisMonth) {
        if (r.Type === 'Income') mtdIncome += Number(r.Credit) || 0;
        if (r.Type === 'Expense') mtdExpense += Number(r.Debit) || 0;
      }
      if (r.Type === 'Expense' && r.Category) {
        expenseByCategory[r.Category] = (expenseByCategory[r.Category] || 0) + (Number(r.Debit) || 0);
      }
    }
  });

  return {
    result: 'success',
    ytd: { income: ytdIncome, expense: ytdExpense, net: ytdIncome - ytdExpense },
    mtd: { income: mtdIncome, expense: mtdExpense, net: mtdIncome - mtdExpense },
    expenseByCategory: expenseByCategory,
    totalEntries: ledgerData.length
  };
}

// ============================================
// FINANCIALS WRITE
// ============================================

function handleAddLedgerEntry_(data, session) {
  if (session.role !== 'developer' && session.role !== 'owner') return { result: 'error', message: 'Insufficient permissions' };

  var ss = fin_();
  var sheet = ss.getSheetByName('Ledger');
  if (!sheet) return { result: 'error', message: 'Ledger not found' };

  var type = data.type || 'Expense';
  var debit = type === 'Expense' ? (Number(data.amount) || 0) : 0;
  var credit = type === 'Income' ? (Number(data.amount) || 0) : 0;

  // Calculate running balance
  var lastRow = sheet.getLastRow();
  var prevBalance = 0;
  if (lastRow > 1) {
    prevBalance = Number(sheet.getRange(lastRow, 8).getValue()) || 0;
  }
  var balance = prevBalance + credit - debit;

  sheet.appendRow([
    data.date ? new Date(data.date) : new Date(),
    type,
    data.category || '',
    data.description || '',
    data.reference || '',
    debit,
    credit,
    balance,
    data.paymentMethod || '',
    session.email,
    data.notes || ''
  ]);

  activityCRM_('Finance', type + ': ' + (data.category || ''), '$' + (data.amount || 0));
  audit_('Ledger entry: ' + type + ' $' + (data.amount || 0), session.email);
  return { result: 'success' };
}

function handleAddCategory_(data, session) {
  if (session.role !== 'developer' && session.role !== 'owner') return { result: 'error', message: 'Insufficient permissions' };
  var sheet = fin_().getSheetByName('Categories');
  if (!sheet) return { result: 'error', message: 'Categories not found' };
  sheet.appendRow([data.name || '', data.type || 'Expense', data.description || '', 'Yes']);
  audit_('Category added: ' + (data.name || ''), session.email);
  return { result: 'success' };
}

/**
 * Auto-create ledger entry when invoice is marked Paid.
 * Called from handleUpdateRow_ when updating Invoices.Status to Paid.
 */
function autoLedgerFromInvoice_(invoiceRow) {
  var sheet = fin_().getSheetByName('Ledger');
  if (!sheet) return;

  var amount = Number(invoiceRow.Amount) || 0;
  var lastRow = sheet.getLastRow();
  var prevBalance = lastRow > 1 ? (Number(sheet.getRange(lastRow, 8).getValue()) || 0) : 0;

  sheet.appendRow([
    new Date(),
    'Income',
    'Cleaning Income',
    'Invoice ' + (invoiceRow['Invoice #'] || '') + ' — ' + (invoiceRow['Client Name'] || ''),
    invoiceRow['Invoice #'] || '',
    0,            // Debit
    amount,       // Credit
    prevBalance + amount,
    invoiceRow['Payment Method'] || '',
    'system',
    'Auto-created from invoice payment'
  ]);
}

// ============================================
// CRM WRITE
// ============================================

function handleUpdateRow_(data, session) {
  var sheetName = data.sheet;
  var rowNum = data.row;
  var updates = data.updates;
  if (!sheetName || !rowNum || !updates) return { result: 'error', message: 'Missing required fields' };

  // Determine workbook
  var ss;
  if (sheetName.charAt(0) === '_') {
    if (session.role !== 'developer') return { result: 'error', message: 'Cannot modify admin data' };
    ss = admin_();
  } else {
    ss = crm_();
  }

  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { result: 'error', message: 'Sheet not found' };

  // Capture pre-update state for invoice payment detection
  var wasNotPaid = false;
  var invoiceRow = null;
  if (sheetName === 'Invoices' && updates.Status === 'Paid') {
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var currentValues = sheet.getRange(rowNum, 1, 1, sheet.getLastColumn()).getValues()[0];
    invoiceRow = {};
    headers.forEach(function(h, c) { invoiceRow[h] = currentValues[c]; });
    wasNotPaid = invoiceRow.Status !== 'Paid';
  }

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  for (var col in updates) {
    var idx = headers.indexOf(col);
    if (idx >= 0) sheet.getRange(rowNum, idx + 1).setValue(updates[col]);
  }

  // Auto-ledger on invoice payment
  if (sheetName === 'Invoices' && updates.Status === 'Paid' && wasNotPaid && invoiceRow) {
    // Merge updates into the row data
    for (var k in updates) invoiceRow[k] = updates[k];
    autoLedgerFromInvoice_(invoiceRow);
  }

  activityCRM_('Update', sheetName + ' row ' + rowNum, JSON.stringify(updates).substring(0, 200));
  audit_(sheetName + ' updated: row ' + rowNum, session.email);
  return { result: 'success' };
}

function handleDeleteRow_(data, session) {
  var sheetName = data.sheet;
  var rowNum = data.row;
  if (!sheetName || !rowNum) return { result: 'error', message: 'Missing fields' };
  if (sheetName === 'Invoices') return { result: 'error', message: 'Invoices cannot be deleted. Use Void status instead.' };
  if (sheetName.charAt(0) === '_') return { result: 'error', message: 'Cannot delete admin data' };

  var ss = crm_();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { result: 'error', message: 'Sheet not found' };

  sheet.deleteRow(rowNum);
  activityCRM_('Delete', sheetName + ' row ' + rowNum, '');
  audit_(sheetName + ' deleted: row ' + rowNum, session.email);
  return { result: 'success' };
}

function handleAddInvoice_(data, session) {
  var sheet = crm_().getSheetByName('Invoices');
  if (!sheet) return { result: 'error', message: 'Invoices not found' };
  sheet.appendRow([data.invoiceNumber || '', new Date(), data.clientName || '', data.clientEmail || '',
    data.service || '', data.amount || 0, data.paymentMethod || '', 'Draft', '', data.notes || '']);
  activityCRM_('Invoice', data.clientName || '', (data.invoiceNumber || '') + ' $' + (data.amount || 0));
  audit_('Invoice created: ' + (data.invoiceNumber || ''), session.email);
  return { result: 'success' };
}

// ============================================
// USER MANAGEMENT
// ============================================

function handleAddUser_(data, session) {
  if (session.role !== 'developer' && session.role !== 'owner') return { result: 'error', message: 'Insufficient permissions' };
  var email = (data.email || '').trim().toLowerCase();
  var name = (data.name || '').trim();
  var role = data.role || 'staff';
  if (!email || !name) return { result: 'error', message: 'Email and name required' };
  if (role === 'developer' && session.role !== 'developer') return { result: 'error', message: 'Only developers can create developer accounts' };

  var sheet = admin_().getSheetByName('_Users');
  var existing = sheet.getDataRange().getValues();
  for (var i = 1; i < existing.length; i++) { if (existing[i][0].toLowerCase() === email) return { result: 'error', message: 'User exists' }; }

  var tempPw = data.tempPassword || genResetCode_() + genResetCode_();
  sheet.appendRow([email, name, role, hashPw_(tempPw, getProp_('ENCRYPTION_SALT')), 'Yes', 'false', new Date().toISOString(), 'active']);
  audit_('User added: ' + email + ' (' + role + ')', session.email);
  return { result: 'success', tempPassword: tempPw };
}

function handleRemoveUser_(data, session) {
  if (session.role !== 'developer' && session.role !== 'owner') return { result: 'error', message: 'Insufficient permissions' };
  var email = (data.email || '').trim().toLowerCase();
  if (!email) return { result: 'error', message: 'Email required' };
  if (email === session.email) return { result: 'error', message: 'Cannot remove yourself' };

  var sheet = admin_().getSheetByName('_Users');
  var users = sheet.getDataRange().getValues();
  for (var i = 1; i < users.length; i++) {
    if (users[i][0].toLowerCase() === email) {
      if (users[i][5] === 'true' && session.role !== 'developer') return { result: 'error', message: 'Protected account' };
      sheet.deleteRow(i + 1);
      audit_('User removed: ' + email, session.email);
      return { result: 'success' };
    }
  }
  return { result: 'error', message: 'User not found' };
}

function handleResetUserPw_(data, session) {
  if (session.role !== 'developer' && session.role !== 'owner') return { result: 'error', message: 'Insufficient permissions' };
  var email = (data.email || '').trim().toLowerCase();
  if (!email) return { result: 'error', message: 'Email required' };

  var sheet = admin_().getSheetByName('_Users');
  var users = sheet.getDataRange().getValues();
  for (var i = 1; i < users.length; i++) {
    if (users[i][0].toLowerCase() === email) {
      if (users[i][5] === 'true' && session.role !== 'developer') return { result: 'error', message: 'Protected account' };
      var tempPw = genResetCode_() + genResetCode_();
      sheet.getRange(i + 1, 4).setValue(hashPw_(tempPw, getProp_('ENCRYPTION_SALT')));
      sheet.getRange(i + 1, 5).setValue('Yes');
      audit_('Password reset: ' + email, session.email);
      return { result: 'success', tempPassword: tempPw };
    }
  }
  return { result: 'error', message: 'User not found' };
}

// ============================================
// PUBLIC FORM HANDLERS
// ============================================

function handleContact_(data) {
  var ss = crm_();
  ss.getSheetByName('Contacts').appendRow([new Date(), data.name||'', data.email||'', data.phone||'', data.service||'', data.message||'', 'New', '', '']);
  activityCRM_('Contact', data.name || '', data.service || 'General');
  notify_('🌸 New Contact — ' + (data.name||''), 'Name: '+(data.name||'—')+'\nEmail: '+(data.email||'—')+'\nPhone: '+(data.phone||'—')+'\nService: '+(data.service||'—')+'\nMessage: '+(data.message||'—')+'\n\n📋 '+ss.getUrl());
  return { result: 'success' };
}

function handleEstimate_(data) {
  crm_().getSheetByName('Estimates').appendRow([new Date(), data.service||'', data.sqft||'', data.frequency||'', data.addons||'', data.estimateLow||'', data.estimateHigh||'', false]);
  activityCRM_('Estimate', data.service||'', '$'+(data.estimateLow||0)+'–$'+(data.estimateHigh||0));
  return { result: 'success' };
}

function handleContract_(data) {
  var ss = crm_();
  ss.getSheetByName('Contracts').appendRow([new Date(), data.name||'', data.email||'', data.phone||'', data.address||'', data.service||'', data.frequency||'', data.mediaRelease||'no', data.signed?'Yes':'No', data.signedDate||'', 'New', '']);
  activityCRM_('Contract', data.name||'', (data.service||'')+' ('+( data.frequency||'')+')');
  notify_('🌸 Agreement Signed — '+(data.name||''), 'Client: '+(data.name||'—')+'\nService: '+(data.service||'—')+'\nFrequency: '+(data.frequency||'—')+'\n\n📋 '+ss.getUrl());
  return { result: 'success' };
}

// ============================================
// EMAIL DIGESTS
// ============================================

function sendDailyDigest() {
  var ss = crm_();
  var today = new Date(); today.setHours(0,0,0,0);
  var yesterday = new Date(today); yesterday.setDate(yesterday.getDate()-1);

  var c = countSince_(ss,'Contacts',yesterday), e = countSince_(ss,'Estimates',yesterday), a = countSince_(ss,'Contracts',yesterday);
  var fups = getFollowUps_(ss), leads = getNewLeads_(ss);
  if (c===0 && e===0 && a===0 && fups.length===0 && leads.length===0) return;

  var tz = getProp_('TIMEZONE') || 'America/New_York';
  var body = 'Good morning!\n\n';
  if (c+e+a > 0) { body += '📊 YESTERDAY\n'; if(c)body+='  • '+c+' contact(s)\n'; if(e)body+='  • '+e+' estimate(s)\n'; if(a)body+='  • '+a+' contract(s)\n'; body+='\n'; }
  if (fups.length) { body += '📞 FOLLOW-UPS TODAY\n'; fups.forEach(function(f){body+='  • '+f.name+' — '+f.phone+'\n';}); body+='\n'; }
  if (leads.length) { body += '🆕 UNCONTACTED ('+leads.length+')\n'; leads.slice(0,5).forEach(function(l){body+='  • '+l.name+' — '+l.phone+'\n';}); body+='\n'; }
  body += '📋 '+ss.getUrl()+'\nHave a blessed day! 🌸';
  notify_('🌸 Daily Summary — '+Utilities.formatDate(today,tz,'MMM d'), body);
}

function sendWeeklySummary() {
  var ss = crm_();
  var today = new Date(), weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate()-7);
  var tz = getProp_('TIMEZONE') || 'America/New_York';

  var c = countSince_(ss,'Contacts',weekAgo), e = countSince_(ss,'Estimates',weekAgo), a = countSince_(ss,'Contracts',weekAgo);
  var rev = 0;
  var inv = ss.getSheetByName('Invoices');
  if (inv && inv.getLastRow()>1) inv.getRange(2,1,inv.getLastRow()-1,9).getValues().forEach(function(r){if(r[8]&&new Date(r[8])>=weekAgo&&r[7]==='Paid')rev+=Number(r[5])||0;});

  notify_('🌸 Weekly — '+Utilities.formatDate(weekAgo,tz,'MMM d')+'–'+Utilities.formatDate(today,tz,'MMM d'),
    '📊 THIS WEEK\n  • '+c+' contacts\n  • '+e+' estimates\n  • '+a+' contracts\n  • $'+rev.toFixed(2)+' revenue\n\n📋 '+ss.getUrl()+'\n\n"Whatever you do, work at it with all your heart." — Col 3:23 🌸');
}

// ============================================
// HELPERS
// ============================================

function j_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function p_(e,k,f) { return (e&&e.parameter&&e.parameter[k])||f||''; }
function getProp_(k) { return PropertiesService.getScriptProperties().getProperty(k)||''; }
function getSetting_(k) { var s=admin_().getSheetByName('_Settings'); if(!s||s.getLastRow()<=1)return null; var d=s.getDataRange().getValues(); for(var i=1;i<d.length;i++){if(d[i][0]===k)return d[i][1];} return null; }
function hashPw_(pw,salt) { var d=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,salt+':'+pw); return d.map(function(b){return('0'+((b+256)%256).toString(16)).slice(-2);}).join(''); }
function genToken_() { var b=[]; for(var i=0;i<32;i++)b.push(Math.floor(Math.random()*256)); return Utilities.base64EncodeWebSafe(b); }
function genResetCode_() { var c='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',s=''; for(var i=0;i<6;i++)s+=c.charAt(Math.floor(Math.random()*c.length)); return s; }
function notify_(subject,body) { var e=getProp_('NOTIFICATION_EMAIL'); if(e)MailApp.sendEmail(e,subject,body); }
function activityCRM_(type,summary,details) { try{crm_().getSheetByName('Activity Log').appendRow([new Date(),type,summary,details]);}catch(e){} }
function audit_(event,actor) { try{admin_().getSheetByName('_Audit').appendRow([new Date(),event,'',actor||Session.getEffectiveUser().getEmail()]);}catch(e){} }
function countSince_(ss,tab,since) { var s=ss.getSheetByName(tab); if(!s||s.getLastRow()<=1)return 0; var t=s.getRange(2,1,s.getLastRow()-1,1).getValues(),c=0; t.forEach(function(r){if(r[0]&&new Date(r[0])>=since)c++;}); return c; }
function getFollowUps_(ss) { var s=ss.getSheetByName('Contacts'); if(!s||s.getLastRow()<=1)return[]; var d=s.getRange(2,1,s.getLastRow()-1,9).getValues(),t=new Date();t.setHours(0,0,0,0);var n=new Date(t);n.setDate(n.getDate()+1);var r=[]; d.forEach(function(v){if(v[8]&&new Date(v[8])>=t&&new Date(v[8])<n&&v[6]!=='Completed'&&v[6]!=='Lost')r.push({name:v[1],phone:v[3]});}); return r; }
function getNewLeads_(ss) { var s=ss.getSheetByName('Contacts'); if(!s||s.getLastRow()<=1)return[]; var d=s.getRange(2,1,s.getLastRow()-1,7).getValues(),r=[]; d.forEach(function(v){if(v[6]==='New')r.push({name:v[1],phone:v[3]});}); return r; }
