/**
 * Bloom & Shine Cleaning Services
 * Admin Dashboard
 *
 * Handles: passcode login, tab navigation, Google Sheets data display,
 * settings management, and session persistence.
 */

// ============================================
// AUTHENTICATION
// ============================================

// Default passcode hash (SHA-256 of "bloom2025")
// Change this on first login via Settings
const DEFAULT_PASSCODE_HASH = '7a3d4c8f2e1b9a6d5c4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b';
const SESSION_KEY = 'bloomshine_admin_session';
const SESSION_DURATION = 4 * 60 * 60 * 1000; // 4 hours

/**
 * Generate SHA-256 hash of a string
 */
async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Check if user has a valid session
 */
function checkSession() {
  const session = localStorage.getItem(SESSION_KEY);
  if (!session) return false;

  try {
    const { expiry } = JSON.parse(session);
    if (Date.now() < expiry) {
      showDashboard();
      return true;
    }
    localStorage.removeItem(SESSION_KEY);
  } catch (e) {
    localStorage.removeItem(SESSION_KEY);
  }
  return false;
}

/**
 * Attempt login with passcode
 */
async function attemptLogin(e) {
  e.preventDefault();
  const input = document.getElementById('login-passcode');
  const error = document.getElementById('login-error');
  const passcode = input.value.trim();

  if (!passcode) return;

  const hash = await sha256(passcode);
  const storedHash = localStorage.getItem('bloomshine_passcode_hash') || DEFAULT_PASSCODE_HASH;

  // On first use, accept the default passcode "bloom2025"
  const defaultCheck = await sha256('bloom2025');
  const isValid = hash === storedHash || (storedHash === DEFAULT_PASSCODE_HASH && hash === defaultCheck);

  if (isValid) {
    // If using placeholder default hash, store the real hash
    if (storedHash === DEFAULT_PASSCODE_HASH) {
      localStorage.setItem('bloomshine_passcode_hash', defaultCheck);
    }

    const session = { expiry: Date.now() + SESSION_DURATION };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    error.classList.add('hidden');
    showDashboard();
  } else {
    error.classList.remove('hidden');
    input.value = '';
    input.focus();
  }
}

/**
 * Log out and show login screen
 */
function adminLogout() {
  localStorage.removeItem(SESSION_KEY);
  document.getElementById('admin-dashboard').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('login-passcode').value = '';
}

/**
 * Show the dashboard and hide login
 */
function showDashboard() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('admin-dashboard').classList.remove('hidden');
  loadAdminSettings();
  loadDashboardData();
  initInvoiceTab();
}

// ============================================
// TAB NAVIGATION
// ============================================

function switchTab(tabName) {
  // Hide all tab content
  document.querySelectorAll('.tab-content').forEach(tc => tc.classList.add('hidden'));

  // Deactivate all tab buttons
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));

  // Show selected tab content
  const content = document.getElementById(`tab-${tabName}`);
  if (content) content.classList.remove('hidden');

  // Activate selected tab button
  const btn = document.querySelector(`.admin-tab[data-tab="${tabName}"]`);
  if (btn) btn.classList.add('active');

  // Initialize invoice tab when switching to it
  if (tabName === 'invoices') {
    initInvoiceTab();
  }
}

// ============================================
// DATA LOADING FROM GOOGLE SHEETS
// ============================================

async function loadDashboardData() {
  if (!SHEETS_CONFIG.enabled || !SHEETS_CONFIG.scriptUrl) {
    return;
  }

  try {
    const response = await fetch(`${SHEETS_CONFIG.scriptUrl}?action=getAll`, {
      method: 'GET'
    });
    const data = await response.json();

    if (data.result === 'success') {
      renderContactsTable(data.contacts || []);
      renderEstimatesTable(data.estimates || []);
      renderContractsTable(data.contracts || []);
      renderOverviewStats(data);
      renderRecentActivity(data);
    }
  } catch (err) {
    console.error('[Admin] Failed to load data:', err);
  }
}

async function refreshData(tab) {
  await loadDashboardData();
}

// ============================================
// TABLE RENDERERS
// ============================================

function renderContactsTable(contacts) {
  const tbody = document.getElementById('contacts-table-body');
  if (!tbody) return;

  document.getElementById('stat-contacts').textContent = contacts.length;

  if (contacts.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="px-4 py-8 text-center text-gray-400 italic">No contacts yet.</td></tr>';
    return;
  }

  tbody.innerHTML = contacts.reverse().map(row => `
    <tr class="border-t border-gray-100 hover:bg-cream/50 transition-colors">
      <td class="px-4 py-3 text-gray-500 text-xs">${formatDate(row[0])}</td>
      <td class="px-4 py-3 font-medium">${escHtml(row[1])}</td>
      <td class="px-4 py-3"><a href="mailto:${escHtml(row[2])}" class="text-teal hover:underline">${escHtml(row[2])}</a></td>
      <td class="px-4 py-3"><a href="tel:${escHtml(row[3])}" class="text-teal hover:underline">${escHtml(row[3])}</a></td>
      <td class="px-4 py-3 text-gray-600">${escHtml(row[4])}</td>
      <td class="px-4 py-3"><span class="status-badge status-${(row[6] || 'new').toLowerCase()}">${escHtml(row[6] || 'New')}</span></td>
    </tr>
  `).join('');
}

function renderEstimatesTable(estimates) {
  const tbody = document.getElementById('estimates-table-body');
  if (!tbody) return;

  document.getElementById('stat-estimates').textContent = estimates.length;

  if (estimates.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="px-4 py-8 text-center text-gray-400 italic">No estimates yet.</td></tr>';
    return;
  }

  tbody.innerHTML = estimates.reverse().map(row => `
    <tr class="border-t border-gray-100 hover:bg-cream/50 transition-colors">
      <td class="px-4 py-3 text-gray-500 text-xs">${formatDate(row[0])}</td>
      <td class="px-4 py-3 font-medium">${escHtml(row[1])}</td>
      <td class="px-4 py-3">${escHtml(row[2])}</td>
      <td class="px-4 py-3">${escHtml(row[3])}</td>
      <td class="px-4 py-3 text-gray-500 text-xs">${escHtml(row[4])}</td>
      <td class="px-4 py-3 font-semibold text-rose">$${escHtml(row[5])} – $${escHtml(row[6])}</td>
    </tr>
  `).join('');
}

function renderContractsTable(contracts) {
  const tbody = document.getElementById('contracts-table-body');
  if (!tbody) return;

  document.getElementById('stat-contracts').textContent = contracts.length;

  if (contracts.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="px-4 py-8 text-center text-gray-400 italic">No contracts yet.</td></tr>';
    return;
  }

  tbody.innerHTML = contracts.reverse().map(row => `
    <tr class="border-t border-gray-100 hover:bg-cream/50 transition-colors">
      <td class="px-4 py-3 text-gray-500 text-xs">${formatDate(row[0])}</td>
      <td class="px-4 py-3 font-medium">${escHtml(row[1])}</td>
      <td class="px-4 py-3">${escHtml(row[5])}</td>
      <td class="px-4 py-3">${escHtml(row[6])}</td>
      <td class="px-4 py-3 text-xs">${row[7] === 'yes' ? 'Consented' : 'Declined'}</td>
      <td class="px-4 py-3"><span class="status-badge status-${(row[10] || 'new').toLowerCase()}">${escHtml(row[10] || 'New')}</span></td>
    </tr>
  `).join('');
}

function renderOverviewStats(data) {
  document.getElementById('stat-contacts').textContent = (data.contacts || []).length;
  document.getElementById('stat-estimates').textContent = (data.estimates || []).length;
  document.getElementById('stat-contracts').textContent = (data.contracts || []).length;
}

function renderRecentActivity(data) {
  const container = document.getElementById('recent-activity');
  if (!container) return;

  // Combine all entries with type labels, take most recent 10
  const all = [];

  (data.contacts || []).forEach(row => {
    all.push({ type: 'contact', date: row[0], name: row[1], detail: row[4] || 'General inquiry' });
  });
  (data.estimates || []).forEach(row => {
    all.push({ type: 'estimate', date: row[0], name: 'Website visitor', detail: `${row[1]} — $${row[5]}–$${row[6]}` });
  });
  (data.contracts || []).forEach(row => {
    all.push({ type: 'contract', date: row[0], name: row[1], detail: `${row[5]} (${row[6]})` });
  });

  // Sort by date descending
  all.sort((a, b) => new Date(b.date) - new Date(a.date));
  const recent = all.slice(0, 10);

  if (recent.length === 0) {
    container.innerHTML = '<p class="text-gray-400 text-sm italic">No activity yet. Submissions will appear here.</p>';
    return;
  }

  const typeIcons = {
    contact: { bg: 'var(--color-blush-light)', color: 'text-rose', label: 'Contact' },
    estimate: { bg: 'var(--color-sage-light)', color: 'text-teal', label: 'Estimate' },
    contract: { bg: 'var(--color-cream)', color: 'text-gold', label: 'Contract' }
  };

  container.innerHTML = recent.map(item => {
    const icon = typeIcons[item.type];
    return `
      <div class="flex items-center gap-3 p-3 rounded-lg hover:bg-cream/50 transition-colors">
        <div class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style="background: ${icon.bg};">
          <span class="text-xs font-bold ${icon.color}">${icon.label.charAt(0)}</span>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium truncate">${escHtml(item.name)}</p>
          <p class="text-xs text-gray-400 truncate">${escHtml(item.detail)}</p>
        </div>
        <span class="text-xs text-gray-400 flex-shrink-0">${formatDate(item.date)}</span>
      </div>
    `;
  }).join('');
}

// ============================================
// SETTINGS
// ============================================

function loadAdminSettings() {
  const savedUrl = localStorage.getItem('bloomshine_script_url');
  if (savedUrl) {
    SHEETS_CONFIG.scriptUrl = savedUrl;
    SHEETS_CONFIG.enabled = true;
    const urlInput = document.getElementById('settings-script-url');
    if (urlInput) urlInput.value = savedUrl;
  }
}

function saveSettings() {
  const url = document.getElementById('settings-script-url').value.trim();
  const status = document.getElementById('settings-status');

  if (url) {
    localStorage.setItem('bloomshine_script_url', url);
    SHEETS_CONFIG.scriptUrl = url;
    SHEETS_CONFIG.enabled = true;
    status.textContent = 'Settings saved. Google Sheets connection is active.';
    status.style.color = 'var(--color-teal)';
    loadDashboardData();
  } else {
    localStorage.removeItem('bloomshine_script_url');
    SHEETS_CONFIG.scriptUrl = '';
    SHEETS_CONFIG.enabled = false;
    status.textContent = 'Connection removed.';
    status.style.color = 'var(--color-gray-400)';
  }
}

async function testConnection() {
  const status = document.getElementById('settings-status');
  status.textContent = 'Testing connection...';
  status.style.color = 'var(--color-gray-400)';

  try {
    const url = document.getElementById('settings-script-url').value.trim();
    if (!url) {
      status.textContent = 'Please enter an Apps Script URL first.';
      status.style.color = 'var(--color-rose)';
      return;
    }

    const response = await fetch(`${url}?action=ping`);
    const data = await response.json();

    if (data.result === 'pong') {
      status.textContent = 'Connection successful!';
      status.style.color = 'var(--color-teal)';
    } else {
      status.textContent = 'Connected, but unexpected response. Check your Apps Script.';
      status.style.color = 'var(--color-gold)';
    }
  } catch (err) {
    status.textContent = `Connection failed: ${err.message}`;
    status.style.color = 'var(--color-rose)';
  }
}

async function changePasscode() {
  const current = document.getElementById('settings-current-pass').value;
  const newPass = document.getElementById('settings-new-pass').value;
  const confirm = document.getElementById('settings-confirm-pass').value;
  const status = document.getElementById('passcode-status');

  if (!current || !newPass || !confirm) {
    status.textContent = 'Please fill in all fields.';
    status.style.color = 'var(--color-rose)';
    return;
  }

  if (newPass !== confirm) {
    status.textContent = 'New passcodes do not match.';
    status.style.color = 'var(--color-rose)';
    return;
  }

  if (newPass.length < 4) {
    status.textContent = 'Passcode must be at least 4 characters.';
    status.style.color = 'var(--color-rose)';
    return;
  }

  const currentHash = await sha256(current);
  const storedHash = localStorage.getItem('bloomshine_passcode_hash') || await sha256('bloom2025');

  if (currentHash !== storedHash) {
    status.textContent = 'Current passcode is incorrect.';
    status.style.color = 'var(--color-rose)';
    return;
  }

  const newHash = await sha256(newPass);
  localStorage.setItem('bloomshine_passcode_hash', newHash);

  status.textContent = 'Passcode updated successfully!';
  status.style.color = 'var(--color-teal)';

  // Clear fields
  document.getElementById('settings-current-pass').value = '';
  document.getElementById('settings-new-pass').value = '';
  document.getElementById('settings-confirm-pass').value = '';
}

// ============================================
// INVOICE TAB INITIALIZATION
// ============================================

function initInvoiceTab() {
  const invNumber = document.getElementById('inv-number');
  const invDate = document.getElementById('inv-date');

  if (invNumber && !invNumber.value) {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    invNumber.value = `BS-${dateStr}-001`;
  }

  if (invDate && !invDate.value) {
    invDate.value = new Date().toISOString().slice(0, 10);
  }

  if (typeof invoiceLineItems !== 'undefined' && invoiceLineItems.length === 0) {
    addInvoiceLineItem();
  }
}

// ============================================
// UTILITIES
// ============================================

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch (e) {
    return dateStr;
  }
}

function escHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

// ============================================
// INIT
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  checkSession();
});
