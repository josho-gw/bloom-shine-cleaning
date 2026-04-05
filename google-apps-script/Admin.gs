/**
 * ============================================================
 * Bloom & Shine Cleaning Services — Setup & Administration
 * ============================================================
 *
 * Creates THREE separate workbooks:
 *   1. CRM — business data (contacts, estimates, contracts, invoices)
 *   2. Admin — auth, sessions, settings, audit (protected)
 *   3. Financials — ledger, categories, financial dashboard
 *
 * All workbook IDs and secrets stored in Script Properties.
 * Run setup() once from the Apps Script editor.
 * ============================================================
 */

// ============================================
// MAIN SETUP
// ============================================

function setup() {
  var ui = SpreadsheetApp.getUi();

  var ownerEmail = prompt_(ui, 'Owner Email', 'Business owner\'s Gmail (for notifications and login):');
  if (!ownerEmail) return;
  var devEmail = prompt_(ui, 'Developer Email', 'Developer\'s email (for sheet access and login):');
  if (!devEmail) return;
  var defaultPassword = prompt_(ui, 'Default Password', 'Temporary password for both accounts (forced change on first login):');
  if (!defaultPassword) return;

  ownerEmail = ownerEmail.trim().toLowerCase();
  devEmail = devEmail.trim().toLowerCase();

  // Generate secrets
  var salt = genSalt_();
  var sessionSecret = genSalt_();

  // Store core config
  var props = PropertiesService.getScriptProperties();
  props.setProperties({
    OWNER_EMAIL: ownerEmail,
    OWNER_NAME: 'Owner',
    DEV_EMAIL: devEmail,
    DEV_NAME: 'Developer',
    NOTIFICATION_EMAIL: ownerEmail,
    ENCRYPTION_SALT: salt,
    SESSION_SECRET: sessionSecret,
    TIMEZONE: 'America/New_York',
    SETUP_COMPLETE: 'true',
    SETUP_DATE: new Date().toISOString()
  });

  // Build workbooks
  var crmId = buildCRM_(ownerEmail, devEmail);
  var adminId = buildAdmin_(ownerEmail, devEmail, defaultPassword, salt);
  var finId = buildFinancials_(ownerEmail, devEmail);

  // Store workbook IDs
  props.setProperties({
    CRM_SPREADSHEET_ID: crmId,
    ADMIN_SPREADSHEET_ID: adminId,
    FINANCIALS_SPREADSHEET_ID: finId
  });

  // Set up triggers
  clearTriggers_();
  var tz = 'America/New_York';
  ScriptApp.newTrigger('sendDailyDigest').timeBased().atHour(7).everyDays(1).inTimezone(tz).create();
  ScriptApp.newTrigger('sendWeeklySummary').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(8).inTimezone(tz).create();
  ScriptApp.newTrigger('cleanExpiredSessions').timeBased().everyHours(1).create();

  ui.alert(
    '✅ Setup Complete!\n\n' +
    'Three workbooks created:\n' +
    '  📋 Bloom & Shine — CRM\n' +
    '  🔐 Bloom & Shine — Admin\n' +
    '  💰 Bloom & Shine — Financials\n\n' +
    'Accounts:\n' +
    '  • ' + ownerEmail + ' (Owner)\n' +
    '  • ' + devEmail + ' (Developer)\n\n' +
    'Next: Deploy → New deployment → Web app\n' +
    '  Execute as: Me | Access: Anyone\n' +
    '  Copy the URL into admin dashboard Settings.'
  );
}

// ============================================
// CRM WORKBOOK
// ============================================

function buildCRM_(ownerEmail, devEmail) {
  var ss = SpreadsheetApp.create('Bloom & Shine — CRM');
  var id = ss.getId();

  // Share
  ss.addEditor(ownerEmail);
  try { ss.addEditor(devEmail); } catch(e) {}

  // Contacts
  var contacts = ss.getSheets()[0];
  contacts.setName('Contacts');
  contacts.appendRow(['Timestamp', 'Name', 'Email', 'Phone', 'Service Interest', 'Message', 'Status', 'Notes', 'Follow-Up Date']);
  fmtHeader_(contacts, 9);
  contacts.setColumnWidths(1, 1, 140);
  contacts.setColumnWidths(2, 1, 160);
  contacts.setColumnWidths(3, 1, 220);
  contacts.setColumnWidths(4, 1, 130);
  contacts.setColumnWidths(5, 1, 160);
  contacts.setColumnWidths(6, 1, 300);
  contacts.setColumnWidths(7, 1, 100);
  contacts.setColumnWidths(8, 1, 200);
  contacts.setColumnWidths(9, 1, 120);
  contacts.getRange('G2:G1000').setDataValidation(ddl_(['New', 'Contacted', 'Quoted', 'Booked', 'Completed', 'Lost']));
  statusColors_(contacts, 7);
  contacts.getRange('A2:A1000').setNumberFormat('MM/dd/yyyy hh:mm a');
  contacts.getRange('I2:I1000').setNumberFormat('MM/dd/yyyy');
  contacts.setFrozenRows(1);

  // Estimates
  var estimates = ss.insertSheet('Estimates');
  estimates.appendRow(['Timestamp', 'Service', 'Sq Ft', 'Frequency', 'Add-Ons', 'Low Estimate', 'High Estimate', 'Converted']);
  fmtHeader_(estimates, 8);
  estimates.setColumnWidths(1, 1, 140);
  estimates.setColumnWidths(2, 1, 180);
  estimates.setColumnWidths(5, 1, 200);
  estimates.setColumnWidths(6, 2, 110);
  estimates.getRange('F2:G1000').setNumberFormat('$#,##0');
  estimates.getRange('H2:H1000').insertCheckboxes();
  estimates.getRange('A2:A1000').setNumberFormat('MM/dd/yyyy hh:mm a');
  estimates.setFrozenRows(1);

  // Contracts
  var contracts = ss.insertSheet('Contracts');
  contracts.appendRow(['Timestamp', 'Name', 'Email', 'Phone', 'Address', 'Service', 'Frequency', 'Media Release', 'Signed', 'Signed Date', 'Status', 'Notes']);
  fmtHeader_(contracts, 12);
  contracts.setColumnWidths(1, 1, 140);
  contracts.setColumnWidths(2, 1, 160);
  contracts.setColumnWidths(3, 1, 220);
  contracts.setColumnWidths(5, 1, 250);
  contracts.setColumnWidths(6, 1, 180);
  contracts.getRange('K2:K1000').setDataValidation(ddl_(['New', 'Active', 'Paused', 'Terminated', 'Completed']));
  statusColors_(contracts, 11);
  contracts.getRange('A2:A1000').setNumberFormat('MM/dd/yyyy hh:mm a');
  contracts.getRange('J2:J1000').setNumberFormat('MM/dd/yyyy');
  contracts.setFrozenRows(1);

  // Invoices
  var invoices = ss.insertSheet('Invoices');
  invoices.appendRow(['Invoice #', 'Date', 'Client Name', 'Client Email', 'Service', 'Amount', 'Payment Method', 'Status', 'Paid Date', 'Notes']);
  fmtHeader_(invoices, 10);
  invoices.setColumnWidths(1, 1, 130);
  invoices.setColumnWidths(3, 1, 160);
  invoices.setColumnWidths(4, 1, 220);
  invoices.setColumnWidths(5, 1, 180);
  invoices.getRange('F2:F1000').setNumberFormat('$#,##0.00');
  invoices.getRange('G2:G1000').setDataValidation(ddl_(['Venmo', 'Cash App', 'Cash']));
  invoices.getRange('H2:H1000').setDataValidation(ddl_(['Draft', 'Sent', 'Paid', 'Overdue', 'Void']));
  statusColors_(invoices, 8);
  invoices.getRange('B2:B1000').setNumberFormat('MM/dd/yyyy');
  invoices.getRange('I2:I1000').setNumberFormat('MM/dd/yyyy');
  invoices.setFrozenRows(1);

  // Activity Log
  var activity = ss.insertSheet('Activity Log');
  activity.appendRow(['Timestamp', 'Type', 'Summary', 'Details']);
  fmtHeader_(activity, 4);
  activity.setColumnWidths(1, 1, 160);
  activity.setColumnWidths(2, 1, 120);
  activity.setColumnWidths(3, 1, 300);
  activity.setColumnWidths(4, 1, 400);
  activity.getRange('A2:A1000').setNumberFormat('MM/dd/yyyy hh:mm a');
  activity.setFrozenRows(1);

  // Dashboard
  var dash = ss.insertSheet('Dashboard');
  buildDashboard_(dash);
  ss.setActiveSheet(dash);
  ss.moveActiveSheet(1);

  return id;
}

// ============================================
// ADMIN WORKBOOK
// ============================================

function buildAdmin_(ownerEmail, devEmail, defaultPassword, salt) {
  var ss = SpreadsheetApp.create('Bloom & Shine — Admin');
  var id = ss.getId();

  // Only dev gets editor access; owner gets viewer (script writes on their behalf)
  try { ss.addEditor(devEmail); } catch(e) {}

  // _Users
  var users = ss.getSheets()[0];
  users.setName('_Users');
  users.appendRow(['Email', 'Name', 'Role', 'Password Hash', 'Must Change PW', 'Protected', 'Created', 'Status']);
  fmtHeader_(users, 8);
  users.setColumnWidths(1, 1, 250);
  users.setColumnWidths(2, 1, 160);
  users.setColumnWidths(4, 1, 300);

  var devHash = hashPw_(defaultPassword, salt);
  var ownerHash = hashPw_(defaultPassword, salt);
  users.appendRow([devEmail, 'Developer', 'developer', devHash, 'Yes', 'true', new Date().toISOString(), 'active']);
  users.appendRow([ownerEmail, 'Owner', 'owner', ownerHash, 'Yes', 'false', new Date().toISOString(), 'active']);
  users.setFrozenRows(1);
  protect_(users);

  // _Sessions
  var sessions = ss.insertSheet('_Sessions');
  sessions.appendRow(['Token', 'Email', 'Role', 'Created', 'Expires', 'IP/UA']);
  fmtHeader_(sessions, 6);
  sessions.setFrozenRows(1);
  protect_(sessions);

  // _Settings
  var settings = ss.insertSheet('_Settings');
  settings.appendRow(['Key', 'Value', 'Updated']);
  fmtHeader_(settings, 3);
  settings.setColumnWidths(1, 1, 200);
  settings.setColumnWidths(2, 1, 400);
  settings.appendRow(['session_duration_hours', '4', new Date().toISOString()]);
  settings.appendRow(['max_login_attempts', '5', new Date().toISOString()]);
  settings.appendRow(['lockout_minutes', '15', new Date().toISOString()]);
  settings.appendRow(['reset_code_expiry_minutes', '30', new Date().toISOString()]);
  settings.setFrozenRows(1);
  protect_(settings);

  // _Audit
  var audit = ss.insertSheet('_Audit');
  audit.appendRow(['Timestamp', 'Event', 'Details', 'Actor']);
  fmtHeader_(audit, 4);
  audit.setColumnWidths(1, 1, 160);
  audit.setColumnWidths(2, 1, 250);
  audit.setColumnWidths(3, 1, 400);
  audit.setColumnWidths(4, 1, 200);
  audit.getRange('A2:A1000').setNumberFormat('MM/dd/yyyy hh:mm a');
  audit.setFrozenRows(1);
  protect_(audit);

  // Initial audit entry
  audit.appendRow([new Date(), 'System initialized', 'Setup completed. Owner: ' + ownerEmail + ', Dev: ' + devEmail, Session.getEffectiveUser().getEmail()]);

  return id;
}

// ============================================
// FINANCIALS WORKBOOK
// ============================================

function buildFinancials_(ownerEmail, devEmail) {
  var ss = SpreadsheetApp.create('Bloom & Shine — Financials');
  var id = ss.getId();

  ss.addEditor(ownerEmail);
  try { ss.addEditor(devEmail); } catch(e) {}

  // Ledger (general journal)
  var ledger = ss.getSheets()[0];
  ledger.setName('Ledger');
  ledger.appendRow(['Date', 'Type', 'Category', 'Description', 'Reference', 'Debit', 'Credit', 'Balance', 'Payment Method', 'Entered By', 'Notes']);
  fmtHeader_(ledger, 11);
  ledger.setColumnWidths(1, 1, 110);
  ledger.setColumnWidths(2, 1, 90);
  ledger.setColumnWidths(3, 1, 170);
  ledger.setColumnWidths(4, 1, 250);
  ledger.setColumnWidths(5, 1, 130);
  ledger.setColumnWidths(6, 2, 100);
  ledger.setColumnWidths(8, 1, 100);
  ledger.setColumnWidths(9, 1, 120);
  ledger.setColumnWidths(10, 1, 160);
  ledger.setColumnWidths(11, 1, 200);

  ledger.getRange('B2:B1000').setDataValidation(ddl_(['Income', 'Expense']));
  ledger.getRange('D2:D1000').setNumberFormat('@'); // Force text
  ledger.getRange('F2:F1000').setNumberFormat('$#,##0.00');
  ledger.getRange('G2:G1000').setNumberFormat('$#,##0.00');
  ledger.getRange('H2:H1000').setNumberFormat('$#,##0.00');
  ledger.getRange('A2:A1000').setNumberFormat('MM/dd/yyyy');
  ledger.getRange('I2:I1000').setDataValidation(ddl_(['Venmo', 'Cash App', 'Cash', 'Bank Transfer', 'Check', 'Other']));
  ledger.setFrozenRows(1);

  // Running balance formula (row 2 starts the chain)
  // Balance = previous balance + credit - debit
  // For row 2: =G2-F2, for row 3+: =H(n-1)+G(n)-F(n)

  // Conditional formatting: Income=green bg, Expense=red bg
  var typeRange = ledger.getRange(2, 2, 998, 1);
  var rules = [];
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('Income').setBackground('#D4EDDA').setFontColor('#155724').setBold(true).setRanges([typeRange]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('Expense').setBackground('#F8D7DA').setFontColor('#721C24').setBold(true).setRanges([typeRange]).build());
  ledger.setConditionalFormatRules(rules);

  // Categories (chart of accounts)
  var categories = ss.insertSheet('Categories');
  categories.appendRow(['Category', 'Type', 'Description', 'Active']);
  fmtHeader_(categories, 4);
  categories.setColumnWidths(1, 1, 200);
  categories.setColumnWidths(2, 1, 100);
  categories.setColumnWidths(3, 1, 300);
  categories.setColumnWidths(4, 1, 80);

  // Seed default categories
  var defaultCats = [
    ['Cleaning Income',       'Income',  'Revenue from cleaning services',        'Yes'],
    ['Organization Income',   'Income',  'Revenue from organization services',    'Yes'],
    ['Construction Income',   'Income',  'Revenue from construction cleanup',     'Yes'],
    ['Supplies',              'Expense', 'Cleaning supplies, non-toxic products', 'Yes'],
    ['Vehicle / Gas',         'Expense', 'Fuel, mileage, vehicle maintenance',   'Yes'],
    ['Insurance',             'Expense', 'Business liability insurance',          'Yes'],
    ['Equipment',             'Expense', 'Cleaning equipment, tools',             'Yes'],
    ['Marketing',             'Expense', 'Advertising, social media, printing',   'Yes'],
    ['Professional Services', 'Expense', 'Accounting, legal, licensing fees',     'Yes'],
    ['Phone / Internet',      'Expense', 'Business phone, internet service',      'Yes'],
    ['Uniforms / Apparel',    'Expense', 'Work clothing, branded items',          'Yes'],
    ['Training',              'Expense', 'Continuing education, certifications',  'Yes'],
    ['Miscellaneous Income',  'Income',  'Other income not categorized above',    'Yes'],
    ['Miscellaneous Expense', 'Expense', 'Other expenses not categorized above',  'Yes']
  ];
  defaultCats.forEach(function(cat) { categories.appendRow(cat); });
  categories.getRange('B2:B100').setDataValidation(ddl_(['Income', 'Expense']));
  categories.getRange('D2:D100').setDataValidation(ddl_(['Yes', 'No']));
  categories.setFrozenRows(1);

  // Link Categories to Ledger category dropdown
  var catNames = defaultCats.map(function(c) { return c[0]; });
  ledger.getRange('C2:C1000').setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInRange(categories.getRange('A2:A100'), true)
      .setAllowInvalid(true) // Allow custom categories
      .build()
  );

  // Financial Dashboard
  var dash = ss.insertSheet('Dashboard');
  var teal = '#2D5F5D';
  var rose = '#D4848A';

  dash.getRange('A1').setValue('Bloom & Shine — Financial Dashboard')
    .setFontFamily('Montserrat').setFontSize(18).setFontWeight('bold').setFontColor(teal);
  dash.getRange('A2').setValue('Auto-calculated from Ledger entries')
    .setFontColor('#999999').setFontSize(10).setFontStyle('italic');

  // YTD Summary
  dash.getRange('A4').setValue('YEAR TO DATE').setFontWeight('bold').setFontColor(teal).setFontSize(12);
  var ytdStats = [
    ['Total Income',     '=SUMIF(Ledger!B2:B,"Income",Ledger!G2:G)'],
    ['Total Expenses',   '=SUMIF(Ledger!B2:B,"Expense",Ledger!F2:F)'],
    ['Net Income',       '=B5-B6'],
    ['Transaction Count', '=COUNTA(Ledger!A2:A)']
  ];
  for (var i = 0; i < ytdStats.length; i++) {
    dash.getRange('A' + (5 + i)).setValue(ytdStats[i][0]).setFontWeight('bold').setFontColor('#555');
    dash.getRange('B' + (5 + i)).setFormula(ytdStats[i][1]).setFontWeight('bold').setFontSize(14);
  }
  dash.getRange('B5').setNumberFormat('$#,##0.00').setFontColor('#155724');
  dash.getRange('B6').setNumberFormat('$#,##0.00').setFontColor('#721C24');
  dash.getRange('B7').setNumberFormat('$#,##0.00').setFontColor(teal);

  // This Month
  dash.getRange('A10').setValue('THIS MONTH').setFontWeight('bold').setFontColor(teal).setFontSize(12);
  var monthStats = [
    ['Income',   '=SUMPRODUCT((MONTH(Ledger!A2:A)=MONTH(TODAY()))*(YEAR(Ledger!A2:A)=YEAR(TODAY()))*(Ledger!B2:B="Income")*(Ledger!G2:G))'],
    ['Expenses', '=SUMPRODUCT((MONTH(Ledger!A2:A)=MONTH(TODAY()))*(YEAR(Ledger!A2:A)=YEAR(TODAY()))*(Ledger!B2:B="Expense")*(Ledger!F2:F))'],
    ['Net',      '=B11-B12']
  ];
  for (var j = 0; j < monthStats.length; j++) {
    dash.getRange('A' + (11 + j)).setValue(monthStats[j][0]).setFontWeight('bold').setFontColor('#555');
    dash.getRange('B' + (11 + j)).setFormula(monthStats[j][1]).setFontWeight('bold').setFontSize(14);
  }
  dash.getRange('B11').setNumberFormat('$#,##0.00').setFontColor('#155724');
  dash.getRange('B12').setNumberFormat('$#,##0.00').setFontColor('#721C24');
  dash.getRange('B13').setNumberFormat('$#,##0.00').setFontColor(teal);

  // Expense Breakdown
  dash.getRange('D4').setValue('EXPENSE BREAKDOWN (YTD)').setFontWeight('bold').setFontColor(teal).setFontSize(12);
  var expCats = defaultCats.filter(function(c) { return c[1] === 'Expense'; });
  for (var k = 0; k < expCats.length; k++) {
    dash.getRange('D' + (5 + k)).setValue(expCats[k][0]).setFontColor('#555');
    dash.getRange('E' + (5 + k)).setFormula('=SUMIF(Ledger!C2:C,"' + expCats[k][0] + '",Ledger!F2:F)')
      .setFontWeight('bold').setFontColor(rose).setNumberFormat('$#,##0.00');
  }

  dash.setColumnWidths(1, 1, 200);
  dash.setColumnWidths(2, 1, 120);
  dash.setColumnWidths(3, 1, 30);
  dash.setColumnWidths(4, 1, 200);
  dash.setColumnWidths(5, 1, 120);

  var prot = dash.protect().setDescription('Dashboard — auto-calculated');
  prot.setWarningOnly(true);

  // Move dashboard first
  ss.setActiveSheet(dash);
  ss.moveActiveSheet(1);

  return id;
}

function buildDashboard_(sheet) {
  var teal = '#2D5F5D';
  var rose = '#D4848A';

  sheet.getRange('A1').setValue('Bloom & Shine — CRM Dashboard')
    .setFontFamily('Montserrat').setFontSize(18).setFontWeight('bold').setFontColor(teal);
  sheet.getRange('A2').setValue('Auto-updated from website submissions')
    .setFontColor('#999999').setFontSize(10).setFontStyle('italic');

  sheet.getRange('A4').setValue('SUMMARY').setFontWeight('bold').setFontColor(teal).setFontSize(12);
  var stats = [
    ['Total Contacts',    '=COUNTA(Contacts!A2:A)'],
    ['New (Uncontacted)', '=COUNTIF(Contacts!G2:G,"New")'],
    ['Total Estimates',   '=COUNTA(Estimates!A2:A)'],
    ['Converted',         '=COUNTIF(Estimates!H2:H,TRUE)'],
    ['Active Contracts',  '=COUNTIF(Contracts!K2:K,"Active")'],
    ['Total Contracts',   '=COUNTA(Contracts!A2:A)'],
    ['Invoices Sent',     '=COUNTIF(Invoices!H2:H,"Sent")'],
    ['Invoices Paid',     '=COUNTIF(Invoices!H2:H,"Paid")'],
    ['Revenue (Paid)',    '=SUMIF(Invoices!H2:H,"Paid",Invoices!F2:F)'],
    ['Outstanding',       '=SUMIF(Invoices!H2:H,"Sent",Invoices!F2:F)']
  ];
  for (var i = 0; i < stats.length; i++) {
    sheet.getRange('A' + (5 + i)).setValue(stats[i][0]).setFontWeight('bold').setFontColor('#555');
    sheet.getRange('B' + (5 + i)).setFormula(stats[i][1]).setFontWeight('bold').setFontColor(teal).setFontSize(14);
  }
  sheet.getRange('B13').setNumberFormat('$#,##0.00');
  sheet.getRange('B14').setNumberFormat('$#,##0.00');

  sheet.getRange('A16').setValue('THIS WEEK').setFontWeight('bold').setFontColor(teal).setFontSize(12);
  var week = [
    ['New contacts',     '=COUNTIFS(Contacts!A2:A,">="&(TODAY()-WEEKDAY(TODAY(),2)+1),Contacts!A2:A,"<="&TODAY())'],
    ['Estimates',        '=COUNTIFS(Estimates!A2:A,">="&(TODAY()-WEEKDAY(TODAY(),2)+1),Estimates!A2:A,"<="&TODAY())'],
    ['Contracts signed', '=COUNTIFS(Contracts!A2:A,">="&(TODAY()-WEEKDAY(TODAY(),2)+1),Contracts!A2:A,"<="&TODAY())']
  ];
  for (var j = 0; j < week.length; j++) {
    sheet.getRange('A' + (17 + j)).setValue(week[j][0]).setFontWeight('bold').setFontColor('#555');
    sheet.getRange('B' + (17 + j)).setFormula(week[j][1]).setFontWeight('bold').setFontColor(rose).setFontSize(14);
  }

  sheet.getRange('A21').setValue('FOLLOW-UPS DUE').setFontWeight('bold').setFontColor(teal).setFontSize(12);
  sheet.getRange('A22').setValue('Overdue').setFontColor('#555');
  sheet.getRange('B22').setFormula('=COUNTIFS(Contacts!I2:I,"<"&TODAY(),Contacts!I2:I,"<>""",Contacts!G2:G,"<>Completed",Contacts!G2:G,"<>Lost")')
    .setFontWeight('bold').setFontColor(rose).setFontSize(14);
  sheet.getRange('A23').setValue('Due today').setFontColor('#555');
  sheet.getRange('B23').setFormula('=COUNTIFS(Contacts!I2:I,TODAY(),Contacts!G2:G,"<>Completed",Contacts!G2:G,"<>Lost")')
    .setFontWeight('bold').setFontColor(teal).setFontSize(14);

  sheet.getRange('D4').setValue('SERVICE BREAKDOWN').setFontWeight('bold').setFontColor(teal).setFontSize(12);
  var services = ['Standard Cleaning', 'Deep Cleaning', 'Move In/Out', 'Commercial & Office', 'Construction & Real Estate', 'Church & Ministry', 'Professional Organization'];
  for (var s = 0; s < services.length; s++) {
    sheet.getRange('D' + (5 + s)).setValue(services[s]).setFontColor('#555');
    sheet.getRange('E' + (5 + s)).setFormula('=COUNTIF(Contacts!E2:E,"' + services[s] + '")+COUNTIF(Estimates!B2:B,"' + services[s] + '")')
      .setFontWeight('bold').setFontColor(teal);
  }

  sheet.setColumnWidths(1, 1, 220);
  sheet.setColumnWidths(2, 1, 100);
  sheet.setColumnWidths(3, 1, 30);
  sheet.setColumnWidths(4, 1, 220);
  sheet.setColumnWidths(5, 1, 80);
  sheet.protect().setDescription('Dashboard — auto-calculated').setWarningOnly(true);
}

// ============================================
// ADMIN UTILITIES (run from editor)
// ============================================

function viewConfig() {
  var props = PropertiesService.getScriptProperties().getProperties();
  var secrets = ['ENCRYPTION_SALT', 'SESSION_SECRET'];
  var safe = {};
  for (var k in props) safe[k] = secrets.indexOf(k) >= 0 ? '••••••••' : props[k];
  Logger.log(JSON.stringify(safe, null, 2));
  SpreadsheetApp.getUi().alert(Object.keys(safe).map(function(k) { return k + ': ' + safe[k]; }).join('\n'));
}

function updateConfig() {
  var ui = SpreadsheetApp.getUi();
  var key = prompt_(ui, 'Key', 'Property name (e.g., NOTIFICATION_EMAIL):');
  if (!key) return;
  if (['ENCRYPTION_SALT', 'SESSION_SECRET'].indexOf(key.toUpperCase()) >= 0) {
    ui.alert('Use rotateSecrets() for encryption keys.'); return;
  }
  var current = PropertiesService.getScriptProperties().getProperty(key.toUpperCase());
  var value = prompt_(ui, 'Value', 'Current: ' + (current || '(not set)') + '\nNew value:');
  if (value === null) return;
  PropertiesService.getScriptProperties().setProperty(key.toUpperCase(), value);
  logAudit_('Config updated: ' + key.toUpperCase());
}

function rotateSecrets() {
  var ui = SpreadsheetApp.getUi();
  if (ui.alert('⚠️ Rotate Secrets', 'This invalidates ALL sessions and passwords.\n\nContinue?', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  var props = PropertiesService.getScriptProperties();
  props.setProperty('ENCRYPTION_SALT', genSalt_());
  props.setProperty('SESSION_SECRET', genSalt_());

  // Clear sessions
  var adminId = props.getProperty('ADMIN_SPREADSHEET_ID');
  if (adminId) {
    var ss = SpreadsheetApp.openById(adminId);
    var sess = ss.getSheetByName('_Sessions');
    if (sess && sess.getLastRow() > 1) sess.getRange(2, 1, sess.getLastRow() - 1, sess.getLastColumn()).clear();
    var users = ss.getSheetByName('_Users');
    if (users && users.getLastRow() > 1) users.getRange(2, 5, users.getLastRow() - 1, 1).setValue('Yes');
  }
  logAudit_('Secrets rotated — all sessions invalidated');
  ui.alert('✅ Done. All users must reset passwords.');
}

function addUser() {
  var ui = SpreadsheetApp.getUi();
  var email = prompt_(ui, 'Email', 'New user email:');
  if (!email) return;
  var name = prompt_(ui, 'Name', 'Display name:');
  if (!name) return;
  var role = ui.alert('Role', 'Owner (Yes) or Staff (No)?', ui.ButtonSet.YES_NO) === ui.Button.YES ? 'owner' : 'staff';
  var pw = prompt_(ui, 'Password', 'Temporary password:');
  if (!pw) return;

  var props = PropertiesService.getScriptProperties();
  var adminId = props.getProperty('ADMIN_SPREADSHEET_ID');
  var ss = SpreadsheetApp.openById(adminId);
  var sheet = ss.getSheetByName('_Users');
  sheet.appendRow([email.trim().toLowerCase(), name.trim(), role, hashPw_(pw, props.getProperty('ENCRYPTION_SALT')), 'Yes', 'false', new Date().toISOString(), 'active']);
  logAudit_('User added via editor: ' + email);
  ui.alert('✅ User added: ' + email + ' (' + role + ')');
}

function resetPassword() {
  var ui = SpreadsheetApp.getUi();
  var email = prompt_(ui, 'Email', 'User email to reset:');
  if (!email) return;
  var pw = prompt_(ui, 'Password', 'New temporary password:');
  if (!pw) return;

  var props = PropertiesService.getScriptProperties();
  var ss = SpreadsheetApp.openById(props.getProperty('ADMIN_SPREADSHEET_ID'));
  var sheet = ss.getSheetByName('_Users');
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0].toLowerCase() === email.trim().toLowerCase()) {
      sheet.getRange(i + 1, 4).setValue(hashPw_(pw, props.getProperty('ENCRYPTION_SALT')));
      sheet.getRange(i + 1, 5).setValue('Yes');
      logAudit_('Password reset via editor: ' + email);
      ui.alert('✅ Password reset for ' + email);
      return;
    }
  }
  ui.alert('User not found.');
}

// ============================================
// HELPERS
// ============================================

function getOrCreate_(ss, name) { return ss.getSheetByName(name) || ss.insertSheet(name); }

function fmtHeader_(sheet, cols) {
  sheet.getRange(1, 1, 1, cols).setBackground('#2D5F5D').setFontColor('#FFF')
    .setFontFamily('Montserrat').setFontWeight('bold').setFontSize(10).setVerticalAlignment('middle');
  sheet.setRowHeight(1, 36);
  var band = sheet.getRange(2, 1, 998, cols);
  if (band.getBandings().length === 0)
    band.applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY).setHeaderRowColor('#2D5F5D').setFirstRowColor('#FFF').setSecondRowColor('#FDF8F0');
}

function ddl_(values) {
  return SpreadsheetApp.newDataValidation().requireValueInList(values, true).setAllowInvalid(false).build();
}

function statusColors_(sheet, col) {
  var r = sheet.getRange(2, col, 998, 1);
  var rules = sheet.getConditionalFormatRules();
  var c = {
    'New':['#F2D7D9','#9B2C3E'],'Contacted':['#D4EDDA','#155724'],'Quoted':['#CCE5FF','#004085'],
    'Booked':['#B7C9A8','#1B3A36'],'Active':['#B7C9A8','#1B3A36'],'Completed':['#E2E3E5','#383D41'],
    'Paid':['#D4EDDA','#155724'],'Sent':['#CCE5FF','#004085'],'Overdue':['#F8D7DA','#721C24'],
    'Lost':['#E2E3E5','#999'],'Terminated':['#E2E3E5','#999'],'Void':['#E2E3E5','#999'],
    'Paused':['#FFF3CD','#856404'],'Draft':['#FFF3CD','#856404']
  };
  for (var s in c) rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(s).setBackground(c[s][0]).setFontColor(c[s][1]).setBold(true).setRanges([r]).build());
  sheet.setConditionalFormatRules(rules);
}

function protect_(sheet) {
  var p = sheet.protect().setDescription('Protected — script access only');
  var me = Session.getEffectiveUser();
  p.addEditor(me);
  p.removeEditors(p.getEditors());
  p.addEditor(me);
}

function hashPw_(pw, salt) {
  var d = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + ':' + pw);
  return d.map(function(b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join('');
}

function genSalt_() {
  var b = []; for (var i = 0; i < 32; i++) b.push(Math.floor(Math.random() * 256));
  return Utilities.base64Encode(b);
}

function prompt_(ui, title, msg) {
  var r = ui.prompt(title, msg, ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return null;
  var t = r.getResponseText().trim();
  if (!t) { ui.alert('Value cannot be empty.'); return null; }
  return t;
}

function clearTriggers_() { ScriptApp.getProjectTriggers().forEach(function(t) { ScriptApp.deleteTrigger(t); }); }

function logAudit_(event, actor) {
  try {
    var adminId = PropertiesService.getScriptProperties().getProperty('ADMIN_SPREADSHEET_ID');
    if (!adminId) return;
    var ss = SpreadsheetApp.openById(adminId);
    var sheet = ss.getSheetByName('_Audit');
    if (sheet) sheet.appendRow([new Date(), event, '', actor || Session.getEffectiveUser().getEmail()]);
  } catch(e) {}
}
