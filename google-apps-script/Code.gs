/**
 * ============================================================
 * Bloom & Shine Cleaning Services — CRM Backend
 * ============================================================
 *
 * SETUP: Run setup() once from the Apps Script editor.
 * It builds the entire spreadsheet structure automatically.
 *
 * Then: Deploy > New deployment > Web app
 *   - Execute as: Me
 *   - Who has access: Anyone
 *
 * Copy the deployment URL into the admin dashboard Settings tab.
 * ============================================================
 */

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
  sheetName: 'Bloom & Shine — CRM',
  notificationEmail: 'nickib.bloomandshine@gmail.com',
  devEmail: 'josho@groundwire.net',
  timezone: 'America/New_York',
  tabs: {
    dashboard: 'Dashboard',
    contacts: 'Contacts',
    estimates: 'Estimates',
    contracts: 'Contracts',
    invoices: 'Invoices',
    activityLog: 'Activity Log'
  },
  colors: {
    teal: '#2D5F5D',
    sage: '#B7C9A8',
    blush: '#F2D7D9',
    cream: '#FDF8F0',
    rose: '#D4848A',
    forest: '#1B3A36',
    white: '#FFFFFF',
    headerText: '#FFFFFF'
  }
};

// ============================================
// SETUP — Run this once
// ============================================

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.rename(CONFIG.sheetName);

  // Build all tabs
  setupContactsTab(ss);
  setupEstimatesTab(ss);
  setupContractsTab(ss);
  setupInvoicesTab(ss);
  setupActivityLogTab(ss);
  setupDashboardTab(ss);

  // Remove default Sheet1 if it exists
  const defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1) {
    ss.deleteSheet(defaultSheet);
  }

  // Move Dashboard to first position
  const dashboard = ss.getSheetByName(CONFIG.tabs.dashboard);
  if (dashboard) ss.setActiveSheet(dashboard);
  if (dashboard) ss.moveActiveSheet(1);

  // Share with developer
  try {
    ss.addEditor(CONFIG.devEmail);
  } catch (e) {
    Logger.log('Could not share with dev: ' + e.message);
  }

  // Set up daily digest trigger
  clearTriggers_();
  ScriptApp.newTrigger('sendDailyDigest')
    .timeBased()
    .atHour(7)
    .everyDays(1)
    .inTimezone(CONFIG.timezone)
    .create();

  // Set up weekly summary trigger (Monday 8am)
  ScriptApp.newTrigger('sendWeeklySummary')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(8)
    .inTimezone(CONFIG.timezone)
    .create();

  Logger.log('✅ Setup complete! Now deploy as a web app.');
  SpreadsheetApp.getUi().alert(
    '✅ Setup Complete!\n\n' +
    'Your CRM is ready. Next step:\n\n' +
    '1. Click Deploy → New deployment\n' +
    '2. Select type: Web app\n' +
    '3. Execute as: Me\n' +
    '4. Who has access: Anyone\n' +
    '5. Click Deploy and copy the URL\n' +
    '6. Paste it in your admin dashboard Settings\n\n' +
    'Shared with: ' + CONFIG.devEmail
  );
}

function clearTriggers_() {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    ScriptApp.deleteTrigger(trigger);
  });
}

// ============================================
// TAB BUILDERS
// ============================================

function setupContactsTab(ss) {
  var sheet = getOrCreateSheet_(ss, CONFIG.tabs.contacts);
  var headers = ['Timestamp', 'Name', 'Email', 'Phone', 'Service Interest', 'Message', 'Status', 'Notes', 'Follow-Up Date'];

  sheet.clear();
  sheet.appendRow(headers);
  formatHeaderRow_(sheet, headers.length);

  // Column widths
  sheet.setColumnWidth(1, 140);  // Timestamp
  sheet.setColumnWidth(2, 160);  // Name
  sheet.setColumnWidth(3, 220);  // Email
  sheet.setColumnWidth(4, 130);  // Phone
  sheet.setColumnWidth(5, 160);  // Service
  sheet.setColumnWidth(6, 300);  // Message
  sheet.setColumnWidth(7, 100);  // Status
  sheet.setColumnWidth(8, 200);  // Notes
  sheet.setColumnWidth(9, 120);  // Follow-Up

  // Status dropdown validation
  var statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['New', 'Contacted', 'Quoted', 'Booked', 'Completed', 'Lost'], true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange('G2:G1000').setDataValidation(statusRule);

  // Conditional formatting for status
  addStatusConditionalFormatting_(sheet, 7);

  // Follow-up date formatting
  sheet.getRange('I2:I1000').setNumberFormat('MM/dd/yyyy');

  // Freeze header row
  sheet.setFrozenRows(1);

  // Timestamp format
  sheet.getRange('A2:A1000').setNumberFormat('MM/dd/yyyy hh:mm a');
}

function setupEstimatesTab(ss) {
  var sheet = getOrCreateSheet_(ss, CONFIG.tabs.estimates);
  var headers = ['Timestamp', 'Service', 'Sq Ft', 'Frequency', 'Add-Ons', 'Low Estimate', 'High Estimate', 'Converted'];

  sheet.clear();
  sheet.appendRow(headers);
  formatHeaderRow_(sheet, headers.length);

  sheet.setColumnWidth(1, 140);
  sheet.setColumnWidth(2, 180);
  sheet.setColumnWidth(3, 140);
  sheet.setColumnWidth(4, 120);
  sheet.setColumnWidth(5, 200);
  sheet.setColumnWidth(6, 110);
  sheet.setColumnWidth(7, 110);
  sheet.setColumnWidth(8, 100);

  // Currency formatting
  sheet.getRange('F2:G1000').setNumberFormat('$#,##0');

  // Converted checkbox
  sheet.getRange('H2:H1000').insertCheckboxes();

  sheet.setFrozenRows(1);
  sheet.getRange('A2:A1000').setNumberFormat('MM/dd/yyyy hh:mm a');
}

function setupContractsTab(ss) {
  var sheet = getOrCreateSheet_(ss, CONFIG.tabs.contracts);
  var headers = ['Timestamp', 'Name', 'Email', 'Phone', 'Address', 'Service', 'Frequency', 'Media Release', 'Signed', 'Signed Date', 'Status', 'Notes'];

  sheet.clear();
  sheet.appendRow(headers);
  formatHeaderRow_(sheet, headers.length);

  sheet.setColumnWidth(1, 140);
  sheet.setColumnWidth(2, 160);
  sheet.setColumnWidth(3, 220);
  sheet.setColumnWidth(4, 130);
  sheet.setColumnWidth(5, 250);
  sheet.setColumnWidth(6, 180);
  sheet.setColumnWidth(7, 110);
  sheet.setColumnWidth(8, 110);
  sheet.setColumnWidth(9, 80);
  sheet.setColumnWidth(10, 120);
  sheet.setColumnWidth(11, 100);
  sheet.setColumnWidth(12, 200);

  // Status dropdown
  var statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['New', 'Active', 'Paused', 'Terminated', 'Completed'], true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange('K2:K1000').setDataValidation(statusRule);

  addStatusConditionalFormatting_(sheet, 11);

  sheet.setFrozenRows(1);
  sheet.getRange('A2:A1000').setNumberFormat('MM/dd/yyyy hh:mm a');
  sheet.getRange('J2:J1000').setNumberFormat('MM/dd/yyyy');
}

function setupInvoicesTab(ss) {
  var sheet = getOrCreateSheet_(ss, CONFIG.tabs.invoices);
  var headers = ['Invoice #', 'Date', 'Client Name', 'Client Email', 'Service', 'Amount', 'Payment Method', 'Status', 'Paid Date', 'Notes'];

  sheet.clear();
  sheet.appendRow(headers);
  formatHeaderRow_(sheet, headers.length);

  sheet.setColumnWidth(1, 130);
  sheet.setColumnWidth(2, 110);
  sheet.setColumnWidth(3, 160);
  sheet.setColumnWidth(4, 220);
  sheet.setColumnWidth(5, 180);
  sheet.setColumnWidth(6, 100);
  sheet.setColumnWidth(7, 130);
  sheet.setColumnWidth(8, 100);
  sheet.setColumnWidth(9, 110);
  sheet.setColumnWidth(10, 200);

  // Currency
  sheet.getRange('F2:F1000').setNumberFormat('$#,##0.00');

  // Payment method dropdown
  var payRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Venmo', 'Cash App', 'Cash'], true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange('G2:G1000').setDataValidation(payRule);

  // Invoice status dropdown
  var statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Draft', 'Sent', 'Paid', 'Overdue', 'Void'], true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange('H2:H1000').setDataValidation(statusRule);

  addStatusConditionalFormatting_(sheet, 8);

  sheet.setFrozenRows(1);
  sheet.getRange('B2:B1000').setNumberFormat('MM/dd/yyyy');
  sheet.getRange('I2:I1000').setNumberFormat('MM/dd/yyyy');
}

function setupActivityLogTab(ss) {
  var sheet = getOrCreateSheet_(ss, CONFIG.tabs.activityLog);
  var headers = ['Timestamp', 'Type', 'Summary', 'Details'];

  sheet.clear();
  sheet.appendRow(headers);
  formatHeaderRow_(sheet, headers.length);

  sheet.setColumnWidth(1, 160);
  sheet.setColumnWidth(2, 120);
  sheet.setColumnWidth(3, 300);
  sheet.setColumnWidth(4, 400);

  sheet.setFrozenRows(1);
  sheet.getRange('A2:A1000').setNumberFormat('MM/dd/yyyy hh:mm a');
}

function setupDashboardTab(ss) {
  var sheet = getOrCreateSheet_(ss, CONFIG.tabs.dashboard);
  sheet.clear();

  // Title
  sheet.getRange('A1').setValue('Bloom & Shine — Business Dashboard');
  sheet.getRange('A1').setFontFamily('Montserrat')
    .setFontSize(18)
    .setFontWeight('bold')
    .setFontColor(CONFIG.colors.teal);
  sheet.getRange('A2').setValue('Auto-updated from website submissions')
    .setFontColor('#999999')
    .setFontSize(10)
    .setFontStyle('italic');

  // Section: Summary Stats
  sheet.getRange('A4').setValue('SUMMARY').setFontWeight('bold').setFontColor(CONFIG.colors.teal).setFontSize(12);

  var statLabels = [
    ['Total Contacts', '=COUNTA(Contacts!A2:A)'],
    ['New (Uncontacted)', '=COUNTIF(Contacts!G2:G,"New")'],
    ['Total Estimates', '=COUNTA(Estimates!A2:A)'],
    ['Estimates Converted', '=COUNTIF(Estimates!H2:H,TRUE)'],
    ['Active Contracts', '=COUNTIF(Contracts!K2:K,"Active")'],
    ['Total Contracts', '=COUNTA(Contracts!A2:A)'],
    ['Invoices Sent', '=COUNTIF(Invoices!H2:H,"Sent")'],
    ['Invoices Paid', '=COUNTIF(Invoices!H2:H,"Paid")'],
    ['Revenue (Paid)', '=SUMIF(Invoices!H2:H,"Paid",Invoices!F2:F)'],
    ['Outstanding', '=SUMIF(Invoices!H2:H,"Sent",Invoices!F2:F)']
  ];

  for (var i = 0; i < statLabels.length; i++) {
    var row = 5 + i;
    sheet.getRange('A' + row).setValue(statLabels[i][0]).setFontWeight('bold').setFontColor('#555555');
    sheet.getRange('B' + row).setFormula(statLabels[i][1]).setFontWeight('bold').setFontColor(CONFIG.colors.teal).setFontSize(14);
  }

  // Revenue formatting
  sheet.getRange('B13').setNumberFormat('$#,##0.00');
  sheet.getRange('B14').setNumberFormat('$#,##0.00');

  // Section: This Week
  sheet.getRange('A16').setValue('THIS WEEK').setFontWeight('bold').setFontColor(CONFIG.colors.teal).setFontSize(12);

  var weekLabels = [
    ['New contacts this week', '=COUNTIFS(Contacts!A2:A,">="&(TODAY()-WEEKDAY(TODAY(),2)+1),Contacts!A2:A,"<="&TODAY())'],
    ['Estimates this week', '=COUNTIFS(Estimates!A2:A,">="&(TODAY()-WEEKDAY(TODAY(),2)+1),Estimates!A2:A,"<="&TODAY())'],
    ['Contracts signed this week', '=COUNTIFS(Contracts!A2:A,">="&(TODAY()-WEEKDAY(TODAY(),2)+1),Contracts!A2:A,"<="&TODAY())']
  ];

  for (var j = 0; j < weekLabels.length; j++) {
    var wRow = 17 + j;
    sheet.getRange('A' + wRow).setValue(weekLabels[j][0]).setFontWeight('bold').setFontColor('#555555');
    sheet.getRange('B' + wRow).setFormula(weekLabels[j][1]).setFontWeight('bold').setFontColor(CONFIG.colors.rose).setFontSize(14);
  }

  // Section: Follow-Ups Due
  sheet.getRange('A21').setValue('FOLLOW-UPS DUE').setFontWeight('bold').setFontColor(CONFIG.colors.teal).setFontSize(12);
  sheet.getRange('A22').setValue('Overdue follow-ups').setFontColor('#555555');
  sheet.getRange('B22').setFormula('=COUNTIFS(Contacts!I2:I,"<"&TODAY(),Contacts!I2:I,"<>""",Contacts!G2:G,"<>Completed",Contacts!G2:G,"<>Lost")')
    .setFontWeight('bold').setFontColor(CONFIG.colors.rose).setFontSize(14);
  sheet.getRange('A23').setValue('Due today').setFontColor('#555555');
  sheet.getRange('B23').setFormula('=COUNTIFS(Contacts!I2:I,TODAY(),Contacts!G2:G,"<>Completed",Contacts!G2:G,"<>Lost")')
    .setFontWeight('bold').setFontColor(CONFIG.colors.teal).setFontSize(14);

  // Section: Service Breakdown
  sheet.getRange('D4').setValue('SERVICE BREAKDOWN').setFontWeight('bold').setFontColor(CONFIG.colors.teal).setFontSize(12);

  var services = ['Standard Cleaning', 'Deep Cleaning', 'Move In/Out', 'Commercial & Office', 'Construction & Real Estate', 'Church & Ministry', 'Professional Organization'];
  for (var s = 0; s < services.length; s++) {
    var sRow = 5 + s;
    sheet.getRange('D' + sRow).setValue(services[s]).setFontColor('#555555');
    sheet.getRange('E' + sRow).setFormula('=COUNTIF(Contacts!E2:E,"' + services[s] + '")+COUNTIF(Estimates!B2:B,"' + services[s] + '")')
      .setFontWeight('bold').setFontColor(CONFIG.colors.teal);
  }

  // Column widths
  sheet.setColumnWidth(1, 220);
  sheet.setColumnWidth(2, 100);
  sheet.setColumnWidth(3, 30);
  sheet.setColumnWidth(4, 220);
  sheet.setColumnWidth(5, 80);

  // Protect dashboard from accidental edits
  var protection = sheet.protect().setDescription('Dashboard — auto-calculated');
  protection.setWarningOnly(true);
}

// ============================================
// FORMATTING HELPERS
// ============================================

function getOrCreateSheet_(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

function formatHeaderRow_(sheet, numCols) {
  var headerRange = sheet.getRange(1, 1, 1, numCols);
  headerRange
    .setBackground(CONFIG.colors.teal)
    .setFontColor(CONFIG.colors.headerText)
    .setFontFamily('Montserrat')
    .setFontWeight('bold')
    .setFontSize(10)
    .setVerticalAlignment('middle')
    .setHorizontalAlignment('left');
  sheet.setRowHeight(1, 36);

  // Alternating row colors for readability
  var bandRange = sheet.getRange(2, 1, 998, numCols);
  var banding = bandRange.getBandings();
  if (banding.length === 0) {
    bandRange.applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY)
      .setHeaderRowColor(CONFIG.colors.teal)
      .setFirstRowColor(CONFIG.colors.white)
      .setSecondRowColor(CONFIG.colors.cream);
  }
}

function addStatusConditionalFormatting_(sheet, col) {
  var range = sheet.getRange(2, col, 998, 1);

  var rules = [
    { text: 'New',        bg: CONFIG.colors.blush, fg: '#9B2C3E' },
    { text: 'Contacted',  bg: '#D4EDDA',           fg: '#155724' },
    { text: 'Quoted',     bg: '#CCE5FF',           fg: '#004085' },
    { text: 'Booked',     bg: CONFIG.colors.sage,   fg: CONFIG.colors.forest },
    { text: 'Active',     bg: CONFIG.colors.sage,   fg: CONFIG.colors.forest },
    { text: 'Completed',  bg: '#E2E3E5',           fg: '#383D41' },
    { text: 'Paid',       bg: '#D4EDDA',           fg: '#155724' },
    { text: 'Sent',       bg: '#CCE5FF',           fg: '#004085' },
    { text: 'Overdue',    bg: '#F8D7DA',           fg: '#721C24' },
    { text: 'Lost',       bg: '#E2E3E5',           fg: '#999999' },
    { text: 'Terminated', bg: '#E2E3E5',           fg: '#999999' },
    { text: 'Void',       bg: '#E2E3E5',           fg: '#999999' },
    { text: 'Paused',     bg: '#FFF3CD',           fg: '#856404' },
    { text: 'Draft',      bg: '#FFF3CD',           fg: '#856404' }
  ];

  var existingRules = sheet.getConditionalFormatRules();

  rules.forEach(function(rule) {
    existingRules.push(
      SpreadsheetApp.newConditionalFormatRule()
        .whenTextEqualTo(rule.text)
        .setBackground(rule.bg)
        .setFontColor(rule.fg)
        .setBold(true)
        .setRanges([range])
        .build()
    );
  });

  sheet.setConditionalFormatRules(existingRules);
}

// ============================================
// GET HANDLER (Admin Dashboard data retrieval)
// ============================================

function doGet(e) {
  try {
    var action = (e && e.parameter && e.parameter.action) || 'ping';
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    if (action === 'ping') {
      return jsonResponse({ result: 'pong' });
    }

    if (action === 'getAll') {
      return jsonResponse({
        result: 'success',
        contacts: getSheetData_(ss, CONFIG.tabs.contacts),
        estimates: getSheetData_(ss, CONFIG.tabs.estimates),
        contracts: getSheetData_(ss, CONFIG.tabs.contracts),
        invoices: getSheetData_(ss, CONFIG.tabs.invoices)
      });
    }

    if (action === 'getSheet') {
      var sheetName = e.parameter.sheet || CONFIG.tabs.contacts;
      return jsonResponse({ result: 'success', data: getSheetData_(ss, sheetName) });
    }

    return jsonResponse({ result: 'error', message: 'Unknown action' });

  } catch (error) {
    return jsonResponse({ result: 'error', message: error.toString() });
  }
}

function getSheetData_(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  return sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================
// POST HANDLER (Website form submissions)
// ============================================

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var source = data.source || 'contact';
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    switch (source) {
      case 'contact':
        logContact_(ss, data);
        logActivity_(ss, 'Contact', data.name || 'Unknown', 'New contact: ' + (data.service || 'General'));
        sendContactNotification_(data);
        break;
      case 'estimate':
        logEstimate_(ss, data);
        logActivity_(ss, 'Estimate', data.service || 'Unknown', '$' + data.estimateLow + '–$' + data.estimateHigh);
        break;
      case 'contract':
        logContract_(ss, data);
        logActivity_(ss, 'Contract', data.name || 'Unknown', data.service + ' (' + data.frequency + ')');
        sendContractNotification_(data);
        break;
      case 'invoice':
        logInvoice_(ss, data);
        logActivity_(ss, 'Invoice', data.clientName || 'Unknown', data.invoiceNumber + ' — $' + data.amount);
        break;
      case 'password_reset':
        sendPasswordResetEmail_(data);
        break;
      default:
        logContact_(ss, data);
    }

    return jsonResponse({ result: 'success' });

  } catch (error) {
    return jsonResponse({ result: 'error', message: error.toString() });
  }
}

// ============================================
// LOGGING FUNCTIONS
// ============================================

function logContact_(ss, data) {
  var sheet = ss.getSheetByName(CONFIG.tabs.contacts);
  if (!sheet) return;
  sheet.appendRow([
    new Date(),
    data.name || '',
    data.email || '',
    data.phone || '',
    data.service || '',
    data.message || '',
    'New',
    '',  // Notes
    ''   // Follow-up date
  ]);
}

function logEstimate_(ss, data) {
  var sheet = ss.getSheetByName(CONFIG.tabs.estimates);
  if (!sheet) return;
  sheet.appendRow([
    new Date(),
    data.service || '',
    data.sqft || '',
    data.frequency || '',
    data.addons || '',
    data.estimateLow || '',
    data.estimateHigh || '',
    false  // Converted checkbox
  ]);
}

function logContract_(ss, data) {
  var sheet = ss.getSheetByName(CONFIG.tabs.contracts);
  if (!sheet) return;
  sheet.appendRow([
    new Date(),
    data.name || '',
    data.email || '',
    data.phone || '',
    data.address || '',
    data.service || '',
    data.frequency || '',
    data.mediaRelease || 'no',
    data.signed ? 'Yes' : 'No',
    data.signedDate || '',
    'New',
    ''  // Notes
  ]);
}

function logInvoice_(ss, data) {
  var sheet = ss.getSheetByName(CONFIG.tabs.invoices);
  if (!sheet) return;
  sheet.appendRow([
    data.invoiceNumber || '',
    new Date(),
    data.clientName || '',
    data.clientEmail || '',
    data.service || '',
    data.amount || 0,
    data.paymentMethod || '',
    'Draft',
    '',  // Paid date
    ''   // Notes
  ]);
}

function logActivity_(ss, type, summary, details) {
  var sheet = ss.getSheetByName(CONFIG.tabs.activityLog);
  if (!sheet) return;
  sheet.appendRow([new Date(), type, summary, details]);
}

// ============================================
// EMAIL NOTIFICATIONS
// ============================================

function sendContactNotification_(data) {
  var subject = '🌸 New Contact — ' + (data.name || 'Unknown');
  var body = 'New contact from your website!\n\n' +
    'Name: ' + (data.name || '—') + '\n' +
    'Email: ' + (data.email || '—') + '\n' +
    'Phone: ' + (data.phone || '—') + '\n' +
    'Service: ' + (data.service || '—') + '\n' +
    'Message: ' + (data.message || '—') + '\n\n' +
    '📋 View in your CRM:\n' +
    SpreadsheetApp.getActiveSpreadsheet().getUrl();

  MailApp.sendEmail(CONFIG.notificationEmail, subject, body);
}

function sendContractNotification_(data) {
  var subject = '🌸 Agreement Signed — ' + (data.name || 'Unknown');
  var body = 'A new service agreement was signed!\n\n' +
    'Client: ' + (data.name || '—') + '\n' +
    'Email: ' + (data.email || '—') + '\n' +
    'Phone: ' + (data.phone || '—') + '\n' +
    'Address: ' + (data.address || '—') + '\n' +
    'Service: ' + (data.service || '—') + '\n' +
    'Frequency: ' + (data.frequency || '—') + '\n' +
    'Media Release: ' + (data.mediaRelease || '—') + '\n\n' +
    'The client downloaded a PDF copy.\n' +
    'Follow up to schedule their first service.\n\n' +
    '📋 View in your CRM:\n' +
    SpreadsheetApp.getActiveSpreadsheet().getUrl();

  MailApp.sendEmail(CONFIG.notificationEmail, subject, body);
}

function sendPasswordResetEmail_(data) {
  if (!data.email || !data.code) return;
  var subject = '🔐 Bloom & Shine — Password Reset Code';
  var body = 'Hi ' + (data.name || 'there') + ',\n\n' +
    'Your password reset code is: ' + data.code + '\n\n' +
    'This code expires in 30 minutes.\n' +
    'If you did not request this, ignore this email.\n\n' +
    '— Bloom & Shine Cleaning Services';

  MailApp.sendEmail(data.email, subject, body);
}

// ============================================
// DAILY DIGEST (7:00 AM)
// ============================================

function sendDailyDigest() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  // Count yesterday's activity
  var contacts = countRowsSince_(ss, CONFIG.tabs.contacts, yesterday);
  var estimates = countRowsSince_(ss, CONFIG.tabs.estimates, yesterday);
  var contracts = countRowsSince_(ss, CONFIG.tabs.contracts, yesterday);

  // Check follow-ups due today
  var followUps = getFollowUpsDue_(ss);

  // Only send if there's something to report
  if (contacts === 0 && estimates === 0 && contracts === 0 && followUps.length === 0) return;

  var subject = '🌸 Bloom & Shine — Daily Summary (' + Utilities.formatDate(today, CONFIG.timezone, 'MMM d') + ')';
  var body = 'Good morning! Here\'s your daily summary:\n\n';

  if (contacts > 0 || estimates > 0 || contracts > 0) {
    body += '📊 YESTERDAY\'S ACTIVITY\n';
    if (contacts > 0) body += '  • ' + contacts + ' new contact(s)\n';
    if (estimates > 0) body += '  • ' + estimates + ' estimate(s) requested\n';
    if (contracts > 0) body += '  • ' + contracts + ' contract(s) signed\n';
    body += '\n';
  }

  if (followUps.length > 0) {
    body += '📞 FOLLOW-UPS DUE TODAY\n';
    followUps.forEach(function(fu) {
      body += '  • ' + fu.name + ' (' + fu.service + ') — ' + fu.phone + '\n';
    });
    body += '\n';
  }

  // New contacts needing attention
  var newContacts = getNewContacts_(ss);
  if (newContacts.length > 0) {
    body += '🆕 UNCONTACTED LEADS (' + newContacts.length + ')\n';
    newContacts.slice(0, 5).forEach(function(c) {
      body += '  • ' + c.name + ' — ' + c.service + ' — ' + c.phone + '\n';
    });
    if (newContacts.length > 5) body += '  ... and ' + (newContacts.length - 5) + ' more\n';
    body += '\n';
  }

  body += '📋 Open your CRM:\n' + ss.getUrl() + '\n\n';
  body += 'Have a blessed day! 🌸';

  MailApp.sendEmail(CONFIG.notificationEmail, subject, body);
}

// ============================================
// WEEKLY SUMMARY (Monday 8:00 AM)
// ============================================

function sendWeeklySummary() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var today = new Date();
  var weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  var contacts = countRowsSince_(ss, CONFIG.tabs.contacts, weekAgo);
  var estimates = countRowsSince_(ss, CONFIG.tabs.estimates, weekAgo);
  var contracts = countRowsSince_(ss, CONFIG.tabs.contracts, weekAgo);

  // Revenue this week
  var invoiceSheet = ss.getSheetByName(CONFIG.tabs.invoices);
  var weekRevenue = 0;
  if (invoiceSheet && invoiceSheet.getLastRow() > 1) {
    var invoiceData = invoiceSheet.getRange(2, 1, invoiceSheet.getLastRow() - 1, 9).getValues();
    invoiceData.forEach(function(row) {
      var paidDate = row[8]; // Paid Date column
      if (paidDate && new Date(paidDate) >= weekAgo && row[7] === 'Paid') {
        weekRevenue += Number(row[5]) || 0;
      }
    });
  }

  var subject = '🌸 Bloom & Shine — Weekly Report (' +
    Utilities.formatDate(weekAgo, CONFIG.timezone, 'MMM d') + ' – ' +
    Utilities.formatDate(today, CONFIG.timezone, 'MMM d') + ')';

  var body = 'Good morning! Here\'s your weekly summary:\n\n' +
    '📊 THIS WEEK\n' +
    '  • ' + contacts + ' new contact(s)\n' +
    '  • ' + estimates + ' estimate(s)\n' +
    '  • ' + contracts + ' contract(s) signed\n' +
    '  • $' + weekRevenue.toFixed(2) + ' revenue collected\n\n';

  // All-time stats
  var totalContacts = countAllRows_(ss, CONFIG.tabs.contacts);
  var totalContracts = countAllRows_(ss, CONFIG.tabs.contracts);
  var newLeads = getNewContacts_(ss).length;

  body += '📈 ALL-TIME\n' +
    '  • ' + totalContacts + ' total contacts\n' +
    '  • ' + totalContracts + ' total contracts\n' +
    '  • ' + newLeads + ' leads awaiting follow-up\n\n';

  body += '📋 Open your CRM:\n' + ss.getUrl() + '\n\n';
  body += '"Whatever you do, work at it with all your heart." — Col 3:23 🌸';

  MailApp.sendEmail(CONFIG.notificationEmail, subject, body);
}

// ============================================
// DATA HELPERS
// ============================================

function countRowsSince_(ss, tabName, sinceDate) {
  var sheet = ss.getSheetByName(tabName);
  if (!sheet || sheet.getLastRow() <= 1) return 0;
  var timestamps = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  var count = 0;
  timestamps.forEach(function(row) {
    if (row[0] && new Date(row[0]) >= sinceDate) count++;
  });
  return count;
}

function countAllRows_(ss, tabName) {
  var sheet = ss.getSheetByName(tabName);
  if (!sheet) return 0;
  return Math.max(0, sheet.getLastRow() - 1);
}

function getFollowUpsDue_(ss) {
  var sheet = ss.getSheetByName(CONFIG.tabs.contacts);
  if (!sheet || sheet.getLastRow() <= 1) return [];
  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 9).getValues();
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  var due = [];
  data.forEach(function(row) {
    var followUp = row[8]; // Follow-Up Date column
    var status = row[6];
    if (followUp && new Date(followUp) >= today && new Date(followUp) < tomorrow &&
        status !== 'Completed' && status !== 'Lost') {
      due.push({ name: row[1], service: row[4], phone: row[3] });
    }
  });
  return due;
}

function getNewContacts_(ss) {
  var sheet = ss.getSheetByName(CONFIG.tabs.contacts);
  if (!sheet || sheet.getLastRow() <= 1) return [];
  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 7).getValues();
  var newContacts = [];
  data.forEach(function(row) {
    if (row[6] === 'New') {
      newContacts.push({ name: row[1], service: row[4], phone: row[3] });
    }
  });
  return newContacts;
}

// ============================================
// UTILITY: Manual test
// ============================================

function testSetup() {
  var testData = {
    postData: {
      contents: JSON.stringify({
        source: 'contact',
        name: 'Test User',
        email: 'test@example.com',
        phone: '555-0123',
        service: 'Standard Cleaning',
        message: 'This is a test.'
      })
    }
  };
  var result = doPost(testData);
  Logger.log(result.getContent());
}
