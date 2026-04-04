/**
 * ============================================================
 * Bloom & Shine Cleaning Services — CRM Backend API
 * ============================================================
 *
 * All configuration lives in Script Properties (set by Setup.gs).
 * All auth data lives in protected _Users/_Sessions sheets.
 * All business data lives in CRM sheets.
 *
 * PUBLIC endpoints (no auth): contact, estimate, contract submissions
 * PROTECTED endpoints (session token required): CRUD, user management
 * ============================================================
 */

// ============================================
// REQUEST ROUTING
// ============================================

function doGet(e) {
  try {
    var action = param_(e, 'action', 'ping');

    // Public: health check
    if (action === 'ping') return json_({ result: 'pong' });

    // Everything else requires auth
    var session = validateSession_(param_(e, 'token'));
    if (!session) return json_({ result: 'error', code: 'UNAUTHORIZED', message: 'Invalid or expired session' });

    switch (action) {
      case 'getAll':       return json_(getAllData_(session));
      case 'getContacts':  return json_(getSheetRows_('Contacts'));
      case 'getEstimates': return json_(getSheetRows_('Estimates'));
      case 'getContracts': return json_(getSheetRows_('Contracts'));
      case 'getInvoices':  return json_(getSheetRows_('Invoices'));
      case 'getActivity':  return json_(getSheetRows_('Activity Log'));
      case 'getUsers':     return json_(getUsers_(session));
      case 'getSettings':  return json_(getSettings_(session));
      default:             return json_({ result: 'error', message: 'Unknown action' });
    }
  } catch (err) {
    return json_({ result: 'error', message: err.toString() });
  }
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var action = data.action || data.source || 'contact';

    // --- PUBLIC ENDPOINTS (website form submissions) ---
    if (action === 'contact')  return json_(handleContact_(data));
    if (action === 'estimate') return json_(handleEstimate_(data));
    if (action === 'contract') return json_(handleContract_(data));

    // --- AUTH ENDPOINTS (no session needed) ---
    if (action === 'login')          return json_(handleLogin_(data));
    if (action === 'forgot')         return json_(handleForgotPassword_(data));
    if (action === 'resetPassword')  return json_(handleResetPassword_(data));

    // --- PROTECTED ENDPOINTS (session required) ---
    var session = validateSession_(data.token);
    if (!session) return json_({ result: 'error', code: 'UNAUTHORIZED', message: 'Invalid or expired session' });

    switch (action) {
      case 'logout':           return json_(handleLogout_(data, session));
      case 'changePassword':   return json_(handleChangePassword_(data, session));

      // CRUD operations
      case 'updateRow':        return json_(handleUpdateRow_(data, session));
      case 'deleteRow':        return json_(handleDeleteRow_(data, session));
      case 'addInvoice':       return json_(handleAddInvoice_(data, session));

      // User management (owner + developer only)
      case 'addUser':          return json_(handleAddUser_(data, session));
      case 'removeUser':       return json_(handleRemoveUser_(data, session));
      case 'resetUserPw':      return json_(handleResetUserPassword_(data, session));
      case 'updateSettings':   return json_(handleUpdateSettings_(data, session));

      // Password reset email (via Apps Script)
      case 'password_reset':   sendPasswordResetEmail_(data); return json_({ result: 'success' });

      default: return json_({ result: 'error', message: 'Unknown action' });
    }
  } catch (err) {
    return json_({ result: 'error', message: err.toString() });
  }
}

// ============================================
// AUTHENTICATION
// ============================================

function handleLogin_(data) {
  var email = (data.email || '').trim().toLowerCase();
  var password = data.password || '';
  if (!email || !password) return { result: 'error', message: 'Email and password required' };

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var usersSheet = ss.getSheetByName('_Users');
  if (!usersSheet || usersSheet.getLastRow() <= 1) return { result: 'error', message: 'Invalid credentials' };

  var users = usersSheet.getDataRange().getValues();
  var salt = getProp_('ENCRYPTION_SALT');
  var hash = hashPw_(password, salt);

  for (var i = 1; i < users.length; i++) {
    if (users[i][0].toLowerCase() === email && users[i][7] === 'active') {
      if (users[i][3] === hash) {
        // Create session
        var token = generateToken_();
        var durationHours = parseInt(getSetting_(ss, 'session_duration_hours') || '4');
        var expires = new Date(Date.now() + durationHours * 3600000);

        var sessionsSheet = ss.getSheetByName('_Sessions');
        if (sessionsSheet) {
          sessionsSheet.appendRow([token, email, users[i][2], new Date(), expires, '']);
        }

        logAudit_('Login', email);

        return {
          result: 'success',
          token: token,
          user: {
            email: users[i][0],
            name: users[i][1],
            role: users[i][2],
            mustChangePassword: users[i][4] === 'Yes'
          }
        };
      }
      break;
    }
  }

  logAudit_('Login failed', email);
  return { result: 'error', message: 'Invalid credentials' };
}

function handleLogout_(data, session) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sessionsSheet = ss.getSheetByName('_Sessions');
  if (sessionsSheet) {
    var rows = sessionsSheet.getDataRange().getValues();
    for (var i = rows.length - 1; i >= 1; i--) {
      if (rows[i][0] === data.token) {
        sessionsSheet.deleteRow(i + 1);
        break;
      }
    }
  }
  logAudit_('Logout', session.email);
  return { result: 'success' };
}

function handleChangePassword_(data, session) {
  var currentPw = data.currentPassword || '';
  var newPw = data.newPassword || '';
  if (!newPw || newPw.length < 6) return { result: 'error', message: 'Password must be at least 6 characters' };

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var usersSheet = ss.getSheetByName('_Users');
  var users = usersSheet.getDataRange().getValues();
  var salt = getProp_('ENCRYPTION_SALT');

  for (var i = 1; i < users.length; i++) {
    if (users[i][0].toLowerCase() === session.email) {
      // If not forcing change, verify current password
      if (users[i][4] !== 'Yes') {
        if (hashPw_(currentPw, salt) !== users[i][3]) {
          return { result: 'error', message: 'Current password is incorrect' };
        }
      }
      usersSheet.getRange(i + 1, 4).setValue(hashPw_(newPw, salt));
      usersSheet.getRange(i + 1, 5).setValue('No');
      logAudit_('Password changed', session.email);
      return { result: 'success' };
    }
  }
  return { result: 'error', message: 'User not found' };
}

function handleForgotPassword_(data) {
  var email = (data.email || '').trim().toLowerCase();
  if (!email) return { result: 'success' }; // Don't reveal whether email exists

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var usersSheet = ss.getSheetByName('_Users');
  if (!usersSheet) return { result: 'success' };

  var users = usersSheet.getDataRange().getValues();
  var found = false;
  var userName = '';

  for (var i = 1; i < users.length; i++) {
    if (users[i][0].toLowerCase() === email && users[i][7] === 'active') {
      found = true;
      userName = users[i][1];
      break;
    }
  }

  if (found) {
    var code = generateResetCode_();
    var expiry = parseInt(getSetting_(ss, 'reset_code_expiry_minutes') || '30');
    var props = PropertiesService.getScriptProperties();
    props.setProperty('RESET_' + email, JSON.stringify({
      code: hashPw_(code, getProp_('ENCRYPTION_SALT')),
      expiry: Date.now() + expiry * 60000,
      attempts: 0
    }));

    try {
      MailApp.sendEmail(email,
        '🔐 Bloom & Shine — Password Reset Code',
        'Hi ' + userName + ',\n\n' +
        'Your password reset code is: ' + code + '\n\n' +
        'This code expires in ' + expiry + ' minutes.\n' +
        'If you did not request this, ignore this email.\n\n' +
        '— Bloom & Shine Cleaning Services'
      );
    } catch (e) {
      Logger.log('Failed to send reset email: ' + e.message);
    }
    logAudit_('Password reset requested', email);
  }

  return { result: 'success' };
}

function handleResetPassword_(data) {
  var email = (data.email || '').trim().toLowerCase();
  var code = (data.code || '').trim().toUpperCase();
  var newPw = data.newPassword || '';

  if (!email || !code || !newPw) return { result: 'error', message: 'All fields required' };
  if (newPw.length < 6) return { result: 'error', message: 'Password must be at least 6 characters' };

  var props = PropertiesService.getScriptProperties();
  var resetRaw = props.getProperty('RESET_' + email);
  if (!resetRaw) return { result: 'error', message: 'No reset request found' };

  var reset = JSON.parse(resetRaw);
  if (Date.now() > reset.expiry) {
    props.deleteProperty('RESET_' + email);
    return { result: 'error', message: 'Code expired. Please request a new one.' };
  }

  reset.attempts = (reset.attempts || 0) + 1;
  if (reset.attempts > 5) {
    props.deleteProperty('RESET_' + email);
    return { result: 'error', message: 'Too many attempts. Request a new code.' };
  }

  var salt = getProp_('ENCRYPTION_SALT');
  if (hashPw_(code, salt) !== reset.code) {
    props.setProperty('RESET_' + email, JSON.stringify(reset));
    return { result: 'error', message: 'Invalid code. ' + (5 - reset.attempts) + ' attempts remaining.' };
  }

  // Code valid — update password
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var usersSheet = ss.getSheetByName('_Users');
  var users = usersSheet.getDataRange().getValues();
  for (var i = 1; i < users.length; i++) {
    if (users[i][0].toLowerCase() === email) {
      usersSheet.getRange(i + 1, 4).setValue(hashPw_(newPw, salt));
      usersSheet.getRange(i + 1, 5).setValue('No');
      break;
    }
  }

  props.deleteProperty('RESET_' + email);
  logAudit_('Password reset completed', email);
  return { result: 'success' };
}

function validateSession_(token) {
  if (!token) return null;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sessionsSheet = ss.getSheetByName('_Sessions');
  if (!sessionsSheet || sessionsSheet.getLastRow() <= 1) return null;

  var rows = sessionsSheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0] === token && new Date(rows[i][4]) > new Date()) {
      return { email: rows[i][1], role: rows[i][2] };
    }
  }
  return null;
}

function cleanExpiredSessions() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('_Sessions');
  if (!sheet || sheet.getLastRow() <= 1) return;

  var rows = sheet.getDataRange().getValues();
  var now = new Date();
  for (var i = rows.length - 1; i >= 1; i--) {
    if (new Date(rows[i][4]) <= now) {
      sheet.deleteRow(i + 1);
    }
  }
}

// ============================================
// DATA READ
// ============================================

function getAllData_(session) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return {
    result: 'success',
    contacts: getRows_(ss, 'Contacts'),
    estimates: getRows_(ss, 'Estimates'),
    contracts: getRows_(ss, 'Contracts'),
    invoices: getRows_(ss, 'Invoices')
  };
}

function getSheetRows_(sheetName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return { result: 'success', data: getRows_(ss, sheetName) };
}

function getRows_(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet || sheet.getLastRow() <= 1) return [];
  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  return data.map(function(row, idx) {
    var obj = { _row: idx + 2 }; // 1-indexed, skip header
    headers.forEach(function(h, c) { obj[h] = row[c]; });
    return obj;
  });
}

function getUsers_(session) {
  if (session.role !== 'developer' && session.role !== 'owner') {
    return { result: 'error', message: 'Insufficient permissions' };
  }
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('_Users');
  if (!sheet || sheet.getLastRow() <= 1) return { result: 'success', users: [] };

  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  // Exclude password hash from response
  var users = data.map(function(row, idx) {
    return {
      _row: idx + 2,
      email: row[0],
      name: row[1],
      role: row[2],
      mustChangePassword: row[4],
      protected: row[5],
      created: row[6],
      status: row[7]
    };
  });
  return { result: 'success', users: users };
}

function getSettings_(session) {
  if (session.role !== 'developer' && session.role !== 'owner') {
    return { result: 'error', message: 'Insufficient permissions' };
  }
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('_Settings');
  if (!sheet || sheet.getLastRow() <= 1) return { result: 'success', settings: {} };

  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
  var settings = {};
  data.forEach(function(row) { settings[row[0]] = row[1]; });
  return { result: 'success', settings: settings };
}

// ============================================
// DATA WRITE — CRUD
// ============================================

function handleUpdateRow_(data, session) {
  var sheetName = data.sheet;
  var rowNum = data.row;
  var updates = data.updates; // { columnName: value, ... }

  if (!sheetName || !rowNum || !updates) return { result: 'error', message: 'Missing sheet, row, or updates' };

  // Block admin sheets from CRUD unless developer
  if (sheetName.charAt(0) === '_' && session.role !== 'developer') {
    return { result: 'error', message: 'Cannot modify admin data' };
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { result: 'error', message: 'Sheet not found' };

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  for (var col in updates) {
    var colIdx = headers.indexOf(col);
    if (colIdx >= 0) {
      sheet.getRange(rowNum, colIdx + 1).setValue(updates[col]);
    }
  }

  logActivity_(ss, 'Update', sheetName + ' row ' + rowNum, JSON.stringify(updates).substring(0, 200));
  logAudit_(sheetName + ' row updated: ' + rowNum, session.email);
  return { result: 'success' };
}

function handleDeleteRow_(data, session) {
  var sheetName = data.sheet;
  var rowNum = data.row;

  if (!sheetName || !rowNum) return { result: 'error', message: 'Missing sheet or row' };
  if (sheetName.charAt(0) === '_') return { result: 'error', message: 'Cannot delete admin data via API' };

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { result: 'error', message: 'Sheet not found' };

  // Log what's being deleted before removing
  var rowData = sheet.getRange(rowNum, 1, 1, sheet.getLastColumn()).getValues()[0];
  sheet.deleteRow(rowNum);

  logActivity_(ss, 'Delete', sheetName + ' row ' + rowNum, 'Deleted: ' + rowData.slice(0, 3).join(', '));
  logAudit_(sheetName + ' row deleted: ' + rowNum, session.email);
  return { result: 'success' };
}

function handleAddInvoice_(data, session) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Invoices');
  if (!sheet) return { result: 'error', message: 'Invoices sheet not found' };

  sheet.appendRow([
    data.invoiceNumber || '',
    new Date(),
    data.clientName || '',
    data.clientEmail || '',
    data.service || '',
    data.amount || 0,
    data.paymentMethod || '',
    'Draft',
    '',
    data.notes || ''
  ]);

  logActivity_(ss, 'Invoice', data.clientName || 'Unknown', (data.invoiceNumber || '') + ' — $' + (data.amount || 0));
  logAudit_('Invoice created: ' + (data.invoiceNumber || ''), session.email);
  return { result: 'success' };
}

// ============================================
// USER MANAGEMENT (owner + developer)
// ============================================

function handleAddUser_(data, session) {
  if (session.role !== 'developer' && session.role !== 'owner') {
    return { result: 'error', message: 'Insufficient permissions' };
  }

  var email = (data.email || '').trim().toLowerCase();
  var name = (data.name || '').trim();
  var role = data.role || 'staff';

  if (!email || !name) return { result: 'error', message: 'Email and name required' };

  // Only developer can create developer accounts
  if (role === 'developer' && session.role !== 'developer') {
    return { result: 'error', message: 'Only developers can create developer accounts' };
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var usersSheet = ss.getSheetByName('_Users');

  // Check for duplicate
  var existing = usersSheet.getDataRange().getValues();
  for (var i = 1; i < existing.length; i++) {
    if (existing[i][0].toLowerCase() === email) {
      return { result: 'error', message: 'User already exists' };
    }
  }

  var tempPassword = data.tempPassword || generateResetCode_() + generateResetCode_();
  var salt = getProp_('ENCRYPTION_SALT');

  usersSheet.appendRow([
    email, name, role,
    hashPw_(tempPassword, salt),
    'Yes', 'false',
    new Date().toISOString(), 'active'
  ]);

  logAudit_('User added: ' + email + ' (' + role + ')', session.email);
  return { result: 'success', tempPassword: tempPassword };
}

function handleRemoveUser_(data, session) {
  if (session.role !== 'developer' && session.role !== 'owner') {
    return { result: 'error', message: 'Insufficient permissions' };
  }

  var email = (data.email || '').trim().toLowerCase();
  if (!email) return { result: 'error', message: 'Email required' };

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var usersSheet = ss.getSheetByName('_Users');
  var users = usersSheet.getDataRange().getValues();

  for (var i = 1; i < users.length; i++) {
    if (users[i][0].toLowerCase() === email) {
      // Can't remove protected accounts unless developer
      if (users[i][5] === 'true' && session.role !== 'developer') {
        return { result: 'error', message: 'Cannot remove protected accounts' };
      }
      // Can't remove yourself
      if (email === session.email) {
        return { result: 'error', message: 'Cannot remove your own account' };
      }
      usersSheet.deleteRow(i + 1);
      logAudit_('User removed: ' + email, session.email);
      return { result: 'success' };
    }
  }
  return { result: 'error', message: 'User not found' };
}

function handleResetUserPassword_(data, session) {
  if (session.role !== 'developer' && session.role !== 'owner') {
    return { result: 'error', message: 'Insufficient permissions' };
  }

  var email = (data.email || '').trim().toLowerCase();
  if (!email) return { result: 'error', message: 'Email required' };

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var usersSheet = ss.getSheetByName('_Users');
  var users = usersSheet.getDataRange().getValues();

  for (var i = 1; i < users.length; i++) {
    if (users[i][0].toLowerCase() === email) {
      if (users[i][5] === 'true' && session.role !== 'developer') {
        return { result: 'error', message: 'Cannot reset protected account passwords' };
      }
      var tempPw = generateResetCode_() + generateResetCode_();
      var salt = getProp_('ENCRYPTION_SALT');
      usersSheet.getRange(i + 1, 4).setValue(hashPw_(tempPw, salt));
      usersSheet.getRange(i + 1, 5).setValue('Yes');
      logAudit_('Password reset for: ' + email, session.email);
      return { result: 'success', tempPassword: tempPw };
    }
  }
  return { result: 'error', message: 'User not found' };
}

function handleUpdateSettings_(data, session) {
  if (session.role !== 'developer' && session.role !== 'owner') {
    return { result: 'error', message: 'Insufficient permissions' };
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('_Settings');
  if (!sheet) return { result: 'error', message: 'Settings sheet not found' };

  var key = data.key;
  var value = data.value;
  if (!key) return { result: 'error', message: 'Key required' };

  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0] === key) {
      sheet.getRange(i + 1, 2).setValue(value);
      sheet.getRange(i + 1, 3).setValue(new Date().toISOString());
      logAudit_('Setting updated: ' + key, session.email);
      return { result: 'success' };
    }
  }
  // Add new setting
  sheet.appendRow([key, value, new Date().toISOString()]);
  logAudit_('Setting added: ' + key, session.email);
  return { result: 'success' };
}

// ============================================
// PUBLIC FORM HANDLERS
// ============================================

function handleContact_(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Contacts');
  if (!sheet) return { result: 'error', message: 'Contacts sheet not found' };

  sheet.appendRow([
    new Date(), data.name || '', data.email || '', data.phone || '',
    data.service || '', data.message || '', 'New', '', ''
  ]);

  logActivity_(ss, 'Contact', data.name || 'Unknown', 'Service: ' + (data.service || 'General'));
  sendNotification_('🌸 New Contact — ' + (data.name || 'Unknown'),
    'New contact from your website!\n\n' +
    'Name: ' + (data.name || '—') + '\n' +
    'Email: ' + (data.email || '—') + '\n' +
    'Phone: ' + (data.phone || '—') + '\n' +
    'Service: ' + (data.service || '—') + '\n' +
    'Message: ' + (data.message || '—') + '\n\n' +
    '📋 ' + ss.getUrl()
  );
  return { result: 'success' };
}

function handleEstimate_(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Estimates');
  if (!sheet) return { result: 'error', message: 'Estimates sheet not found' };

  sheet.appendRow([
    new Date(), data.service || '', data.sqft || '', data.frequency || '',
    data.addons || '', data.estimateLow || '', data.estimateHigh || '', false
  ]);

  logActivity_(ss, 'Estimate', data.service || 'Unknown', '$' + data.estimateLow + '–$' + data.estimateHigh);
  return { result: 'success' };
}

function handleContract_(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Contracts');
  if (!sheet) return { result: 'error', message: 'Contracts sheet not found' };

  sheet.appendRow([
    new Date(), data.name || '', data.email || '', data.phone || '',
    data.address || '', data.service || '', data.frequency || '',
    data.mediaRelease || 'no', data.signed ? 'Yes' : 'No',
    data.signedDate || '', 'New', ''
  ]);

  logActivity_(ss, 'Contract', data.name || 'Unknown', (data.service || '') + ' (' + (data.frequency || '') + ')');
  sendNotification_('🌸 Agreement Signed — ' + (data.name || 'Unknown'),
    'New service agreement signed!\n\n' +
    'Client: ' + (data.name || '—') + '\n' +
    'Email: ' + (data.email || '—') + '\n' +
    'Phone: ' + (data.phone || '—') + '\n' +
    'Service: ' + (data.service || '—') + '\n' +
    'Frequency: ' + (data.frequency || '—') + '\n\n' +
    '📋 ' + ss.getUrl()
  );
  return { result: 'success' };
}

// ============================================
// EMAIL: DIGESTS
// ============================================

function sendDailyDigest() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var today = new Date(); today.setHours(0, 0, 0, 0);
  var yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);

  var contacts = countSince_(ss, 'Contacts', yesterday);
  var estimates = countSince_(ss, 'Estimates', yesterday);
  var contracts = countSince_(ss, 'Contracts', yesterday);
  var followUps = getFollowUpsDue_(ss);
  var newLeads = getNewLeads_(ss);

  if (contacts === 0 && estimates === 0 && contracts === 0 && followUps.length === 0 && newLeads.length === 0) return;

  var tz = getProp_('TIMEZONE') || 'America/New_York';
  var body = 'Good morning! Here\'s your daily summary:\n\n';

  if (contacts > 0 || estimates > 0 || contracts > 0) {
    body += '📊 YESTERDAY\n';
    if (contacts > 0) body += '  • ' + contacts + ' new contact(s)\n';
    if (estimates > 0) body += '  • ' + estimates + ' estimate(s)\n';
    if (contracts > 0) body += '  • ' + contracts + ' contract(s)\n';
    body += '\n';
  }

  if (followUps.length > 0) {
    body += '📞 FOLLOW-UPS DUE TODAY\n';
    followUps.forEach(function(f) { body += '  • ' + f.name + ' — ' + f.service + ' — ' + f.phone + '\n'; });
    body += '\n';
  }

  if (newLeads.length > 0) {
    body += '🆕 UNCONTACTED (' + newLeads.length + ')\n';
    newLeads.slice(0, 5).forEach(function(c) { body += '  • ' + c.name + ' — ' + c.service + ' — ' + c.phone + '\n'; });
    if (newLeads.length > 5) body += '  ... and ' + (newLeads.length - 5) + ' more\n';
    body += '\n';
  }

  body += '📋 ' + ss.getUrl() + '\nHave a blessed day! 🌸';
  sendNotification_('🌸 Daily Summary — ' + Utilities.formatDate(today, tz, 'MMM d'), body);
}

function sendWeeklySummary() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var today = new Date();
  var weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7);
  var tz = getProp_('TIMEZONE') || 'America/New_York';

  var contacts = countSince_(ss, 'Contacts', weekAgo);
  var estimates = countSince_(ss, 'Estimates', weekAgo);
  var contracts = countSince_(ss, 'Contracts', weekAgo);

  var weekRevenue = 0;
  var invSheet = ss.getSheetByName('Invoices');
  if (invSheet && invSheet.getLastRow() > 1) {
    invSheet.getRange(2, 1, invSheet.getLastRow() - 1, 9).getValues().forEach(function(r) {
      if (r[8] && new Date(r[8]) >= weekAgo && r[7] === 'Paid') weekRevenue += Number(r[5]) || 0;
    });
  }

  var body = 'Good morning! Weekly summary:\n\n' +
    '📊 THIS WEEK\n' +
    '  • ' + contacts + ' contact(s)\n' +
    '  • ' + estimates + ' estimate(s)\n' +
    '  • ' + contracts + ' contract(s)\n' +
    '  • $' + weekRevenue.toFixed(2) + ' revenue\n\n' +
    '📋 ' + ss.getUrl() + '\n\n' +
    '"Whatever you do, work at it with all your heart." — Col 3:23 🌸';

  sendNotification_('🌸 Weekly Report — ' +
    Utilities.formatDate(weekAgo, tz, 'MMM d') + '–' +
    Utilities.formatDate(today, tz, 'MMM d'), body);
}

// ============================================
// HELPERS
// ============================================

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function param_(e, key, fallback) {
  return (e && e.parameter && e.parameter[key]) || fallback || '';
}

function getProp_(key) {
  return PropertiesService.getScriptProperties().getProperty(key) || '';
}

function getSetting_(ss, key) {
  var sheet = ss.getSheetByName('_Settings');
  if (!sheet || sheet.getLastRow() <= 1) return null;
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === key) return data[i][1];
  }
  return null;
}

function hashPw_(password, salt) {
  var raw = salt + ':' + password;
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw);
  return digest.map(function(b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join('');
}

function generateToken_() {
  var bytes = [];
  for (var i = 0; i < 32; i++) bytes.push(Math.floor(Math.random() * 256));
  return Utilities.base64EncodeWebSafe(bytes);
}

function generateResetCode_() {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var code = '';
  for (var i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}

function sendNotification_(subject, body) {
  var email = getProp_('NOTIFICATION_EMAIL');
  if (email) MailApp.sendEmail(email, subject, body);
}

function sendPasswordResetEmail_(data) {
  if (!data.email || !data.code) return;
  MailApp.sendEmail(data.email,
    '🔐 Bloom & Shine — Password Reset Code',
    'Hi ' + (data.name || 'there') + ',\n\nYour reset code: ' + data.code +
    '\n\nExpires in 30 minutes.\n\n— Bloom & Shine Cleaning Services');
}

function logActivity_(ss, type, summary, details) {
  try {
    var sheet = ss.getSheetByName('Activity Log');
    if (sheet) sheet.appendRow([new Date(), type, summary, details]);
  } catch (e) { /* silent */ }
}

function logAudit_(event, actor) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('_Audit');
    if (sheet) sheet.appendRow([new Date(), event, '', actor || Session.getEffectiveUser().getEmail()]);
  } catch (e) { /* silent */ }
}

function countSince_(ss, tab, since) {
  var sheet = ss.getSheetByName(tab);
  if (!sheet || sheet.getLastRow() <= 1) return 0;
  var ts = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  var c = 0; ts.forEach(function(r) { if (r[0] && new Date(r[0]) >= since) c++; }); return c;
}

function getFollowUpsDue_(ss) {
  var sheet = ss.getSheetByName('Contacts');
  if (!sheet || sheet.getLastRow() <= 1) return [];
  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 9).getValues();
  var today = new Date(); today.setHours(0, 0, 0, 0);
  var tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  var due = [];
  data.forEach(function(r) {
    if (r[8] && new Date(r[8]) >= today && new Date(r[8]) < tomorrow && r[6] !== 'Completed' && r[6] !== 'Lost')
      due.push({ name: r[1], service: r[4], phone: r[3] });
  });
  return due;
}

function getNewLeads_(ss) {
  var sheet = ss.getSheetByName('Contacts');
  if (!sheet || sheet.getLastRow() <= 1) return [];
  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 7).getValues();
  var leads = [];
  data.forEach(function(r) { if (r[6] === 'New') leads.push({ name: r[1], service: r[4], phone: r[3] }); });
  return leads;
}
