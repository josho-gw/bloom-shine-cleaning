/**
 * Bloom & Shine Cleaning Services
 * Google Apps Script — CRM Backend
 *
 * This script is deployed as a web app and receives POST requests
 * from the website's contact form, estimator, and contract system.
 * It logs all data to a Google Sheet and sends email notifications.
 *
 * SETUP INSTRUCTIONS:
 * 1. Create a new Google Sheet
 * 2. Create three tabs/sheets: "Contacts", "Estimates", "Contracts"
 * 3. Add column headers to each tab (see below)
 * 4. Go to Extensions > Apps Script
 * 5. Paste this code, replacing the default Code.gs
 * 6. Click Deploy > New deployment > Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 7. Copy the deployment URL
 * 8. Paste the URL into js/sheets.js SHEETS_CONFIG.scriptUrl
 * 9. Set SHEETS_CONFIG.enabled = true
 *
 * COLUMN HEADERS:
 *
 * Contacts tab:
 * Timestamp | Name | Email | Phone | Service Interest | Message | Status
 *
 * Estimates tab:
 * Timestamp | Service | Sq Ft | Frequency | Add-Ons | Low Estimate | High Estimate
 *
 * Contracts tab:
 * Timestamp | Name | Email | Phone | Address | Service | Frequency | Media Release | Signed | Signed Date | Status
 */

// Configuration
const NOTIFICATION_EMAIL = 'bloom.shinecleaningservices@yahoo.com';
const SPREADSHEET_ID = ''; // Set to your Google Sheet ID after creating it

// ============================================
// GET HANDLER (Admin Dashboard data retrieval)
// ============================================

function doGet(e) {
  try {
    var action = e.parameter.action || 'ping';
    var ss = SPREADSHEET_ID
      ? SpreadsheetApp.openById(SPREADSHEET_ID)
      : SpreadsheetApp.getActiveSpreadsheet();

    if (action === 'ping') {
      return jsonResponse({ result: 'pong' });
    }

    if (action === 'getAll') {
      var contacts = getSheetData(ss, 'Contacts');
      var estimates = getSheetData(ss, 'Estimates');
      var contracts = getSheetData(ss, 'Contracts');

      return jsonResponse({
        result: 'success',
        contacts: contacts,
        estimates: estimates,
        contracts: contracts
      });
    }

    if (action === 'getSheet') {
      var sheetName = e.parameter.sheet || 'Contacts';
      var data = getSheetData(ss, sheetName);
      return jsonResponse({ result: 'success', data: data });
    }

    return jsonResponse({ result: 'error', message: 'Unknown action' });

  } catch (error) {
    return jsonResponse({ result: 'error', message: error.toString() });
  }
}

function getSheetData(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return []; // Only header row
  return sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================
// POST HANDLER (Form submissions)
// ============================================

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var source = data.source || 'contact';
    var ss = SPREADSHEET_ID
      ? SpreadsheetApp.openById(SPREADSHEET_ID)
      : SpreadsheetApp.getActiveSpreadsheet();

    switch (source) {
      case 'contact':
        logContact(ss, data);
        sendContactNotification(data);
        break;
      case 'estimate':
        logEstimate(ss, data);
        break;
      case 'contract':
        logContract(ss, data);
        sendContractNotification(data);
        break;
      case 'password_reset':
        sendPasswordResetEmail(data);
        break;
      default:
        logContact(ss, data);
    }

    return ContentService.createTextOutput(
      JSON.stringify({ result: 'success' })
    ).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(
      JSON.stringify({ result: 'error', message: error.toString() })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

// ============================================
// LOGGING FUNCTIONS
// ============================================

function logContact(ss, data) {
  var sheet = ss.getSheetByName('Contacts');
  if (!sheet) {
    sheet = ss.insertSheet('Contacts');
    sheet.appendRow(['Timestamp', 'Name', 'Email', 'Phone', 'Service Interest', 'Message', 'Status']);
  }
  sheet.appendRow([
    new Date(),
    data.name || '',
    data.email || '',
    data.phone || '',
    data.service || '',
    data.message || '',
    'New'
  ]);
}

function logEstimate(ss, data) {
  var sheet = ss.getSheetByName('Estimates');
  if (!sheet) {
    sheet = ss.insertSheet('Estimates');
    sheet.appendRow(['Timestamp', 'Service', 'Sq Ft', 'Frequency', 'Add-Ons', 'Low Estimate', 'High Estimate']);
  }
  sheet.appendRow([
    new Date(),
    data.service || '',
    data.sqft || '',
    data.frequency || '',
    data.addons || '',
    data.estimateLow || '',
    data.estimateHigh || ''
  ]);
}

function logContract(ss, data) {
  var sheet = ss.getSheetByName('Contracts');
  if (!sheet) {
    sheet = ss.insertSheet('Contracts');
    sheet.appendRow(['Timestamp', 'Name', 'Email', 'Phone', 'Address', 'Service', 'Frequency', 'Media Release', 'Signed', 'Signed Date', 'Status']);
  }
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
    'New'
  ]);
}

// ============================================
// EMAIL NOTIFICATIONS
// ============================================

function sendContactNotification(data) {
  var subject = '🌸 New Contact — ' + (data.name || 'Unknown');
  var body = 'New contact form submission from your website!\n\n' +
    'Name: ' + (data.name || 'Not provided') + '\n' +
    'Email: ' + (data.email || 'Not provided') + '\n' +
    'Phone: ' + (data.phone || 'Not provided') + '\n' +
    'Service: ' + (data.service || 'Not specified') + '\n' +
    'Message: ' + (data.message || 'No message') + '\n\n' +
    'This message was sent from your Bloom & Shine website.';

  MailApp.sendEmail(NOTIFICATION_EMAIL, subject, body);
}

function sendContractNotification(data) {
  var subject = '🌸 New Agreement Signed — ' + (data.name || 'Unknown');
  var body = 'A new service agreement has been signed on your website!\n\n' +
    'Client: ' + (data.name || 'Not provided') + '\n' +
    'Email: ' + (data.email || 'Not provided') + '\n' +
    'Phone: ' + (data.phone || 'Not provided') + '\n' +
    'Address: ' + (data.address || 'Not provided') + '\n' +
    'Service: ' + (data.service || 'Not specified') + '\n' +
    'Frequency: ' + (data.frequency || 'Not specified') + '\n' +
    'Media Release: ' + (data.mediaRelease || 'No') + '\n' +
    'Signed Date: ' + (data.signedDate || 'Unknown') + '\n\n' +
    'The client has downloaded a PDF copy of the agreement.\n' +
    'Please review and follow up to schedule their service.\n\n' +
    'This notification was sent from your Bloom & Shine website.';

  MailApp.sendEmail(NOTIFICATION_EMAIL, subject, body);
}

function sendPasswordResetEmail(data) {
  if (!data.email || !data.code) return;

  var subject = '🔐 Bloom & Shine — Password Reset Code';
  var body = 'Hi ' + (data.name || 'there') + ',\n\n' +
    'A password reset was requested for your Bloom & Shine admin account.\n\n' +
    'Your reset code is: ' + data.code + '\n\n' +
    'This code expires in 30 minutes.\n\n' +
    'If you did not request this reset, you can safely ignore this email.\n\n' +
    '— Bloom & Shine Cleaning Services';

  MailApp.sendEmail(data.email, subject, body);
}

// ============================================
// TEST FUNCTION (for Apps Script editor testing)
// ============================================

function testDoPost() {
  var testData = {
    postData: {
      contents: JSON.stringify({
        source: 'contact',
        name: 'Test User',
        email: 'test@example.com',
        phone: '555-0123',
        service: 'Standard Cleaning',
        message: 'This is a test submission.'
      })
    }
  };

  var result = doPost(testData);
  Logger.log(result.getContent());
}
