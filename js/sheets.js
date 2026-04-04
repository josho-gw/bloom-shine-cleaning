/**
 * Bloom & Shine Cleaning Services
 * Google Apps Script Integration Helper
 *
 * Handles all POST requests to the Google Apps Script web app
 * which serves as the CRM backend (Google Sheets + email notifications).
 */

// URL configured via admin dashboard Settings tab
const SHEETS_CONFIG = {
  scriptUrl: '',
  enabled: false
};

// Load from admin settings if available
(function() {
  const saved = localStorage.getItem('bloomshine_script_url');
  if (saved) { SHEETS_CONFIG.scriptUrl = saved; SHEETS_CONFIG.enabled = true; }
})();

/**
 * Submit data to Google Apps Script backend
 * @param {Object} data - The data to submit
 * @param {string} source - The source identifier (contact, estimate, contract)
 * @returns {Promise<Object>}
 */
async function submitToSheet(data, source = 'contact') {
  if (!SHEETS_CONFIG.enabled || !SHEETS_CONFIG.scriptUrl) {
    return { result: 'skipped', reason: 'Backend not configured' };
  }

  const payload = {
    ...data,
    source,
    timestamp: new Date().toISOString()
  };

  try {
    const response = await fetch(SHEETS_CONFIG.scriptUrl, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'text/plain' } // text/plain avoids CORS preflight
    });

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('[Sheets] Submission error:', error);
    // Don't block the user experience on backend failure
    return { result: 'error', message: error.message };
  }
}

/**
 * Submit contact form data
 */
async function submitContact(formData) {
  return submitToSheet({
    name: formData.name,
    email: formData.email,
    phone: formData.phone,
    service: formData.service,
    message: formData.message
  }, 'contact');
}

/**
 * Submit estimate data for lead tracking
 */
async function submitEstimate(estimateData) {
  return submitToSheet({
    service: estimateData.service,
    sqft: estimateData.sqft,
    frequency: estimateData.frequency,
    addons: estimateData.addons.join(', '),
    estimateLow: estimateData.low,
    estimateHigh: estimateData.high
  }, 'estimate');
}

/**
 * Submit signed contract data
 */
async function submitContractData(contractData) {
  return submitToSheet({
    name: contractData.name,
    email: contractData.email,
    phone: contractData.phone,
    address: contractData.address,
    service: contractData.service,
    frequency: contractData.frequency,
    mediaRelease: contractData.mediaRelease,
    signed: true,
    signedDate: contractData.date
  }, 'contract');
}
