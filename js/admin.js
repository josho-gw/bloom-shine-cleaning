/**
 * Bloom & Shine Cleaning Services
 * Admin Dashboard
 *
 * Multi-user authentication with role-based access, forced password
 * change on first login, and forgot-password recovery via email.
 */

// ============================================
// CONFIGURATION
// ============================================

const AUTH_STORAGE_KEY = 'bloomshine_users';
const SESSION_KEY = 'bloomshine_admin_session';
const RESET_KEY = 'bloomshine_reset_codes';
const SESSION_DURATION = 4 * 60 * 60 * 1000; // 4 hours
const RESET_CODE_EXPIRY = 30 * 60 * 1000; // 30 minutes

// Roles — developer is protected, owner has full business access, staff is future
const ROLE_DEVELOPER = 'developer';
const ROLE_OWNER = 'owner';
const ROLE_STAFF = 'staff'; // Stubbed for future employees

// Developer account email — cannot be removed or modified by non-developers
const DEVELOPER_EMAIL = 'josho@groundwire.net';

// Current session user
let currentUser = null;

// ============================================
// CRYPTO
// ============================================

async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateResetCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// ============================================
// USER STORE
// ============================================

function getUsers() {
  const stored = localStorage.getItem(AUTH_STORAGE_KEY);
  if (stored) {
    try { return JSON.parse(stored); } catch (e) { /* fall through to seed */ }
  }
  return null;
}

function saveUsers(users) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(users));
}

function getUserByEmail(email) {
  const users = getUsers();
  if (!users) return null;
  return users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
}

function updateUser(email, updates) {
  const users = getUsers();
  if (!users) return;
  const idx = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());
  if (idx >= 0) {
    users[idx] = { ...users[idx], ...updates };
    saveUsers(users);
  }
}

/**
 * Seed default accounts on first run, migrate old emails if needed
 */
async function seedDefaultUsers() {
  const existing = getUsers();

  // Migrate old owner email if present
  if (existing && existing.length > 0) {
    const oldOwner = existing.find(u => u.email.toLowerCase() === 'hunger4jesus08@yahoo.com');
    if (oldOwner) {
      oldOwner.email = 'nickib.bloomandshine@gmail.com';
      saveUsers(existing);
    }
    return;
  }

  const defaultHash = await sha256('bloom2026');

  const defaultUsers = [
    {
      email: 'josho@groundwire.net',
      name: 'Josh Ondo',
      role: ROLE_DEVELOPER,
      passwordHash: defaultHash,
      mustChangePassword: true,
      protected: true, // Cannot be removed or role-changed by non-developers
      createdAt: new Date().toISOString()
    },
    {
      email: 'nickib.bloomandshine@gmail.com',
      name: 'Nicki Burnett',
      role: ROLE_OWNER,
      passwordHash: defaultHash,
      mustChangePassword: true,
      protected: false,
      createdAt: new Date().toISOString()
    }
  ];

  saveUsers(defaultUsers);
}

// ============================================
// SESSION MANAGEMENT
// ============================================

function getSession() {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const session = JSON.parse(raw);
    if (Date.now() < session.expiry) return session;
    localStorage.removeItem(SESSION_KEY);
  } catch (e) {
    localStorage.removeItem(SESSION_KEY);
  }
  return null;
}

function createSession(user) {
  const session = {
    email: user.email,
    name: user.name,
    role: user.role,
    expiry: Date.now() + SESSION_DURATION
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

function destroySession() {
  localStorage.removeItem(SESSION_KEY);
  currentUser = null;
}

// ============================================
// LOGIN FLOW
// ============================================

async function attemptLogin(e) {
  e.preventDefault();
  const emailInput = document.getElementById('login-email');
  const passInput = document.getElementById('login-password');
  const error = document.getElementById('login-error');

  const email = emailInput.value.trim().toLowerCase();
  const password = passInput.value;

  if (!email || !password) {
    showLoginError('Please enter both email and password.');
    return;
  }

  const user = getUserByEmail(email);
  if (!user) {
    showLoginError('Invalid email or password.');
    passInput.value = '';
    return;
  }

  const hash = await sha256(password);
  if (hash !== user.passwordHash) {
    showLoginError('Invalid email or password.');
    passInput.value = '';
    return;
  }

  currentUser = user;

  // Check if password change is required
  if (user.mustChangePassword) {
    showScreen('force-change-screen');
    return;
  }

  // Successful login
  createSession(user);
  showDashboard();
}

function showLoginError(msg) {
  const error = document.getElementById('login-error');
  error.textContent = msg;
  error.classList.remove('hidden');
}

function adminLogout() {
  destroySession();
  showScreen('login-screen');
  document.getElementById('login-email').value = '';
  document.getElementById('login-password').value = '';
  document.getElementById('login-error').classList.add('hidden');
}

// ============================================
// FORCED PASSWORD CHANGE
// ============================================

async function submitForceChange(e) {
  e.preventDefault();
  const newPass = document.getElementById('force-new-pass').value;
  const confirmPass = document.getElementById('force-confirm-pass').value;
  const status = document.getElementById('force-change-status');

  if (!newPass || !confirmPass) {
    status.textContent = 'Please fill in both fields.';
    status.style.color = 'var(--color-rose)';
    return;
  }

  if (newPass.length < 6) {
    status.textContent = 'Password must be at least 6 characters.';
    status.style.color = 'var(--color-rose)';
    return;
  }

  if (newPass !== confirmPass) {
    status.textContent = 'Passwords do not match.';
    status.style.color = 'var(--color-rose)';
    return;
  }

  // Ensure new password differs from default
  const newHash = await sha256(newPass);
  const defaultHash = await sha256('bloom2026');
  if (newHash === defaultHash) {
    status.textContent = 'Please choose a different password than the default.';
    status.style.color = 'var(--color-rose)';
    return;
  }

  updateUser(currentUser.email, {
    passwordHash: newHash,
    mustChangePassword: false
  });

  currentUser.passwordHash = newHash;
  currentUser.mustChangePassword = false;
  createSession(currentUser);
  showDashboard();
}

// ============================================
// FORGOT PASSWORD
// ============================================

async function submitForgotPassword(e) {
  e.preventDefault();
  const emailInput = document.getElementById('forgot-email');
  const status = document.getElementById('forgot-status');
  const email = emailInput.value.trim().toLowerCase();

  if (!email) {
    status.textContent = 'Please enter your email address.';
    status.style.color = 'var(--color-rose)';
    return;
  }

  const user = getUserByEmail(email);

  // Always show success message to prevent email enumeration
  status.textContent = 'If an account exists with that email, a reset code has been sent.';
  status.style.color = 'var(--color-teal)';

  if (!user) return;

  // Generate and store reset code
  const code = generateResetCode();
  const resets = JSON.parse(localStorage.getItem(RESET_KEY) || '{}');
  resets[email] = {
    code: await sha256(code),
    expiry: Date.now() + RESET_CODE_EXPIRY,
    attempts: 0
  };
  localStorage.setItem(RESET_KEY, JSON.stringify(resets));

  // Send code via Google Apps Script
  if (SHEETS_CONFIG.enabled && SHEETS_CONFIG.scriptUrl) {
    try {
      await fetch(SHEETS_CONFIG.scriptUrl, {
        method: 'POST',
        body: JSON.stringify({
          source: 'password_reset',
          email: email,
          code: code,
          name: user.name
        }),
        headers: { 'Content-Type': 'text/plain' }
      });
    } catch (err) {
      console.error('[Admin] Failed to send reset email:', err);
    }
  } else {
    // Fallback: show code in console for development/setup
    console.log(`[Admin] Reset code for ${email}: ${code}`);
  }

  // Show the code entry form
  document.getElementById('forgot-step-1').classList.add('hidden');
  document.getElementById('forgot-step-2').classList.remove('hidden');
  document.getElementById('forgot-reset-email').value = email;
}

async function submitResetCode(e) {
  e.preventDefault();
  const email = document.getElementById('forgot-reset-email').value.trim().toLowerCase();
  const code = document.getElementById('forgot-code').value.trim().toUpperCase();
  const newPass = document.getElementById('forgot-new-pass').value;
  const confirmPass = document.getElementById('forgot-confirm-pass').value;
  const status = document.getElementById('reset-status');

  if (!code || !newPass || !confirmPass) {
    status.textContent = 'Please fill in all fields.';
    status.style.color = 'var(--color-rose)';
    return;
  }

  if (newPass.length < 6) {
    status.textContent = 'Password must be at least 6 characters.';
    status.style.color = 'var(--color-rose)';
    return;
  }

  if (newPass !== confirmPass) {
    status.textContent = 'Passwords do not match.';
    status.style.color = 'var(--color-rose)';
    return;
  }

  // Validate reset code
  const resets = JSON.parse(localStorage.getItem(RESET_KEY) || '{}');
  const resetEntry = resets[email];

  if (!resetEntry) {
    status.textContent = 'No reset request found. Please start over.';
    status.style.color = 'var(--color-rose)';
    return;
  }

  if (Date.now() > resetEntry.expiry) {
    delete resets[email];
    localStorage.setItem(RESET_KEY, JSON.stringify(resets));
    status.textContent = 'Reset code has expired. Please request a new one.';
    status.style.color = 'var(--color-rose)';
    return;
  }

  resetEntry.attempts = (resetEntry.attempts || 0) + 1;
  if (resetEntry.attempts > 5) {
    delete resets[email];
    localStorage.setItem(RESET_KEY, JSON.stringify(resets));
    status.textContent = 'Too many attempts. Please request a new code.';
    status.style.color = 'var(--color-rose)';
    return;
  }

  const codeHash = await sha256(code);
  if (codeHash !== resetEntry.code) {
    localStorage.setItem(RESET_KEY, JSON.stringify(resets));
    status.textContent = `Invalid code. ${5 - resetEntry.attempts} attempts remaining.`;
    status.style.color = 'var(--color-rose)';
    return;
  }

  // Code valid — update password
  const newHash = await sha256(newPass);
  updateUser(email, {
    passwordHash: newHash,
    mustChangePassword: false
  });

  // Clean up reset code
  delete resets[email];
  localStorage.setItem(RESET_KEY, JSON.stringify(resets));

  status.textContent = 'Password reset successfully! Redirecting to login...';
  status.style.color = 'var(--color-teal)';

  setTimeout(() => {
    showScreen('login-screen');
    document.getElementById('login-email').value = email;
  }, 2000);
}

function showForgotPassword() {
  // Reset the forgot password form
  document.getElementById('forgot-step-1').classList.remove('hidden');
  document.getElementById('forgot-step-2').classList.add('hidden');
  document.getElementById('forgot-email').value = '';
  document.getElementById('forgot-status').textContent = '';
  document.getElementById('reset-status').textContent = '';
  showScreen('forgot-screen');
}

// ============================================
// SCREEN MANAGEMENT
// ============================================

function showScreen(screenId) {
  ['login-screen', 'force-change-screen', 'forgot-screen', 'admin-dashboard'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('hidden', id !== screenId);
  });
}

function showDashboard() {
  const session = getSession();
  if (session) {
    currentUser = getUserByEmail(session.email);
  }

  if (!currentUser) {
    showScreen('login-screen');
    return;
  }

  showScreen('admin-dashboard');

  // Update header with user info
  const userDisplay = document.getElementById('admin-user-display');
  if (userDisplay) {
    userDisplay.textContent = currentUser.name;
  }

  const roleDisplay = document.getElementById('admin-role-display');
  if (roleDisplay) {
    const labels = { [ROLE_DEVELOPER]: 'Developer', [ROLE_OWNER]: 'Owner', [ROLE_STAFF]: 'Staff' };
    roleDisplay.textContent = labels[currentUser.role] || currentUser.role;
  }

  // Show/hide role-gated elements
  const canManageUsers = currentUser.role === ROLE_DEVELOPER || currentUser.role === ROLE_OWNER;
  document.querySelectorAll('[data-role="manager"]').forEach(el => {
    el.classList.toggle('hidden', !canManageUsers);
  });
  document.querySelectorAll('[data-role="developer"]').forEach(el => {
    el.classList.toggle('hidden', currentUser.role !== ROLE_DEVELOPER);
  });

  loadAdminSettings();
  loadDashboardData();
  initInvoiceTab();
}

// ============================================
// TAB NAVIGATION
// ============================================

function switchTab(tabName) {
  // Restrict user management to developer + owner
  if (tabName === 'users' && (!currentUser || (currentUser.role !== ROLE_DEVELOPER && currentUser.role !== ROLE_OWNER))) {
    return;
  }

  document.querySelectorAll('.tab-content').forEach(tc => tc.classList.add('hidden'));
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));

  const content = document.getElementById(`tab-${tabName}`);
  if (content) content.classList.remove('hidden');

  const btn = document.querySelector(`.admin-tab[data-tab="${tabName}"]`);
  if (btn) btn.classList.add('active');

  if (tabName === 'invoices') initInvoiceTab();
  if (tabName === 'users') renderUsersTable();
}

// ============================================
// USER MANAGEMENT (Superuser only)
// ============================================

function renderUsersTable() {
  const tbody = document.getElementById('users-table-body');
  if (!tbody) return;

  const users = getUsers() || [];

  const roleBadgeClass = {
    [ROLE_DEVELOPER]: 'status-booked',
    [ROLE_OWNER]: 'status-contacted',
    [ROLE_STAFF]: 'status-completed'
  };

  const roleLabels = {
    [ROLE_DEVELOPER]: 'Developer',
    [ROLE_OWNER]: 'Owner',
    [ROLE_STAFF]: 'Staff'
  };

  tbody.innerHTML = users.map(user => {
    const isSelf = user.email === currentUser.email;
    const isProtected = user.protected && currentUser.role !== ROLE_DEVELOPER;
    const canModify = !isSelf && !isProtected;

    let actions = '';
    if (isSelf) {
      actions = '<span class="text-xs text-gray-400">You</span>';
    } else if (isProtected) {
      actions = '<span class="text-xs text-gray-400">Protected</span>';
    } else {
      actions = `
        <button onclick="resetUserPassword('${escHtml(user.email)}')" class="text-xs text-teal hover:underline mr-2">Reset PW</button>
        <button onclick="removeUser('${escHtml(user.email)}')" class="text-xs text-rose hover:underline">Remove</button>
      `;
    }

    return `
      <tr class="border-t border-gray-100 hover:bg-cream/50 transition-colors">
        <td class="px-4 py-3 font-medium">${escHtml(user.name)}</td>
        <td class="px-4 py-3">
          <a href="mailto:${escHtml(user.email)}" class="text-teal hover:underline text-sm">${escHtml(user.email)}</a>
        </td>
        <td class="px-4 py-3">
          <span class="status-badge ${roleBadgeClass[user.role] || 'status-completed'}">${roleLabels[user.role] || user.role}</span>
        </td>
        <td class="px-4 py-3 text-xs text-gray-400">${user.mustChangePassword ? 'Pending' : 'Set'}</td>
        <td class="px-4 py-3 text-xs text-gray-400">${formatDate(user.createdAt)}</td>
        <td class="px-4 py-3">${actions}</td>
      </tr>
    `;
  }).join('');
}

async function addNewUser(e) {
  e.preventDefault();
  const name = document.getElementById('new-user-name').value.trim();
  const email = document.getElementById('new-user-email').value.trim().toLowerCase();
  const role = document.getElementById('new-user-role').value;
  const status = document.getElementById('add-user-status');

  if (!name || !email) {
    status.textContent = 'Name and email are required.';
    status.style.color = 'var(--color-rose)';
    return;
  }

  if (getUserByEmail(email)) {
    status.textContent = 'A user with that email already exists.';
    status.style.color = 'var(--color-rose)';
    return;
  }

  const defaultHash = await sha256('bloom2026');
  const users = getUsers() || [];
  users.push({
    email,
    name,
    role,
    passwordHash: defaultHash,
    mustChangePassword: true,
    createdAt: new Date().toISOString()
  });
  saveUsers(users);

  status.textContent = `User added. Default password: bloom2026`;
  status.style.color = 'var(--color-teal)';

  document.getElementById('new-user-name').value = '';
  document.getElementById('new-user-email').value = '';
  renderUsersTable();
}

async function resetUserPassword(email) {
  if (!confirm(`Reset password for ${email} to the default (bloom2026)?`)) return;

  const defaultHash = await sha256('bloom2026');
  updateUser(email, {
    passwordHash: defaultHash,
    mustChangePassword: true
  });
  renderUsersTable();
  alert(`Password reset. User will be prompted to change it on next login.`);
}

function removeUser(email) {
  if (!confirm(`Remove user ${email}? This cannot be undone.`)) return;

  const users = getUsers() || [];
  const filtered = users.filter(u => u.email.toLowerCase() !== email.toLowerCase());
  saveUsers(filtered);
  renderUsersTable();
}

// ============================================
// SETTINGS — Change Own Password
// ============================================

async function changePassword() {
  const current = document.getElementById('settings-current-pass').value;
  const newPass = document.getElementById('settings-new-pass').value;
  const confirm = document.getElementById('settings-confirm-pass').value;
  const status = document.getElementById('passcode-status');

  if (!current || !newPass || !confirm) {
    status.textContent = 'Please fill in all fields.';
    status.style.color = 'var(--color-rose)';
    return;
  }

  if (newPass.length < 6) {
    status.textContent = 'Password must be at least 6 characters.';
    status.style.color = 'var(--color-rose)';
    return;
  }

  if (newPass !== confirm) {
    status.textContent = 'New passwords do not match.';
    status.style.color = 'var(--color-rose)';
    return;
  }

  const currentHash = await sha256(current);
  if (currentHash !== currentUser.passwordHash) {
    status.textContent = 'Current password is incorrect.';
    status.style.color = 'var(--color-rose)';
    return;
  }

  const newHash = await sha256(newPass);
  updateUser(currentUser.email, { passwordHash: newHash });
  currentUser.passwordHash = newHash;

  status.textContent = 'Password updated successfully!';
  status.style.color = 'var(--color-teal)';

  document.getElementById('settings-current-pass').value = '';
  document.getElementById('settings-new-pass').value = '';
  document.getElementById('settings-confirm-pass').value = '';
}

// ============================================
// DATA LOADING FROM GOOGLE SHEETS
// ============================================

async function loadDashboardData() {
  if (!SHEETS_CONFIG.enabled || !SHEETS_CONFIG.scriptUrl) return;

  try {
    const response = await fetch(`${SHEETS_CONFIG.scriptUrl}?action=getAll`);
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

async function refreshData() {
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
      status.textContent = 'Connected, but unexpected response.';
      status.style.color = 'var(--color-gold)';
    }
  } catch (err) {
    status.textContent = `Connection failed: ${err.message}`;
    status.style.color = 'var(--color-rose)';
  }
}

// ============================================
// INVOICE TAB
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
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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

document.addEventListener('DOMContentLoaded', async () => {
  await seedDefaultUsers();

  const session = getSession();
  if (session) {
    currentUser = getUserByEmail(session.email);
    if (currentUser) {
      showDashboard();
      return;
    }
  }

  showScreen('login-screen');
});
