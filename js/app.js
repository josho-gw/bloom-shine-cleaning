/**
 * Bloom & Shine Cleaning Services
 * Core Application JavaScript
 *
 * Handles: navigation, mobile menu, smooth scroll, service card rendering,
 * policy accordions, checklist modals, and contact form submission.
 */

// ============================================
// DATA LOADING
// ============================================

let servicesData = null;
let checklistsData = null;
let policiesData = null;

async function loadData() {
  try {
    const [servicesRes, checklistsRes, policiesRes] = await Promise.all([
      fetch('data/services.json'),
      fetch('data/checklists.json'),
      fetch('data/policies.json')
    ]);
    servicesData = await servicesRes.json();
    checklistsData = await checklistsRes.json();
    policiesData = await policiesRes.json();

    renderServiceCards();
    renderAddons();
    renderPolicies();
  } catch (err) {
    console.error('Failed to load data:', err);
  }
}

// ============================================
// SERVICE CARDS
// ============================================

function renderServiceCards() {
  const grid = document.getElementById('services-grid');
  if (!grid || !servicesData) return;

  grid.innerHTML = servicesData.services.map(service => `
    <div class="service-card" onclick="openEstimatorForService('${service.id}')" style="cursor:pointer;">
      <div class="text-4xl mb-2">${service.icon}</div>
      <h3 class="text-lg">${service.name}</h3>
      <p class="text-gray-500 text-sm mt-2 mb-4">${service.description}</p>
      <div class="flex items-center justify-center gap-4 mt-2">
        <button onclick="event.stopPropagation(); openEstimatorForService('${service.id}')" class="text-sm text-teal hover:underline font-medium">
          Get Estimate &rarr;
        </button>
        ${checklistsData && checklistsData[service.id] ? `
          <button onclick="event.stopPropagation(); openChecklist('${service.id}')" class="text-sm text-rose hover:underline font-medium">
            View Checklist
          </button>
        ` : ''}
      </div>
    </div>
  `).join('');
}

function renderAddons() {
  const grid = document.getElementById('addons-grid');
  if (!grid || !servicesData) return;

  grid.innerHTML = servicesData.addons.map(addon => `
    <div class="bg-white rounded-xl p-4 shadow-sm">
      <h4 class="font-heading text-teal font-semibold text-sm">${addon.name}</h4>
      <p class="text-gray-500 text-xs mt-1">${addon.description}</p>
      <p class="font-heading text-rose font-bold text-lg mt-2">$${addon.price}</p>
    </div>
  `).join('');
}

// ============================================
// POLICIES ACCORDION
// ============================================

function renderPolicies() {
  const container = document.getElementById('policies-container');
  if (!container || !policiesData) return;

  container.innerHTML = policiesData.policies.map(policy => `
    <details class="policy-item">
      <summary>${policy.title}</summary>
      <div><p>${policy.content}</p></div>
    </details>
  `).join('');
}

// ============================================
// CHECKLIST MODAL
// ============================================

function openChecklist(serviceId) {
  const modal = document.getElementById('checklist-modal');
  const content = document.getElementById('checklist-content');
  if (!modal || !content || !checklistsData || !checklistsData[serviceId]) return;

  const checklist = checklistsData[serviceId];

  let html = `
    <h3 class="font-heading text-teal text-2xl font-bold mb-2">${checklist.title}</h3>
    <div class="section-divider" style="margin-left:0;"></div>
  `;

  if (checklist.note) {
    html += `<p class="text-sm text-gray-500 italic mb-4">${checklist.note}</p>`;
  }

  for (const [room, items] of Object.entries(checklist.rooms)) {
    html += `
      <h4 class="font-heading text-teal font-semibold mt-4 mb-2">${room}</h4>
      <ul class="space-y-1">
        ${items.map(item => `
          <li class="flex items-start gap-2 text-sm text-gray-600">
            <svg class="w-4 h-4 mt-0.5 flex-shrink-0 text-sage" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
            </svg>
            ${item}
          </li>
        `).join('')}
      </ul>
    `;
  }

  content.innerHTML = html;
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeChecklist() {
  const modal = document.getElementById('checklist-modal');
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
}

// ============================================
// MOBILE MENU
// ============================================

function initMobileMenu() {
  const toggle = document.getElementById('menu-toggle');
  const close = document.getElementById('menu-close');
  const menu = document.getElementById('mobile-menu');
  const overlay = document.getElementById('mobile-overlay');

  if (!toggle || !menu) return;

  function openMenu() {
    menu.classList.add('open');
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeMenu() {
    menu.classList.remove('open');
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  toggle.addEventListener('click', openMenu);
  close.addEventListener('click', closeMenu);
  overlay.addEventListener('click', closeMenu);

  // Close on nav link click
  menu.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', closeMenu);
  });
}

// ============================================
// SMOOTH SCROLL
// ============================================

function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });
}

// ============================================
// NAVBAR SHADOW ON SCROLL
// ============================================

function initNavbarScroll() {
  const navbar = document.getElementById('navbar');
  if (!navbar) return;

  window.addEventListener('scroll', () => {
    if (window.scrollY > 10) {
      navbar.classList.add('shadow-md');
    } else {
      navbar.classList.remove('shadow-md');
    }
  });
}

// ============================================
// CONTACT FORM
// ============================================

async function submitContactForm(e) {
  e.preventDefault();

  const btn = document.getElementById('contact-submit-btn');
  const form = document.getElementById('contact-form');
  const success = document.getElementById('contact-success');

  btn.disabled = true;
  btn.textContent = 'Sending...';

  const formData = {
    name: document.getElementById('contact-name').value.trim(),
    email: document.getElementById('contact-email').value.trim(),
    phone: document.getElementById('contact-phone').value.trim(),
    service: document.getElementById('contact-service').value,
    message: document.getElementById('contact-message').value.trim()
  };

  await submitContact(formData);

  form.style.display = 'none';
  success.classList.remove('hidden');
}

/**
 * Pre-fill the contact form from the estimator
 */
function prefillContact() {
  // Called from the estimator result screen
  if (window._estimatorResult) {
    const serviceSelect = document.getElementById('contact-service');
    const messageField = document.getElementById('contact-message');
    if (serviceSelect && window._estimatorResult.serviceName) {
      for (const opt of serviceSelect.options) {
        if (opt.text.includes(window._estimatorResult.serviceName) || opt.value.includes(window._estimatorResult.serviceName)) {
          serviceSelect.value = opt.value;
          break;
        }
      }
    }
    if (messageField && window._estimatorResult) {
      const r = window._estimatorResult;
      messageField.value = `Hi! I'm interested in ${r.serviceName} (${r.frequencyName}, ~${r.sqftLabel}). My estimate was $${r.low}–$${r.high}. I'd like an exact quote. Thank you!`;
    }
  }
}

// ============================================
// MODAL CLOSE ON ESCAPE
// ============================================

function initEscapeClose() {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeChecklist();
      closeEstimator();
      closeContract();
      closeInvoice();
    }
  });
}

// Close modals on overlay click
function initOverlayClose() {
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.remove('active');
        document.body.style.overflow = '';
      }
    });
  });
}

// ============================================
// PAYMENT MODAL
// ============================================

function openPayment() {
  const modal = document.getElementById('payment-modal');
  if (modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

function closePayment() {
  const modal = document.getElementById('payment-modal');
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
}

// ============================================
// TERMS & PRIVACY MODAL
// ============================================

function openTerms() {
  const modal = document.getElementById('terms-modal');
  if (modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

function closeTerms() {
  const modal = document.getElementById('terms-modal');
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
}

// ============================================
// SCROLL REVEAL
// ============================================

function initScrollReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.reveal, .reveal-stagger').forEach(el => observer.observe(el));
}

// ============================================
// INIT
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  loadData();
  initMobileMenu();
  initSmoothScroll();
  initNavbarScroll();
  initEscapeClose();
  initOverlayClose();
  initScrollReveal();
});
