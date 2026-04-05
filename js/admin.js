/**
 * Bloom & Shine Cleaning Services
 * Admin Dashboard — Client
 *
 * All authentication and data operations are server-side via Google Apps Script.
 * This client holds only a session token in localStorage.
 */

// ============================================
// STATE
// ============================================

const SESSION_KEY = 'bloomshine_session';
const DEBUG_KEY = 'bloomshine_debug';
let currentUser = null;
let apiUrl = '';

// Toggle debug mode: localStorage.setItem('bloomshine_debug', 'true')
function isDebug() { return localStorage.getItem(DEBUG_KEY) === 'true'; }

function dbg(label, ...args) {
  if (isDebug()) console.log(`%c[BS:${label}]`, 'color:#2D5F5D;font-weight:bold', ...args);
}

// ============================================
// API HELPER
// ============================================

async function api(action, data = {}) {
  const url = apiUrl || localStorage.getItem('bloomshine_script_url') || '';
  if (!url) {
    dbg('API', 'No URL configured');
    return { result: 'error', code: 'NO_URL', message: 'API not configured. Set the Apps Script URL in Settings.' };
  }

  const token = getToken();
  const startTime = performance.now();

  if (data && typeof data === 'object' && Object.keys(data).length > 0) {
    // POST
    const payload = { ...data, action, token };
    dbg('API', `POST → ${action}`, isDebug() ? payload : '');
    try {
      const res = await fetch(url, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'text/plain' }
      });
      const result = await res.json();
      dbg('API', `POST ← ${action} (${Math.round(performance.now() - startTime)}ms)`, result.result, isDebug() ? result : '');
      return result;
    } catch (err) {
      dbg('API', `POST ✗ ${action}`, err.message);
      console.error('[Admin] API error:', err);
      return { result: 'error', message: err.message };
    }
  } else {
    // GET
    const params = new URLSearchParams({ action });
    if (token) params.set('token', token);
    dbg('API', `GET → ${action}`);
    try {
      const res = await fetch(`${url}?${params}`);
      const result = await res.json();
      dbg('API', `GET ← ${action} (${Math.round(performance.now() - startTime)}ms)`, result.result);
      return result;
    } catch (err) {
      dbg('API', `GET ✗ ${action}`, err.message);
      console.error('[Admin] API error:', err);
      return { result: 'error', message: err.message };
    }
  }
}

// ============================================
// SESSION
// ============================================

function getToken() {
  const session = localStorage.getItem(SESSION_KEY);
  if (!session) return null;
  try {
    const s = JSON.parse(session);
    return s.token || null;
  } catch (e) {
    return null;
  }
}

function saveSession(token, user) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ token, user }));
  currentUser = user;
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  currentUser = null;
}

function loadSession() {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw);
    currentUser = s.user;
    return s;
  } catch (e) {
    return null;
  }
}

// ============================================
// LOGIN
// ============================================

async function attemptLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errorEl = document.getElementById('login-error');
  const btn = e.target.querySelector('button[type="submit"]');

  if (!email || !password) {
    showError(errorEl, 'Please enter both email and password.');
    return;
  }

  // Check API URL
  const url = localStorage.getItem('bloomshine_script_url');
  if (!url) {
    showError(errorEl, 'API not configured. Enter the Apps Script URL first.');
    document.getElementById('login-setup').classList.remove('hidden');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Signing in...';

  const result = await api('login', { email, password });

  btn.disabled = false;
  btn.textContent = 'Sign In';

  if (result.result === 'success') {
    saveSession(result.token, result.user);
    errorEl.classList.add('hidden');

    if (result.user.mustChangePassword) {
      showScreen('force-change-screen');
    } else {
      showDashboard();
    }
  } else {
    showError(errorEl, result.message || 'Login failed.');
    document.getElementById('login-password').value = '';
  }
}

async function adminLogout() {
  await api('logout', {});
  clearSession();
  showScreen('login-screen');
  document.getElementById('login-email').value = '';
  document.getElementById('login-password').value = '';
  document.getElementById('login-error').classList.add('hidden');
}

// ============================================
// FORCE PASSWORD CHANGE
// ============================================

async function submitForceChange(e) {
  e.preventDefault();
  const newPw = document.getElementById('force-new-pass').value;
  const confirmPw = document.getElementById('force-confirm-pass').value;
  const status = document.getElementById('force-change-status');

  if (!newPw || !confirmPw) { showError(status, 'Please fill in both fields.'); return; }
  if (newPw.length < 6) { showError(status, 'Password must be at least 6 characters.'); return; }
  if (newPw !== confirmPw) { showError(status, 'Passwords do not match.'); return; }

  const result = await api('changePassword', { newPassword: newPw });

  if (result.result === 'success') {
    currentUser.mustChangePassword = false;
    saveSession(getToken(), currentUser);
    showDashboard();
  } else {
    showError(status, result.message || 'Failed to change password.');
  }
}

// ============================================
// FORGOT PASSWORD
// ============================================

async function submitForgotPassword(e) {
  e.preventDefault();
  const email = document.getElementById('forgot-email').value.trim();
  const status = document.getElementById('forgot-status');

  if (!email) { showError(status, 'Please enter your email.'); return; }

  const result = await api('forgot', { email });

  status.textContent = 'If an account exists with that email, a reset code has been sent.';
  status.style.color = 'var(--color-teal)';

  document.getElementById('forgot-step-1').classList.add('hidden');
  document.getElementById('forgot-step-2').classList.remove('hidden');
  document.getElementById('forgot-reset-email').value = email;
}

async function submitResetCode(e) {
  e.preventDefault();
  const email = document.getElementById('forgot-reset-email').value.trim();
  const code = document.getElementById('forgot-code').value.trim();
  const newPw = document.getElementById('forgot-new-pass').value;
  const confirmPw = document.getElementById('forgot-confirm-pass').value;
  const status = document.getElementById('reset-status');

  if (!code || !newPw || !confirmPw) { showError(status, 'All fields required.'); return; }
  if (newPw.length < 6) { showError(status, 'Password must be at least 6 characters.'); return; }
  if (newPw !== confirmPw) { showError(status, 'Passwords do not match.'); return; }

  const result = await api('resetPassword', { email, code, newPassword: newPw });

  if (result.result === 'success') {
    status.textContent = 'Password reset! Redirecting...';
    status.style.color = 'var(--color-teal)';
    setTimeout(() => {
      showScreen('login-screen');
      document.getElementById('login-email').value = email;
    }, 1500);
  } else {
    showError(status, result.message || 'Reset failed.');
  }
}

function showForgotPassword() {
  document.getElementById('forgot-step-1').classList.remove('hidden');
  document.getElementById('forgot-step-2').classList.add('hidden');
  document.getElementById('forgot-email').value = '';
  document.getElementById('forgot-status').textContent = '';
  document.getElementById('reset-status').textContent = '';
  showScreen('forgot-screen');
}

// ============================================
// API URL SETUP (first-time)
// ============================================

function saveApiUrl() {
  const url = document.getElementById('login-api-url').value.trim();
  if (!url) return;
  localStorage.setItem('bloomshine_script_url', url);
  apiUrl = url;
  document.getElementById('login-setup').classList.add('hidden');
  document.getElementById('login-error').classList.add('hidden');
}

// ============================================
// SCREEN MANAGEMENT
// ============================================

function showScreen(id) {
  ['login-screen', 'force-change-screen', 'forgot-screen', 'admin-dashboard'].forEach(s => {
    const el = document.getElementById(s);
    if (el) el.classList.toggle('hidden', s !== id);
  });
}

function showDashboard() {
  showScreen('admin-dashboard');

  const nameEl = document.getElementById('admin-user-display');
  const roleEl = document.getElementById('admin-role-display');
  if (nameEl && currentUser) nameEl.textContent = currentUser.name;
  if (roleEl && currentUser) {
    const labels = { developer: 'Developer', owner: 'Owner', staff: 'Staff' };
    roleEl.textContent = labels[currentUser.role] || currentUser.role;
  }

  // Role-based visibility
  const canManage = currentUser && (currentUser.role === 'developer' || currentUser.role === 'owner');
  document.querySelectorAll('[data-role="manager"]').forEach(el => el.classList.toggle('hidden', !canManage));
  document.querySelectorAll('[data-role="developer"]').forEach(el => {
    el.classList.toggle('hidden', !currentUser || currentUser.role !== 'developer');
  });

  loadAllData();
  initInvoiceTab();
}

function showError(el, msg) {
  el.textContent = msg;
  el.style.color = 'var(--color-rose)';
  el.classList.remove('hidden');
}

// ============================================
// TAB NAVIGATION
// ============================================

function switchTab(tabName) {
  const managerTabs = ['users', 'finance'];
  if (managerTabs.includes(tabName) && currentUser && currentUser.role !== 'developer' && currentUser.role !== 'owner') return;

  document.querySelectorAll('.tab-content').forEach(tc => tc.classList.add('hidden'));
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));

  const content = document.getElementById(`tab-${tabName}`);
  if (content) content.classList.remove('hidden');

  const btn = document.querySelector(`.admin-tab[data-tab="${tabName}"]`);
  if (btn) btn.classList.add('active');

  if (tabName === 'invoices') initInvoiceTab();
  if (tabName === 'users') loadUsers();
  if (tabName === 'finance') loadFinanceData();
}

// ============================================
// DATA LOADING
// ============================================

async function loadAllData() {
  const url = localStorage.getItem('bloomshine_script_url');
  if (!url) return;

  const result = await api('getAll');
  if (result.result !== 'success') {
    if (result.code === 'UNAUTHORIZED') { clearSession(); showScreen('login-screen'); }
    return;
  }

  // Store globally for contact detail lookups
  window._crmData = result;

  renderTable('contacts', result.contacts || [], ['Timestamp', 'Name', 'Email', 'Phone', 'Service Interest', 'Status']);
  renderTable('estimates', result.estimates || [], ['Timestamp', 'Service', 'Sq Ft', 'Frequency', 'Add-Ons', 'Low Estimate', 'High Estimate']);
  renderTable('contracts', result.contracts || [], ['Timestamp', 'Name', 'Service', 'Frequency', 'Media Release', 'Status']);
  renderTable('invoices', result.invoices || [], ['Invoice #', 'Date', 'Client Name', 'Service', 'Amount', 'Status']);
  renderOverview(result);
}

async function refreshData() {
  await loadAllData();
}

// ============================================
// TABLE RENDERING — Search + Sort + Edit
// ============================================

// Per-table state: raw data, columns, current sort/search
const tableState = {};
const sheetMap = { contacts: 'Contacts', estimates: 'Estimates', contracts: 'Contracts', invoices: 'Invoices' };

function renderTable(tabId, rows, columns) {
  // Store state for re-renders on sort/search
  tableState[tabId] = {
    rows: rows,
    columns: columns,
    sortCol: null,
    sortDir: null, // 'asc' or 'desc'
    search: ''
  };

  // Update stat counters
  const stat = document.getElementById(`stat-${tabId}`);
  if (stat) stat.textContent = rows.length;

  // Inject search input if not already present
  let searchEl = document.getElementById(`${tabId}-search`);
  if (!searchEl) {
    const container = document.getElementById(`${tabId}-table-body`);
    if (container) {
      const tableWrapper = container.closest('.overflow-x-auto') || container.closest('.overflow-auto');
      if (tableWrapper && tableWrapper.parentElement) {
        const searchDiv = document.createElement('div');
        searchDiv.className = 'px-4 py-3 border-b border-gray-100';
        searchDiv.innerHTML = `
          <div class="relative max-w-xs">
            <svg class="absolute w-4 h-4" style="left:0.75rem;top:50%;transform:translateY(-50%);color:var(--color-gray-400);pointer-events:none;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            <input type="text" id="${tabId}-search" class="form-input text-sm" style="padding-left:2.25rem;padding-top:0.5rem;padding-bottom:0.5rem;" placeholder="Search..." oninput="handleTableSearch('${tabId}', this.value)">
          </div>`;
        tableWrapper.parentElement.insertBefore(searchDiv, tableWrapper);
      }
    }
  }

  // Make headers sortable
  const thead = document.querySelector(`#${tabId}-table-body`)?.closest('table')?.querySelector('thead tr');
  if (thead) {
    const ths = thead.querySelectorAll('th');
    let colIdx = 0;
    ths.forEach(th => {
      const text = th.textContent.trim();
      if (text && colIdx < columns.length) {
        const col = columns[colIdx];
        th.setAttribute('data-sort', col);
        th.setAttribute('data-tab', tabId);
        th.onclick = function() { handleTableSort(tabId, col); };
        colIdx++;
      }
    });
  }

  renderTableRows(tabId);
}

function renderTableRows(tabId) {
  const state = tableState[tabId];
  if (!state) return;

  const tbody = document.getElementById(`${tabId}-table-body`);
  if (!tbody) return;

  let rows = [...state.rows];

  // Apply search filter
  if (state.search) {
    const q = state.search.toLowerCase();
    rows = rows.filter(row => {
      return state.columns.some(col => {
        const val = String(row[col] || '').toLowerCase();
        return val.includes(q);
      });
    });
  }

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${state.columns.length + 1}" class="px-4 py-8 text-center text-gray-400 italic">${state.search ? 'No matching results.' : 'No data yet.'}</td></tr>`;
    return;
  }

  // Apply sort
  if (state.sortCol) {
    const col = state.sortCol;
    const dir = state.sortDir === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      let va = a[col], vb = b[col];
      // Numeric sort for amounts
      if (col === 'Amount' || col === 'Low Estimate' || col === 'High Estimate') {
        return (Number(va) - Number(vb)) * dir;
      }
      // Date sort
      if (col === 'Timestamp' || col === 'Date' || col === 'Signed Date') {
        return (new Date(va || 0) - new Date(vb || 0)) * dir;
      }
      // String sort
      va = String(va || '').toLowerCase();
      vb = String(vb || '').toLowerCase();
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  } else {
    // Default sort: invoices oldest-first, others newest-first
    const dateCol = rows[0].Timestamp !== undefined ? 'Timestamp' : (rows[0].Date !== undefined ? 'Date' : null);
    if (dateCol) {
      const dir = tabId === 'invoices' ? 1 : -1;
      rows.sort((a, b) => (new Date(a[dateCol] || 0) - new Date(b[dateCol] || 0)) * dir);
    }
  }

  tbody.innerHTML = rows.map(row => {
    const cells = state.columns.map(col => {
      var val = row[col] !== undefined ? row[col] : '';
      if (col === 'Timestamp' || col === 'Signed Date') val = formatDate(val);
      if (col === 'Low Estimate' || col === 'High Estimate') val = val ? '$' + val : '';
      if (col === 'Status') return `<td class="px-4 py-3"><span class="status-badge status-${(val || 'new').toLowerCase()}">${esc(val || 'New')}</span></td>`;
      if (col === 'Email') return `<td class="px-4 py-3"><a href="mailto:${esc(val)}" class="text-teal hover:underline text-sm">${esc(val)}</a></td>`;
      if (col === 'Phone') return `<td class="px-4 py-3"><a href="tel:${esc(val)}" class="text-teal hover:underline">${esc(val)}</a></td>`;
      if ((col === 'Name' || col === 'Client Name') && tabId === 'contacts') {
        return `<td class="px-4 py-3 font-medium"><button onclick="openContactDetail(${row._row})" class="text-teal hover:underline font-medium text-left">${esc(val)}</button></td>`;
      }
      if (col === 'Amount') return `<td class="px-4 py-3 font-semibold text-sm">$${esc(String(val || 0))}</td>`;
      return `<td class="px-4 py-3 text-sm">${esc(val)}</td>`;
    }).join('');

    const editBtn = `<td class="px-4 py-3">
      <button onclick="openEditModal('${sheetMap[tabId]}', ${row._row})" class="text-xs text-teal hover:underline">Edit</button>
    </td>`;

    let rowClass = 'border-t border-gray-100 hover:bg-cream/50 transition-colors';
    if (tabId === 'invoices') {
      const status = row.Status || '';
      if (status === 'Paid') rowClass += ' bg-green-50';
      else if (status === 'Overdue') rowClass += ' bg-red-50';
      else if (status === 'Sent') rowClass += ' bg-yellow-50';
    }

    return `<tr class="${rowClass}">${cells}${editBtn}</tr>`;
  }).join('');
}

function handleTableSort(tabId, col) {
  const state = tableState[tabId];
  if (!state) return;

  // Toggle sort direction
  if (state.sortCol === col) {
    state.sortDir = state.sortDir === 'asc' ? 'desc' : (state.sortDir === 'desc' ? null : 'asc');
    if (!state.sortDir) state.sortCol = null;
  } else {
    state.sortCol = col;
    state.sortDir = 'asc';
  }

  // Update header indicators
  const table = document.getElementById(`${tabId}-table-body`)?.closest('table');
  if (table) {
    table.querySelectorAll('th[data-sort]').forEach(th => {
      th.classList.remove('sort-asc', 'sort-desc');
      if (th.dataset.sort === state.sortCol) {
        if (state.sortDir) th.classList.add('sort-' + state.sortDir);
      }
    });
  }

  renderTableRows(tabId);
}

function handleTableSearch(tabId, query) {
  const state = tableState[tabId];
  if (!state) return;
  state.search = query;
  renderTableRows(tabId);
}

async function renderOverview(data) {
  const contacts = data.contacts || [];
  const estimates = data.estimates || [];
  const contracts = data.contracts || [];
  const invoices = data.invoices || [];

  // CRM stat cards
  setText('stat-contacts', contacts.length);
  setText('stat-estimates', estimates.length);
  setText('stat-contracts', contracts.length);

  // Unpaid invoices count
  const unpaid = invoices.filter(i => i.Status && i.Status !== 'Paid' && i.Status !== 'Void' && i.Status !== 'Draft');
  setText('stat-unpaid', unpaid.length || '0');

  // Recent activity (last 8)
  const container = document.getElementById('recent-activity');
  if (container) {
    const all = [];
    contacts.forEach(r => all.push({ type: 'contact', date: r.Timestamp, name: r.Name, detail: r['Service Interest'] || 'General' }));
    estimates.forEach(r => all.push({ type: 'estimate', date: r.Timestamp, name: 'Visitor', detail: `${r.Service} — $${r['Low Estimate']}–$${r['High Estimate']}` }));
    contracts.forEach(r => all.push({ type: 'contract', date: r.Timestamp, name: r.Name, detail: `${r.Service} (${r.Frequency})` }));
    invoices.forEach(r => all.push({ type: 'invoice', date: r.Date, name: r['Client Name'], detail: `${r['Invoice #']} — $${r.Amount || 0} (${r.Status || 'Draft'})` }));

    all.sort((a, b) => new Date(b.date) - new Date(a.date));
    const recent = all.slice(0, 8);

    if (recent.length === 0) {
      container.innerHTML = '<p class="text-gray-400 text-sm italic">No activity yet.</p>';
    } else {
      const icons = {
        contact:  { bg: 'var(--color-blush-light)', cls: 'text-rose', l: 'C' },
        estimate: { bg: 'var(--color-sage-light)', cls: 'text-teal', l: 'E' },
        contract: { bg: 'var(--color-cream)', cls: 'text-gold', l: 'A' },
        invoice:  { bg: '#CCE5FF', cls: 'text-teal', l: 'I' }
      };
      container.innerHTML = recent.map(item => {
        const ic = icons[item.type];
        return `
          <div class="flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0">
            <div class="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style="background:${ic.bg}">
              <span class="text-xs font-bold ${ic.cls}">${ic.l}</span>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium truncate">${esc(item.name)}</p>
              <p class="text-xs text-gray-400 truncate">${esc(item.detail)}</p>
            </div>
            <span class="text-xs text-gray-400 flex-shrink-0">${formatDate(item.date)}</span>
          </div>`;
      }).join('');
    }
  }

  // Recent logins (dev/owner only — pull from sessions if available)
  const loginsContainer = document.getElementById('recent-logins');
  if (loginsContainer && currentUser && (currentUser.role === 'developer' || currentUser.role === 'owner')) {
    // Sessions aren't exposed via getAll, so show a placeholder until we add a dedicated endpoint
    loginsContainer.innerHTML = '<p class="text-gray-400 text-sm italic">Login history is recorded in the Admin workbook _Audit tab.</p>';
  }

  // Financial summary cards (dev/owner only)
  if (currentUser && (currentUser.role === 'developer' || currentUser.role === 'owner')) {
    const finRes = await api('getFinSummary');
    if (finRes.result === 'success') {
      setText('overview-mtd-income', '$' + (finRes.mtd.income || 0).toFixed(2));
      setText('overview-mtd-expense', '$' + (finRes.mtd.expense || 0).toFixed(2));
      setText('overview-mtd-net', '$' + (finRes.mtd.net || 0).toFixed(2));
      setText('overview-ytd-net', '$' + (finRes.ytd.net || 0).toFixed(2));

      const mtdNetEl = document.getElementById('overview-mtd-net');
      const ytdNetEl = document.getElementById('overview-ytd-net');
      if (mtdNetEl) mtdNetEl.style.color = finRes.mtd.net >= 0 ? '#155724' : '#721C24';
      if (ytdNetEl) ytdNetEl.style.color = finRes.ytd.net >= 0 ? '#155724' : '#721C24';
    }
  }
}

// ============================================
// INLINE EDIT MODAL
// ============================================

let editContext = {};

async function openEditModal(sheetName, rowNum) {
  editContext = { sheet: sheetName, row: rowNum };

  // Fetch fresh row data
  const result = await api(`get${sheetName.replace(/ /g, '')}`);
  if (result.result !== 'success') return;

  const rows = result.data || [];
  const rowData = rows.find(r => r._row === rowNum);
  if (!rowData) return;

  const modal = document.getElementById('edit-modal');
  const container = document.getElementById('edit-fields');
  const title = document.getElementById('edit-modal-title');

  title.textContent = `Edit ${sheetName} — Row ${rowNum}`;

  // Build form fields (skip _row and Timestamp)
  const skipFields = ['_row', 'Timestamp', 'Password Hash'];
  container.innerHTML = Object.keys(rowData).filter(k => skipFields.indexOf(k) < 0).map(key => {
    const val = rowData[key] !== undefined && rowData[key] !== null ? rowData[key] : '';
    return `
      <div>
        <label class="form-label">${esc(key)}</label>
        <input type="text" class="form-input edit-field" data-field="${esc(key)}" value="${esc(String(val))}">
      </div>`;
  }).join('');

  // Update delete/archive button based on context
  const deleteBtn = document.getElementById('edit-delete-btn');
  if (deleteBtn) {
    if (sheetName === 'Invoices') {
      deleteBtn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/></svg> Archive Invoice';
      deleteBtn.style.background = '#D97706';
      deleteBtn.onmouseover = function() { this.style.background = '#B45309'; };
      deleteBtn.onmouseout = function() { this.style.background = '#D97706'; };
    } else {
      deleteBtn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg> Delete Record';
      deleteBtn.style.background = '#DC3545';
      deleteBtn.onmouseover = function() { this.style.background = '#B02A37'; };
      deleteBtn.onmouseout = function() { this.style.background = '#DC3545'; };
    }
  }

  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

async function saveEdit() {
  const fields = document.querySelectorAll('.edit-field');
  const updates = {};
  fields.forEach(f => { updates[f.dataset.field] = f.value; });

  const btn = document.getElementById('edit-save-btn');
  btn.disabled = true;
  btn.textContent = 'Saving...';

  const result = await api('updateRow', { sheet: editContext.sheet, row: editContext.row, updates });

  btn.disabled = false;
  btn.textContent = 'Save Changes';

  if (result.result === 'success') {
    closeEditModal();
    await loadAllData();
  } else {
    alert(result.message || 'Failed to save.');
  }
}

async function deleteEditRow() {
  // Invoices cannot be deleted — only archived (status set to Void)
  if (editContext.sheet === 'Invoices') {
    if (!confirm('Archive this invoice? It will be marked as Void but preserved for records.')) return;
    const result = await api('updateRow', { sheet: 'Invoices', row: editContext.row, updates: { Status: 'Void' } });
    if (result.result === 'success') { closeEditModal(); await loadAllData(); }
    else alert(result.message || 'Failed to archive.');
    return;
  }

  if (!confirm('Delete this record? This cannot be undone.')) return;
  const result = await api('deleteRow', { sheet: editContext.sheet, row: editContext.row });
  if (result.result === 'success') { closeEditModal(); await loadAllData(); }
  else alert(result.message || 'Failed to delete.');
}

function closeEditModal() {
  document.getElementById('edit-modal').classList.remove('active');
  document.body.style.overflow = '';
}

// ============================================
// USER MANAGEMENT
// ============================================

async function loadUsers() {
  const result = await api('getUsers');
  if (result.result !== 'success') return;

  const tbody = document.getElementById('users-table-body');
  if (!tbody) return;

  const roleBadge = { developer: 'status-booked', owner: 'status-contacted', staff: 'status-completed' };
  const roleLabel = { developer: 'Developer', owner: 'Owner', staff: 'Staff' };

  tbody.innerHTML = (result.users || []).map(u => {
    const isSelf = currentUser && u.email === currentUser.email;
    const isProtected = u.protected === 'true' && currentUser.role !== 'developer';
    let actions = '';
    if (isSelf) actions = '<span class="text-xs text-gray-400">You</span>';
    else if (isProtected) actions = '<span class="text-xs text-gray-400">Protected</span>';
    else actions = `
      <button onclick="resetUserPw('${esc(u.email)}')" class="text-xs text-teal hover:underline mr-2">Reset PW</button>
      <button onclick="removeUser('${esc(u.email)}')" class="text-xs text-rose hover:underline">Remove</button>`;

    return `
      <tr class="border-t border-gray-100 hover:bg-cream/50">
        <td class="px-4 py-3 font-medium">${esc(u.name)}</td>
        <td class="px-4 py-3"><a href="mailto:${esc(u.email)}" class="text-teal hover:underline text-sm">${esc(u.email)}</a></td>
        <td class="px-4 py-3"><span class="status-badge ${roleBadge[u.role] || ''}">${roleLabel[u.role] || u.role}</span></td>
        <td class="px-4 py-3 text-xs text-gray-400">${u.mustChangePassword === 'Yes' ? 'Pending' : 'Set'}</td>
        <td class="px-4 py-3 text-xs text-gray-400">${formatDate(u.created)}</td>
        <td class="px-4 py-3">${actions}</td>
      </tr>`;
  }).join('');
}

async function addNewUser(e) {
  e.preventDefault();
  const name = document.getElementById('new-user-name').value.trim();
  const email = document.getElementById('new-user-email').value.trim();
  const role = document.getElementById('new-user-role').value;
  const status = document.getElementById('add-user-status');

  if (!name || !email) { showError(status, 'Name and email required.'); return; }

  const result = await api('addUser', { name, email, role });

  if (result.result === 'success') {
    status.textContent = `User added. Temp password: ${result.tempPassword}`;
    status.style.color = 'var(--color-teal)';
    document.getElementById('new-user-name').value = '';
    document.getElementById('new-user-email').value = '';
    loadUsers();
  } else {
    showError(status, result.message || 'Failed.');
  }
}

async function resetUserPw(email) {
  if (!confirm(`Reset password for ${email}?`)) return;
  const result = await api('resetUserPw', { email });
  if (result.result === 'success') {
    alert(`Password reset. Temp password: ${result.tempPassword}\n\nShare this with the user securely.`);
    loadUsers();
  } else {
    alert(result.message || 'Failed.');
  }
}

async function removeUser(email) {
  if (!confirm(`Remove ${email}? This cannot be undone.`)) return;
  const result = await api('removeUser', { email });
  if (result.result === 'success') {
    loadUsers();
  } else {
    alert(result.message || 'Failed.');
  }
}

// ============================================
// SETTINGS
// ============================================

async function changePassword() {
  const current = document.getElementById('settings-current-pass').value;
  const newPw = document.getElementById('settings-new-pass').value;
  const confirm = document.getElementById('settings-confirm-pass').value;
  const status = document.getElementById('passcode-status');

  if (!current || !newPw || !confirm) { showError(status, 'All fields required.'); return; }
  if (newPw.length < 6) { showError(status, 'Minimum 6 characters.'); return; }
  if (newPw !== confirm) { showError(status, 'Passwords do not match.'); return; }

  const result = await api('changePassword', { currentPassword: current, newPassword: newPw });

  if (result.result === 'success') {
    status.textContent = 'Password updated!';
    status.style.color = 'var(--color-teal)';
    ['settings-current-pass', 'settings-new-pass', 'settings-confirm-pass'].forEach(id => document.getElementById(id).value = '');
  } else {
    showError(status, result.message || 'Failed.');
  }
}

function loadAdminSettings() {
  apiUrl = localStorage.getItem('bloomshine_script_url') || '';
  const urlInput = document.getElementById('settings-script-url');
  if (urlInput && apiUrl) urlInput.value = apiUrl;
}

function saveSettings() {
  const url = document.getElementById('settings-script-url').value.trim();
  const status = document.getElementById('settings-status');

  if (url) {
    localStorage.setItem('bloomshine_script_url', url);
    apiUrl = url;
    // Also update sheets.js config for public site forms
    if (typeof SHEETS_CONFIG !== 'undefined') {
      SHEETS_CONFIG.scriptUrl = url;
      SHEETS_CONFIG.enabled = true;
    }
    status.textContent = 'Saved.';
    status.style.color = 'var(--color-teal)';
  } else {
    localStorage.removeItem('bloomshine_script_url');
    apiUrl = '';
    status.textContent = 'Removed.';
    status.style.color = 'var(--color-gray-400)';
  }
}

async function testConnection() {
  const status = document.getElementById('settings-status');
  status.textContent = 'Testing...';
  status.style.color = 'var(--color-gray-400)';

  const result = await api('ping');
  if (result.result === 'pong') {
    status.textContent = 'Connection successful!';
    status.style.color = 'var(--color-teal)';
  } else {
    status.textContent = 'Failed: ' + (result.message || 'Unknown error');
    status.style.color = 'var(--color-rose)';
  }
}

// ============================================
// INVOICE TAB
// ============================================

function initInvoiceTab() {
  const num = document.getElementById('inv-number');
  const date = document.getElementById('inv-date');
  if (num && !num.value) {
    const d = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    num.value = `BS-${d}-001`;
  }
  if (date && !date.value) date.value = new Date().toISOString().slice(0, 10);
  if (typeof invoiceLineItems !== 'undefined' && invoiceLineItems.length === 0) addInvoiceLineItem();
}

function openCreateInvoice() {
  document.getElementById('create-invoice-form').classList.remove('hidden');
  initInvoiceTab();
}

function closeCreateInvoice() {
  document.getElementById('create-invoice-form').classList.add('hidden');
}

// ============================================
// INVOICE FILTERS
// ============================================

let currentInvoiceFilter = 'all';

function filterInvoices(filter) {
  currentInvoiceFilter = filter;

  // Update active button
  document.querySelectorAll('.inv-filter').forEach(b => b.classList.toggle('active', b.dataset.filter === filter));

  // Re-render with filter
  const data = window._crmData;
  if (!data || !data.invoices) return;

  let filtered = data.invoices;
  const now = new Date();
  const thirtyDaysAgo = new Date(now); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  if (filter === 'unpaid') {
    filtered = filtered.filter(inv => inv.Status !== 'Paid' && inv.Status !== 'Void');
  } else if (filter === 'overdue') {
    filtered = filtered.filter(inv => {
      if (inv.Status === 'Paid' || inv.Status === 'Void') return false;
      const invDate = new Date(inv.Date);
      return invDate <= thirtyDaysAgo;
    });
  } else if (filter === 'paid') {
    filtered = filtered.filter(inv => inv.Status === 'Paid');
  }

  renderTable('invoices', filtered, ['Invoice #', 'Date', 'Client Name', 'Service', 'Amount', 'Status']);
}

// ============================================
// FINANCE & ACCOUNTING
// ============================================

let finCategories = [];
let finLedger = [];
let currentLedgerFilter = 'all';

async function loadFinanceData() {
  const [summaryRes, ledgerRes, catRes] = await Promise.all([
    api('getFinSummary'),
    api('getLedger'),
    api('getCategories')
  ]);

  // Summary cards
  if (summaryRes.result === 'success') {
    setText('fin-ytd-income', '$' + (summaryRes.ytd.income || 0).toFixed(2));
    setText('fin-ytd-expense', '$' + (summaryRes.ytd.expense || 0).toFixed(2));
    setText('fin-ytd-net', '$' + (summaryRes.ytd.net || 0).toFixed(2));
    setText('fin-mtd-net', '$' + (summaryRes.mtd.net || 0).toFixed(2));

    // Color net values
    const ytdNetEl = document.getElementById('fin-ytd-net');
    const mtdNetEl = document.getElementById('fin-mtd-net');
    if (ytdNetEl) ytdNetEl.style.color = summaryRes.ytd.net >= 0 ? '#155724' : '#721C24';
    if (mtdNetEl) mtdNetEl.style.color = summaryRes.mtd.net >= 0 ? '#155724' : '#721C24';

    // Expense breakdown
    const breakdown = document.getElementById('fin-expense-breakdown');
    const cats = summaryRes.expenseByCategory || {};
    const catKeys = Object.keys(cats).sort((a, b) => cats[b] - cats[a]);
    if (catKeys.length > 0) {
      breakdown.innerHTML = catKeys.map(k => `
        <div class="flex justify-between items-center bg-cream rounded-lg px-3 py-2">
          <span class="text-sm text-gray-600">${esc(k)}</span>
          <span class="font-semibold text-sm" style="color: #721C24;">$${cats[k].toFixed(2)}</span>
        </div>
      `).join('');
    }
  }

  // Ledger
  if (ledgerRes.result === 'success') {
    finLedger = ledgerRes.data || [];
    renderLedger();
  }

  // Categories
  if (catRes.result === 'success') {
    finCategories = (catRes.data || []).filter(c => c.Active === 'Yes');
    renderCategoriesList();
    updateFinCategories();
  }

  // Set default date for new entry
  const dateEl = document.getElementById('fin-date');
  if (dateEl && !dateEl.value) dateEl.value = new Date().toISOString().slice(0, 10);
}

function renderLedger() {
  const tbody = document.getElementById('ledger-table-body');
  if (!tbody) return;

  let rows = finLedger;
  if (currentLedgerFilter !== 'all') {
    rows = rows.filter(r => r.Type === currentLedgerFilter);
  }

  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="px-3 py-8 text-center text-gray-400 italic">No entries.</td></tr>';
    return;
  }

  // Newest first for display
  const sorted = [...rows].sort((a, b) => new Date(b.Date || 0) - new Date(a.Date || 0));

  tbody.innerHTML = sorted.map(r => {
    const isIncome = r.Type === 'Income';
    const amount = isIncome ? (Number(r.Credit) || 0) : (Number(r.Debit) || 0);
    const amountColor = isIncome ? '#155724' : '#721C24';
    const typeBg = isIncome ? '#D4EDDA' : '#F8D7DA';
    const typeFg = isIncome ? '#155724' : '#721C24';

    return `
      <tr class="border-t border-gray-100 hover:bg-cream/50">
        <td class="px-3 py-2 text-xs text-gray-500">${formatDate(r.Date)}</td>
        <td class="px-3 py-2"><span class="text-xs font-bold px-2 py-0.5 rounded" style="background:${typeBg};color:${typeFg};">${esc(r.Type)}</span></td>
        <td class="px-3 py-2 text-sm">${esc(r.Category)}</td>
        <td class="px-3 py-2 text-sm text-gray-600">${esc(r.Description)}</td>
        <td class="px-3 py-2 text-sm text-right font-semibold" style="color:${amountColor};">${isIncome ? '+' : '-'}$${amount.toFixed(2)}</td>
        <td class="px-3 py-2 text-sm text-right text-gray-500">$${(Number(r.Balance) || 0).toFixed(2)}</td>
      </tr>`;
  }).join('');
}

function filterLedger(filter) {
  currentLedgerFilter = filter;
  document.querySelectorAll('.ledger-filter').forEach(b => b.classList.toggle('active', b.dataset.filter === filter));
  renderLedger();
}

function updateFinCategories() {
  const typeEl = document.getElementById('fin-type');
  const catEl = document.getElementById('fin-category');
  if (!typeEl || !catEl) return;

  const selectedType = typeEl.value;
  const filtered = finCategories.filter(c => c.Type === selectedType);

  catEl.innerHTML = '<option value="">Select...</option>' +
    filtered.map(c => `<option value="${esc(c.Category)}">${esc(c.Category)}</option>`).join('');
}

function renderCategoriesList() {
  const container = document.getElementById('fin-categories-list');
  if (!container) return;

  if (finCategories.length === 0) {
    container.innerHTML = '<p class="text-gray-400 text-sm italic">No categories.</p>';
    return;
  }

  container.innerHTML = finCategories.map(c => {
    const badge = c.Type === 'Income'
      ? '<span class="text-xs px-1.5 py-0.5 rounded" style="background:#D4EDDA;color:#155724;">Income</span>'
      : '<span class="text-xs px-1.5 py-0.5 rounded" style="background:#F8D7DA;color:#721C24;">Expense</span>';
    return `<div class="flex justify-between items-center py-1 px-2 rounded hover:bg-cream">${badge} <span class="text-sm flex-1 ml-2">${esc(c.Category)}</span></div>`;
  }).join('');
}

async function submitLedgerEntry(e) {
  e.preventDefault();
  const status = document.getElementById('fin-entry-status');
  const type = document.getElementById('fin-type').value;
  const category = document.getElementById('fin-category').value;
  const amount = document.getElementById('fin-amount').value;
  const date = document.getElementById('fin-date').value;
  const description = document.getElementById('fin-description').value;
  const payment = document.getElementById('fin-payment').value;
  const notes = document.getElementById('fin-notes').value;

  if (!category || !amount) { showError(status, 'Category and amount required.'); return; }

  const result = await api('addLedgerEntry', { type, category, amount, date, description, paymentMethod: payment, notes });

  if (result.result === 'success') {
    status.textContent = 'Transaction recorded!';
    status.style.color = 'var(--color-teal)';
    // Reset form
    document.getElementById('fin-amount').value = '';
    document.getElementById('fin-description').value = '';
    document.getElementById('fin-notes').value = '';
    loadFinanceData();
  } else {
    showError(status, result.message || 'Failed.');
  }
}

async function addNewCategory(e) {
  e.preventDefault();
  const name = document.getElementById('fin-new-cat-name').value.trim();
  const type = document.getElementById('fin-new-cat-type').value;
  if (!name) return;

  const result = await api('addCategory', { name, type, description: '' });
  if (result.result === 'success') {
    document.getElementById('fin-new-cat-name').value = '';
    loadFinanceData();
  } else {
    alert(result.message || 'Failed.');
  }
}

// ============================================
// CONTACT DETAIL MODAL
// ============================================

function openContactDetail(rowNum) {
  const data = window._crmData;
  if (!data) return;

  const contact = (data.contacts || []).find(c => c._row === rowNum);
  if (!contact) return;

  const name = contact.Name || '';
  const email = (contact.Email || '').toLowerCase();
  const phone = contact.Phone || '';

  // Find related records
  const matchName = n => n && n.toLowerCase() === name.toLowerCase();
  const matchEmail = e => e && email && e.toLowerCase() === email;
  const match = (n, e) => matchName(n) || matchEmail(e);

  const relatedContracts = (data.contracts || []).filter(c => match(c.Name, c.Email));
  const relatedInvoices = (data.invoices || []).filter(i => match(i['Client Name'], i['Client Email']));

  // Status color helper
  const statusDot = (status) => {
    const colors = {
      'Active': '#16A34A', 'Booked': '#16A34A', 'Paid': '#16A34A', 'Completed': '#16A34A',
      'New': '#2D5F5D', 'Contacted': '#2D5F5D', 'Quoted': '#2563EB',
      'Sent': '#D97706', 'Draft': '#D97706', 'Paused': '#D97706',
      'Terminated': '#DC2626', 'Lost': '#DC2626', 'Overdue': '#DC2626', 'Void': '#9CA3AF'
    };
    return `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${colors[status] || '#9CA3AF'};margin-right:6px;"></span>`;
  };

  // Build unified timeline (most recent first)
  const timeline = [];
  relatedContracts.forEach(c => {
    timeline.push({
      date: c.Timestamp, type: 'Contract', icon: 'A',
      title: `${c.Service} — ${c.Frequency}`,
      status: c.Status || 'New',
      detail: c.Notes || '',
      row: c._row
    });
  });
  relatedInvoices.forEach(i => {
    timeline.push({
      date: i.Date, type: 'Invoice', icon: 'I',
      title: `${i['Invoice #']} — $${i.Amount || 0}`,
      status: i.Status || 'Draft',
      detail: i.Service || '',
      row: i._row
    });
  });
  timeline.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

  // Build modal
  let html = `
    <div class="flex items-start justify-between mb-4">
      <div>
        <h3 class="font-heading text-teal text-2xl font-bold">${esc(name)}</h3>
        <p class="text-gray-400 text-sm">${esc(contact['Service Interest'] || 'General inquiry')}</p>
      </div>
      <span class="status-badge status-${(contact.Status || 'new').toLowerCase()}">${esc(contact.Status || 'New')}</span>
    </div>

    <div class="grid grid-cols-2 gap-3 mb-4">
      <a href="mailto:${esc(email)}" class="bg-cream rounded-lg p-3 hover:shadow-sm transition-shadow">
        <p class="text-xs text-gray-400 uppercase tracking-wider">Email</p>
        <p class="text-teal font-medium text-sm truncate">${esc(email || '—')}</p>
      </a>
      <a href="tel:${esc(phone)}" class="bg-cream rounded-lg p-3 hover:shadow-sm transition-shadow">
        <p class="text-xs text-gray-400 uppercase tracking-wider">Phone</p>
        <p class="text-teal font-medium text-sm">${esc(phone || '—')}</p>
      </a>
    </div>

    ${contact.Message ? `<div class="bg-cream rounded-lg p-3 mb-4"><p class="text-xs text-gray-400 uppercase mb-1">Message</p><p class="text-sm text-gray-600">${esc(contact.Message)}</p></div>` : ''}

    <div class="grid grid-cols-2 gap-3 mb-4">
      <div class="bg-cream rounded-lg p-3">
        <p class="text-xs text-gray-400 uppercase">Notes</p>
        <p class="text-sm text-gray-600">${esc(contact.Notes || '—')}</p>
      </div>
      <div class="bg-cream rounded-lg p-3">
        <p class="text-xs text-gray-400 uppercase">Follow-Up</p>
        <p class="text-sm">${contact['Follow-Up Date'] ? formatDate(contact['Follow-Up Date']) : '—'}</p>
      </div>
    </div>

    <p class="text-xs text-gray-400 mb-4">First contact: ${formatDate(contact.Timestamp)}</p>

    <hr class="border-gray-200 mb-4">

    <!-- History Timeline -->
    <div class="flex items-center justify-between mb-3">
      <h4 class="font-heading text-teal font-semibold">History</h4>
      <div class="flex gap-3 text-xs text-gray-400">
        <span>${relatedContracts.length} contract${relatedContracts.length !== 1 ? 's' : ''}</span>
        <span>${relatedInvoices.length} invoice${relatedInvoices.length !== 1 ? 's' : ''}</span>
      </div>
    </div>
  `;

  if (timeline.length > 0) {
    html += '<div class="space-y-2 max-h-64 overflow-y-auto mb-4">';
    timeline.forEach(item => {
      const typeColors = { Contract: '#2D5F5D', Invoice: '#2563EB' };
      html += `
        <div class="border-l-3 rounded-r-lg p-3 flex items-center justify-between bg-cream" style="border-left: 3px solid ${typeColors[item.type] || '#ccc'};">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              ${statusDot(item.status)}
              <p class="text-sm font-medium truncate">${esc(item.title)}</p>
            </div>
            <p class="text-xs text-gray-400 ml-3.5">${esc(item.type)} &bull; ${formatDate(item.date)}${item.detail ? ' &bull; ' + esc(item.detail) : ''}</p>
          </div>
          <span class="text-xs font-semibold px-2 py-0.5 rounded" style="background:${
            item.status === 'Active' || item.status === 'Paid' || item.status === 'Completed' || item.status === 'Booked' ? '#D4EDDA' :
            item.status === 'Terminated' || item.status === 'Lost' || item.status === 'Overdue' ? '#F8D7DA' :
            item.status === 'Paused' || item.status === 'Sent' || item.status === 'Draft' ? '#FFF3CD' : '#E2E3E5'
          };color:${
            item.status === 'Active' || item.status === 'Paid' || item.status === 'Completed' || item.status === 'Booked' ? '#155724' :
            item.status === 'Terminated' || item.status === 'Lost' || item.status === 'Overdue' ? '#721C24' :
            item.status === 'Paused' || item.status === 'Sent' || item.status === 'Draft' ? '#856404' : '#383D41'
          };">${esc(item.status)}</span>
        </div>`;
    });
    html += '</div>';
  } else {
    html += '<p class="text-sm text-gray-400 italic mb-4">No history on file.</p>';
  }

  // Quick actions
  html += `
    <hr class="border-gray-200 mb-4">
    <div class="flex flex-wrap gap-2">
      <button onclick="closeContactDetail(); openEditModal('Contacts', ${rowNum})" class="btn-primary text-xs px-3 py-1.5">Edit Contact</button>
      <button onclick="logContactNote(${rowNum})" class="btn-secondary text-xs px-3 py-1.5">Add Note</button>
      <button onclick="logLostContract(${rowNum})" class="text-xs px-3 py-1.5 rounded-lg font-semibold text-white" style="background:#DC2626;border:none;cursor:pointer;">Log Lost Contract</button>
      <button onclick="closeContactDetail()" class="btn-secondary text-xs px-3 py-1.5">Close</button>
    </div>`;

  document.getElementById('contact-detail-content').innerHTML = html;
  document.getElementById('contact-detail-modal').classList.add('active');
  document.body.style.overflow = 'hidden';
}

async function logContactNote(rowNum) {
  const note = prompt('Enter a note for this contact:');
  if (!note) return;

  // Append to existing notes
  const contact = (window._crmData?.contacts || []).find(c => c._row === rowNum);
  const existing = contact?.Notes || '';
  const timestamp = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const updated = existing ? existing + ' | ' + timestamp + ': ' + note : timestamp + ': ' + note;

  const result = await api('updateRow', { sheet: 'Contacts', row: rowNum, updates: { Notes: updated } });
  if (result.result === 'success') {
    await loadAllData();
    openContactDetail(rowNum);
  } else {
    alert(result.message || 'Failed to save note.');
  }
}

async function logLostContract(rowNum) {
  const reason = prompt('Reason for lost contract (optional):');
  if (reason === null) return; // Cancelled

  const contact = (window._crmData?.contacts || []).find(c => c._row === rowNum);
  const existing = contact?.Notes || '';
  const timestamp = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const lostNote = timestamp + ': CONTRACT LOST' + (reason ? ' — ' + reason : '');
  const updated = existing ? existing + ' | ' + lostNote : lostNote;

  const result = await api('updateRow', { sheet: 'Contacts', row: rowNum, updates: { Status: 'Lost', Notes: updated } });
  if (result.result === 'success') {
    await loadAllData();
    openContactDetail(rowNum);
  } else {
    alert(result.message || 'Failed to update.');
  }
}

function closeContactDetail() {
  document.getElementById('contact-detail-modal').classList.remove('active');
  document.body.style.overflow = '';
}

// ============================================
// UTILITIES
// ============================================

function formatDate(val) {
  if (!val) return '—';
  try { return new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch (e) { return String(val); }
}

function esc(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = String(str);
  return d.innerHTML;
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ============================================
// INIT
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  loadAdminSettings();

  const session = loadSession();
  if (session && session.token) {
    showDashboard();
  } else {
    showScreen('login-screen');
    // Show API URL field if not configured
    if (!localStorage.getItem('bloomshine_script_url')) {
      document.getElementById('login-setup').classList.remove('hidden');
    }
  }
});
