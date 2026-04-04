/**
 * ============================================================
 * Bloom & Shine Cleaning Services — Setup & Administration
 * ============================================================
 *
 * Run setup() once from the Apps Script editor to provision
 * the entire CRM + Admin backend. All sensitive configuration
 * is stored in Script Properties (server-side, never exposed).
 *
 * After setup: Deploy > New deployment > Web app
 * ============================================================
 */

// ============================================
// MAIN SETUP — Run this once
// ============================================

function setup() {
  var ui = SpreadsheetApp.getUi();

  // Step 1: Collect configuration via prompts
  var ownerEmail = promptFor_(ui, 'Owner Email', 'Enter the business owner\'s Gmail address (for notifications and login):');
  if (!ownerEmail) return;

  var devEmail = promptFor_(ui, 'Developer Email', 'Enter the developer\'s email address (for sheet access and login):');
  if (!devEmail) return;

  var defaultPassword = promptFor_(ui, 'Default Password', 'Set a temporary default password for both accounts (they will be forced to change it):');
  if (!defaultPassword) return;

  // Step 2: Store configuration in Script Properties
  var props = PropertiesService.getScriptProperties();
  var salt = generateSalt_();
  var sessionSecret = generateSalt_();

  props.setProperties({
    'OWNER_EMAIL': ownerEmail.trim().toLowerCase(),
    'OWNER_NAME': 'Owner',
    'DEV_EMAIL': devEmail.trim().toLowerCase(),
    'DEV_NAME': 'Developer',
    'NOTIFICATION_EMAIL': ownerEmail.trim().toLowerCase(),
    'ENCRYPTION_SALT': salt,
    'SESSION_SECRET': sessionSecret,
    'TIMEZONE': 'America/New_York',
    'SETUP_COMPLETE': 'true',
    'SETUP_DATE': new Date().toISOString()
  });

  // Step 3: Build spreadsheet structure
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.rename('Bloom & Shine — CRM');

  buildCRMTabs_(ss);
  buildAdminTabs_(ss, ownerEmail.trim().toLowerCase(), devEmail.trim().toLowerCase(), defaultPassword, salt);
  buildDashboard_(ss);

  // Clean up default sheet
  var defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1) {
    ss.deleteSheet(defaultSheet);
  }

  // Move Dashboard first
  var dashboard = ss.getSheetByName('Dashboard');
  if (dashboard) { ss.setActiveSheet(dashboard); ss.moveActiveSheet(1); }

  // Step 4: Share with developer
  try {
    ss.addEditor(devEmail.trim());
  } catch (e) {
    Logger.log('Could not share with dev: ' + e.message);
  }

  // Step 5: Set up triggers
  clearAllTriggers_();

  ScriptApp.newTrigger('sendDailyDigest')
    .timeBased()
    .atHour(7)
    .everyDays(1)
    .inTimezone(props.getProperty('TIMEZONE'))
    .create();

  ScriptApp.newTrigger('sendWeeklySummary')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(8)
    .inTimezone(props.getProperty('TIMEZONE'))
    .create();

  ScriptApp.newTrigger('cleanExpiredSessions')
    .timeBased()
    .everyHours(1)
    .create();

  // Done
  ui.alert(
    '✅ Setup Complete!\n\n' +
    'Accounts created:\n' +
    '  • ' + ownerEmail + ' (Owner)\n' +
    '  • ' + devEmail + ' (Developer)\n\n' +
    'Both accounts use the temporary password you set.\n' +
    'They will be forced to change it on first login.\n\n' +
    'Next step:\n' +
    '  1. Deploy → New deployment → Web app\n' +
    '  2. Execute as: Me | Access: Anyone\n' +
    '  3. Copy the URL into the admin dashboard Settings tab'
  );
}

// ============================================
// ADMIN PROPERTY MANAGEMENT
// ============================================

/**
 * View all non-secret Script Properties (run from editor)
 */
function viewConfig() {
  var props = PropertiesService.getScriptProperties().getProperties();
  var safe = {};
  var secrets = ['ENCRYPTION_SALT', 'SESSION_SECRET'];

  for (var key in props) {
    safe[key] = secrets.indexOf(key) >= 0 ? '••••••••' : props[key];
  }

  Logger.log('=== Current Configuration ===');
  Logger.log(JSON.stringify(safe, null, 2));

  SpreadsheetApp.getUi().alert(
    'Current Configuration:\n\n' +
    Object.keys(safe).map(function(k) { return k + ': ' + safe[k]; }).join('\n')
  );
}

/**
 * Update a single configuration property (run from editor)
 */
function updateConfig() {
  var ui = SpreadsheetApp.getUi();
  var key = promptFor_(ui, 'Property Key', 'Enter the property name to update (e.g., NOTIFICATION_EMAIL, TIMEZONE, OWNER_NAME):');
  if (!key) return;

  var secrets = ['ENCRYPTION_SALT', 'SESSION_SECRET'];
  if (secrets.indexOf(key.toUpperCase()) >= 0) {
    ui.alert('Cannot modify secrets directly. Use rotateSecrets() instead.');
    return;
  }

  var current = PropertiesService.getScriptProperties().getProperty(key.toUpperCase());
  var value = promptFor_(ui, 'New Value', 'Current value: ' + (current || '(not set)') + '\n\nEnter new value:');
  if (value === null) return;

  PropertiesService.getScriptProperties().setProperty(key.toUpperCase(), value);
  logAudit_('Config updated: ' + key.toUpperCase(), 'Manual update via editor');
  ui.alert('✅ Updated ' + key.toUpperCase() + ' = ' + value);
}

/**
 * Rotate encryption salt and session secret.
 * WARNING: This invalidates all existing sessions and passwords.
 */
function rotateSecrets() {
  var ui = SpreadsheetApp.getUi();
  var confirm = ui.alert(
    '⚠️ Rotate Secrets',
    'This will:\n• Invalidate ALL existing sessions\n• Require ALL users to reset their passwords\n\nAre you sure?',
    ui.ButtonSet.YES_NO
  );

  if (confirm !== ui.Button.YES) return;

  var props = PropertiesService.getScriptProperties();
  props.setProperty('ENCRYPTION_SALT', generateSalt_());
  props.setProperty('SESSION_SECRET', generateSalt_());

  // Clear sessions
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sessionsSheet = ss.getSheetByName('_Sessions');
  if (sessionsSheet && sessionsSheet.getLastRow() > 1) {
    sessionsSheet.getRange(2, 1, sessionsSheet.getLastRow() - 1, sessionsSheet.getLastColumn()).clear();
  }

  // Mark all users as needing password change
  var usersSheet = ss.getSheetByName('_Users');
  if (usersSheet && usersSheet.getLastRow() > 1) {
    var numUsers = usersSheet.getLastRow() - 1;
    usersSheet.getRange(2, 7, numUsers, 1).setValue('Yes'); // mustChangePassword column
  }

  logAudit_('Secrets rotated', 'All sessions invalidated, all users must reset passwords');
  ui.alert('✅ Secrets rotated. All users must reset their passwords.');
}

/**
 * Add a new admin user via the editor
 */
function addUser() {
  var ui = SpreadsheetApp.getUi();
  var email = promptFor_(ui, 'User Email', 'Enter the new user\'s email address:');
  if (!email) return;

  var name = promptFor_(ui, 'User Name', 'Enter the user\'s display name:');
  if (!name) return;

  var roleResponse = ui.alert('Select Role', 'Is this user an Owner (Yes) or Staff (No)?', ui.ButtonSet.YES_NO);
  var role = (roleResponse === ui.Button.YES) ? 'owner' : 'staff';

  var password = promptFor_(ui, 'Temporary Password', 'Set a temporary password (user will be forced to change it):');
  if (!password) return;

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var usersSheet = ss.getSheetByName('_Users');
  if (!usersSheet) { ui.alert('Error: _Users sheet not found. Run setup() first.'); return; }

  var salt = PropertiesService.getScriptProperties().getProperty('ENCRYPTION_SALT');
  var hash = hashPassword_(password, salt);

  usersSheet.appendRow([
    email.trim().toLowerCase(),
    name.trim(),
    role,
    hash,
    'Yes',     // mustChangePassword
    'false',   // protected
    new Date().toISOString(),
    'active'
  ]);

  logAudit_('User added: ' + email, 'Role: ' + role + ', added via editor');
  ui.alert('✅ User added: ' + email + ' (' + role + ')\nTemporary password set. They must change it on first login.');
}

/**
 * Reset a user's password via the editor
 */
function resetPassword() {
  var ui = SpreadsheetApp.getUi();
  var email = promptFor_(ui, 'User Email', 'Enter the email of the user to reset:');
  if (!email) return;

  var newPassword = promptFor_(ui, 'New Temporary Password', 'Enter a temporary password:');
  if (!newPassword) return;

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var usersSheet = ss.getSheetByName('_Users');
  if (!usersSheet) return;

  var data = usersSheet.getDataRange().getValues();
  var salt = PropertiesService.getScriptProperties().getProperty('ENCRYPTION_SALT');

  for (var i = 1; i < data.length; i++) {
    if (data[i][0].toLowerCase() === email.trim().toLowerCase()) {
      usersSheet.getRange(i + 1, 4).setValue(hashPassword_(newPassword, salt));
      usersSheet.getRange(i + 1, 5).setValue('Yes');
      logAudit_('Password reset: ' + email, 'Reset via editor');
      ui.alert('✅ Password reset for ' + email + '. They must change it on next login.');
      return;
    }
  }

  ui.alert('User not found: ' + email);
}

// ============================================
// SHEET BUILDERS
// ============================================

function buildCRMTabs_(ss) {
  // Contacts
  var contacts = getOrCreate_(ss, 'Contacts');
  contacts.clear();
  contacts.appendRow(['Timestamp', 'Name', 'Email', 'Phone', 'Service Interest', 'Message', 'Status', 'Notes', 'Follow-Up Date']);
  formatHeader_(contacts, 9);
  contacts.setColumnWidths(1, 1, 140);
  contacts.setColumnWidths(2, 1, 160);
  contacts.setColumnWidths(3, 1, 220);
  contacts.setColumnWidths(4, 1, 130);
  contacts.setColumnWidths(5, 1, 160);
  contacts.setColumnWidths(6, 1, 300);
  contacts.setColumnWidths(7, 1, 100);
  contacts.setColumnWidths(8, 1, 200);
  contacts.setColumnWidths(9, 1, 120);
  contacts.getRange('G2:G1000').setDataValidation(dropdown_(['New', 'Contacted', 'Quoted', 'Booked', 'Completed', 'Lost']));
  addStatusColors_(contacts, 7);
  contacts.getRange('A2:A1000').setNumberFormat('MM/dd/yyyy hh:mm a');
  contacts.getRange('I2:I1000').setNumberFormat('MM/dd/yyyy');
  contacts.setFrozenRows(1);

  // Estimates
  var estimates = getOrCreate_(ss, 'Estimates');
  estimates.clear();
  estimates.appendRow(['Timestamp', 'Service', 'Sq Ft', 'Frequency', 'Add-Ons', 'Low Estimate', 'High Estimate', 'Converted']);
  formatHeader_(estimates, 8);
  estimates.setColumnWidths(1, 1, 140);
  estimates.setColumnWidths(2, 1, 180);
  estimates.setColumnWidths(5, 1, 200);
  estimates.setColumnWidths(6, 2, 110);
  estimates.getRange('F2:G1000').setNumberFormat('$#,##0');
  estimates.getRange('H2:H1000').insertCheckboxes();
  estimates.getRange('A2:A1000').setNumberFormat('MM/dd/yyyy hh:mm a');
  estimates.setFrozenRows(1);

  // Contracts
  var contracts = getOrCreate_(ss, 'Contracts');
  contracts.clear();
  contracts.appendRow(['Timestamp', 'Name', 'Email', 'Phone', 'Address', 'Service', 'Frequency', 'Media Release', 'Signed', 'Signed Date', 'Status', 'Notes']);
  formatHeader_(contracts, 12);
  contracts.setColumnWidths(1, 1, 140);
  contracts.setColumnWidths(2, 1, 160);
  contracts.setColumnWidths(3, 1, 220);
  contracts.setColumnWidths(5, 1, 250);
  contracts.setColumnWidths(6, 1, 180);
  contracts.getRange('K2:K1000').setDataValidation(dropdown_(['New', 'Active', 'Paused', 'Terminated', 'Completed']));
  addStatusColors_(contracts, 11);
  contracts.getRange('A2:A1000').setNumberFormat('MM/dd/yyyy hh:mm a');
  contracts.getRange('J2:J1000').setNumberFormat('MM/dd/yyyy');
  contracts.setFrozenRows(1);

  // Invoices
  var invoices = getOrCreate_(ss, 'Invoices');
  invoices.clear();
  invoices.appendRow(['Invoice #', 'Date', 'Client Name', 'Client Email', 'Service', 'Amount', 'Payment Method', 'Status', 'Paid Date', 'Notes']);
  formatHeader_(invoices, 10);
  invoices.setColumnWidths(1, 1, 130);
  invoices.setColumnWidths(3, 1, 160);
  invoices.setColumnWidths(4, 1, 220);
  invoices.setColumnWidths(5, 1, 180);
  invoices.getRange('F2:F1000').setNumberFormat('$#,##0.00');
  invoices.getRange('G2:G1000').setDataValidation(dropdown_(['Venmo', 'Cash App', 'Cash']));
  invoices.getRange('H2:H1000').setDataValidation(dropdown_(['Draft', 'Sent', 'Paid', 'Overdue', 'Void']));
  addStatusColors_(invoices, 8);
  invoices.getRange('B2:B1000').setNumberFormat('MM/dd/yyyy');
  invoices.getRange('I2:I1000').setNumberFormat('MM/dd/yyyy');
  invoices.setFrozenRows(1);

  // Activity Log
  var activity = getOrCreate_(ss, 'Activity Log');
  activity.clear();
  activity.appendRow(['Timestamp', 'Type', 'Summary', 'Details']);
  formatHeader_(activity, 4);
  activity.setColumnWidths(1, 1, 160);
  activity.setColumnWidths(2, 1, 120);
  activity.setColumnWidths(3, 1, 300);
  activity.setColumnWidths(4, 1, 400);
  activity.getRange('A2:A1000').setNumberFormat('MM/dd/yyyy hh:mm a');
  activity.setFrozenRows(1);
}

function buildAdminTabs_(ss, ownerEmail, devEmail, defaultPassword, salt) {
  // _Users — server-side user store
  var users = getOrCreate_(ss, '_Users');
  users.clear();
  users.appendRow(['Email', 'Name', 'Role', 'Password Hash', 'Must Change PW', 'Protected', 'Created', 'Status']);
  formatHeader_(users, 8);
  users.setColumnWidths(1, 1, 250);
  users.setColumnWidths(2, 1, 160);
  users.setColumnWidths(3, 1, 100);
  users.setColumnWidths(4, 1, 300);
  users.setFrozenRows(1);

  // Seed accounts
  var devHash = hashPassword_(defaultPassword, salt);
  var ownerHash = hashPassword_(defaultPassword, salt);

  users.appendRow([devEmail, 'Developer', 'developer', devHash, 'Yes', 'true', new Date().toISOString(), 'active']);
  users.appendRow([ownerEmail, 'Owner', 'owner', ownerHash, 'Yes', 'false', new Date().toISOString(), 'active']);

  // Protect the sheet
  protectSheet_(users, 'User credentials — script access only');

  // _Sessions — active sessions
  var sessions = getOrCreate_(ss, '_Sessions');
  sessions.clear();
  sessions.appendRow(['Token', 'Email', 'Role', 'Created', 'Expires', 'IP/UA']);
  formatHeader_(sessions, 6);
  sessions.setFrozenRows(1);
  protectSheet_(sessions, 'Active sessions — script access only');

  // _Settings — key-value store for runtime config
  var settings = getOrCreate_(ss, '_Settings');
  settings.clear();
  settings.appendRow(['Key', 'Value', 'Updated']);
  formatHeader_(settings, 3);
  settings.setColumnWidths(1, 1, 200);
  settings.setColumnWidths(2, 1, 400);
  settings.appendRow(['session_duration_hours', '4', new Date().toISOString()]);
  settings.appendRow(['max_login_attempts', '5', new Date().toISOString()]);
  settings.appendRow(['lockout_minutes', '15', new Date().toISOString()]);
  settings.appendRow(['reset_code_expiry_minutes', '30', new Date().toISOString()]);
  settings.setFrozenRows(1);
  protectSheet_(settings, 'System settings — script access only');

  // _Audit — security audit trail
  var audit = getOrCreate_(ss, '_Audit');
  audit.clear();
  audit.appendRow(['Timestamp', 'Event', 'Details', 'Actor']);
  formatHeader_(audit, 4);
  audit.setColumnWidths(1, 1, 160);
  audit.setColumnWidths(2, 1, 250);
  audit.setColumnWidths(3, 1, 400);
  audit.setColumnWidths(4, 1, 200);
  audit.getRange('A2:A1000').setNumberFormat('MM/dd/yyyy hh:mm a');
  audit.setFrozenRows(1);
  protectSheet_(audit, 'Security audit log — script access only');

  logAudit_('System initialized', 'Setup completed. Owner: ' + ownerEmail + ', Dev: ' + devEmail);
}

function buildDashboard_(ss) {
  var sheet = getOrCreate_(ss, 'Dashboard');
  sheet.clear();

  var teal = '#2D5F5D';
  var rose = '#D4848A';

  sheet.getRange('A1').setValue('Bloom & Shine — Business Dashboard')
    .setFontFamily('Montserrat').setFontSize(18).setFontWeight('bold').setFontColor(teal);
  sheet.getRange('A2').setValue('Auto-updated from website submissions')
    .setFontColor('#999999').setFontSize(10).setFontStyle('italic');

  // Summary
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

  // This Week
  sheet.getRange('A16').setValue('THIS WEEK').setFontWeight('bold').setFontColor(teal).setFontSize(12);
  var week = [
    ['New contacts',    '=COUNTIFS(Contacts!A2:A,">="&(TODAY()-WEEKDAY(TODAY(),2)+1),Contacts!A2:A,"<="&TODAY())'],
    ['Estimates',       '=COUNTIFS(Estimates!A2:A,">="&(TODAY()-WEEKDAY(TODAY(),2)+1),Estimates!A2:A,"<="&TODAY())'],
    ['Contracts signed','=COUNTIFS(Contracts!A2:A,">="&(TODAY()-WEEKDAY(TODAY(),2)+1),Contracts!A2:A,"<="&TODAY())']
  ];
  for (var j = 0; j < week.length; j++) {
    sheet.getRange('A' + (17 + j)).setValue(week[j][0]).setFontWeight('bold').setFontColor('#555');
    sheet.getRange('B' + (17 + j)).setFormula(week[j][1]).setFontWeight('bold').setFontColor(rose).setFontSize(14);
  }

  // Follow-ups
  sheet.getRange('A21').setValue('FOLLOW-UPS DUE').setFontWeight('bold').setFontColor(teal).setFontSize(12);
  sheet.getRange('A22').setValue('Overdue').setFontColor('#555');
  sheet.getRange('B22').setFormula('=COUNTIFS(Contacts!I2:I,"<"&TODAY(),Contacts!I2:I,"<>""",Contacts!G2:G,"<>Completed",Contacts!G2:G,"<>Lost")')
    .setFontWeight('bold').setFontColor(rose).setFontSize(14);
  sheet.getRange('A23').setValue('Due today').setFontColor('#555');
  sheet.getRange('B23').setFormula('=COUNTIFS(Contacts!I2:I,TODAY(),Contacts!G2:G,"<>Completed",Contacts!G2:G,"<>Lost")')
    .setFontWeight('bold').setFontColor(teal).setFontSize(14);

  // Service breakdown
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

  var protection = sheet.protect().setDescription('Dashboard — auto-calculated');
  protection.setWarningOnly(true);
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function getOrCreate_(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function formatHeader_(sheet, numCols) {
  var range = sheet.getRange(1, 1, 1, numCols);
  range.setBackground('#2D5F5D').setFontColor('#FFFFFF')
    .setFontFamily('Montserrat').setFontWeight('bold').setFontSize(10)
    .setVerticalAlignment('middle');
  sheet.setRowHeight(1, 36);

  // Banding
  var bandRange = sheet.getRange(2, 1, 998, numCols);
  if (bandRange.getBandings().length === 0) {
    bandRange.applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY)
      .setHeaderRowColor('#2D5F5D')
      .setFirstRowColor('#FFFFFF')
      .setSecondRowColor('#FDF8F0');
  }
}

function dropdown_(values) {
  return SpreadsheetApp.newDataValidation()
    .requireValueInList(values, true)
    .setAllowInvalid(false)
    .build();
}

function addStatusColors_(sheet, col) {
  var range = sheet.getRange(2, col, 998, 1);
  var rules = sheet.getConditionalFormatRules();
  var colors = {
    'New': ['#F2D7D9', '#9B2C3E'], 'Contacted': ['#D4EDDA', '#155724'],
    'Quoted': ['#CCE5FF', '#004085'], 'Booked': ['#B7C9A8', '#1B3A36'],
    'Active': ['#B7C9A8', '#1B3A36'], 'Completed': ['#E2E3E5', '#383D41'],
    'Paid': ['#D4EDDA', '#155724'], 'Sent': ['#CCE5FF', '#004085'],
    'Overdue': ['#F8D7DA', '#721C24'], 'Lost': ['#E2E3E5', '#999999'],
    'Terminated': ['#E2E3E5', '#999999'], 'Void': ['#E2E3E5', '#999999'],
    'Paused': ['#FFF3CD', '#856404'], 'Draft': ['#FFF3CD', '#856404']
  };
  for (var status in colors) {
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo(status).setBackground(colors[status][0])
      .setFontColor(colors[status][1]).setBold(true).setRanges([range]).build());
  }
  sheet.setConditionalFormatRules(rules);
}

function protectSheet_(sheet, description) {
  var protection = sheet.protect().setDescription(description);
  // Remove all editors except the script owner
  var me = Session.getEffectiveUser();
  protection.addEditor(me);
  protection.removeEditors(protection.getEditors());
  protection.addEditor(me);
}

function hashPassword_(password, salt) {
  var raw = salt + ':' + password;
  var hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw);
  return hash.map(function(b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join('');
}

function generateSalt_() {
  var bytes = [];
  for (var i = 0; i < 32; i++) {
    bytes.push(Math.floor(Math.random() * 256));
  }
  return Utilities.base64Encode(bytes);
}

function promptFor_(ui, title, message) {
  var response = ui.prompt(title, message, ui.ButtonSet.OK_CANCEL);
  if (response.getSelectedButton() !== ui.Button.OK) return null;
  var text = response.getResponseText().trim();
  if (!text) { ui.alert('Value cannot be empty.'); return null; }
  return text;
}

function clearAllTriggers_() {
  ScriptApp.getProjectTriggers().forEach(function(t) { ScriptApp.deleteTrigger(t); });
}

function logAudit_(event, details) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('_Audit');
    if (sheet) {
      sheet.appendRow([new Date(), event, details, Session.getEffectiveUser().getEmail()]);
    }
  } catch (e) {
    Logger.log('Audit log error: ' + e.message);
  }
}
