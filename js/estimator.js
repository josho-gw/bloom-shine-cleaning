/**
 * Bloom & Shine Cleaning Services
 * Interactive Estimator Modal
 *
 * 4-step wizard: Service Type → Sq Ft → Frequency → Add-ons → Result
 * All pricing from data/services.json, all calculation client-side.
 */

let estCurrentStep = 1;
let estSelection = {
  serviceId: null,
  serviceName: null,
  basePer100: null,
  sqftValue: null,
  sqftLabel: null,
  frequencyId: null,
  frequencyName: null,
  discount: 0,
  addons: [],
  addonTotal: 0
};

// ============================================
// MODAL OPEN / CLOSE
// ============================================

function openEstimator() {
  const modal = document.getElementById('estimator-modal');
  if (!modal) return;

  // Reset
  estCurrentStep = 1;
  estSelection = { serviceId: null, serviceName: null, basePer100: null, sqftValue: null, sqftLabel: null, frequencyId: null, frequencyName: null, discount: 0, addons: [], addonTotal: 0 };

  renderEstimatorOptions();
  showEstimatorStep(1);
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

/**
 * Open estimator with a specific service pre-selected, skip to step 2.
 */
function openEstimatorForService(serviceId) {
  if (!servicesData) return;

  const service = servicesData.services.find(s => s.id === serviceId);
  if (!service) { openEstimator(); return; }

  const modal = document.getElementById('estimator-modal');
  if (!modal) return;

  // Reset and pre-select
  estCurrentStep = 2;
  estSelection = {
    serviceId: service.id,
    serviceName: service.name,
    basePer100: service.basePer100SqFt,
    sqftValue: null, sqftLabel: null,
    frequencyId: null, frequencyName: null,
    discount: 0, addons: [], addonTotal: 0
  };

  renderEstimatorOptions();
  showEstimatorStep(2);
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';

  // Enable the step 1 next button since service is already selected
  const btn = document.getElementById('est-next-1');
  if (btn) btn.disabled = false;
}

function closeEstimator() {
  const modal = document.getElementById('estimator-modal');
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
}

// ============================================
// RENDER OPTIONS
// ============================================

function renderEstimatorOptions() {
  if (!servicesData) return;

  // Service types
  const serviceContainer = document.getElementById('est-service-options');
  serviceContainer.innerHTML = servicesData.services.map(s => `
    <label class="flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:border-sage transition-colors ${estSelection.serviceId === s.id ? 'border-teal bg-sage-light' : ''}">
      <input type="radio" name="est-service" value="${s.id}" class="accent-[var(--color-teal)]"
        onchange="selectEstService('${s.id}', '${s.name}', [${s.basePer100SqFt}])"
        ${estSelection.serviceId === s.id ? 'checked' : ''}>
      <span class="text-xl">${s.icon}</span>
      <div>
        <span class="font-medium text-sm text-teal">${s.name}</span>
        <p class="text-xs text-gray-400">${s.includes}</p>
      </div>
    </label>
  `).join('');

  // Sq ft ranges
  const sqftContainer = document.getElementById('est-sqft-options');
  sqftContainer.innerHTML = servicesData.sqftRanges.map(r => `
    <label class="flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:border-sage transition-colors">
      <input type="radio" name="est-sqft" value="${r.value}" class="accent-[var(--color-teal)]"
        onchange="selectEstSqft(${r.value}, '${r.label}')">
      <span class="font-medium text-sm">${r.label}</span>
    </label>
  `).join('');

  // Frequency
  const freqContainer = document.getElementById('est-freq-options');
  freqContainer.innerHTML = servicesData.frequencies.map(f => `
    <label class="flex items-center justify-between p-3 rounded-lg border border-gray-200 cursor-pointer hover:border-sage transition-colors">
      <div class="flex items-center gap-3">
        <input type="radio" name="est-freq" value="${f.id}" class="accent-[var(--color-teal)]"
          onchange="selectEstFreq('${f.id}', '${f.name}', ${f.discount})">
        <span class="font-medium text-sm">${f.name}</span>
      </div>
      ${f.label ? `<span class="text-xs font-semibold text-sage px-2 py-1 rounded-full" style="background: var(--color-sage-light);">${f.label}</span>` : ''}
    </label>
  `).join('');

  // Add-ons
  const addonContainer = document.getElementById('est-addon-options');
  addonContainer.innerHTML = servicesData.addons.map(a => `
    <label class="flex items-center justify-between p-3 rounded-lg border border-gray-200 cursor-pointer hover:border-sage transition-colors">
      <div class="flex items-center gap-3">
        <input type="checkbox" value="${a.id}" class="accent-[var(--color-teal)]"
          onchange="toggleEstAddon('${a.id}', '${a.name}', ${a.price}, this.checked)">
        <div>
          <span class="font-medium text-sm">${a.name}</span>
          <p class="text-xs text-gray-400">${a.description}</p>
        </div>
      </div>
      <span class="font-semibold text-sm text-teal">$${a.price}</span>
    </label>
  `).join('');

  // Add "No add-ons" option
  addonContainer.innerHTML += `
    <p class="text-xs text-gray-400 text-center mt-2 italic">Add-ons are optional. You can skip this step.</p>
  `;
}

// ============================================
// SELECTIONS
// ============================================

function selectEstService(id, name, basePer100) {
  estSelection.serviceId = id;
  estSelection.serviceName = name;
  estSelection.basePer100 = basePer100;
  document.getElementById('est-next-1').disabled = false;
}

function selectEstSqft(value, label) {
  estSelection.sqftValue = value;
  estSelection.sqftLabel = label;
  document.getElementById('est-next-2').disabled = false;
}

function selectEstFreq(id, name, discount) {
  estSelection.frequencyId = id;
  estSelection.frequencyName = name;
  estSelection.discount = discount;
  document.getElementById('est-next-3').disabled = false;
}

function toggleEstAddon(id, name, price, checked) {
  if (checked) {
    estSelection.addons.push({ id, name, price });
  } else {
    estSelection.addons = estSelection.addons.filter(a => a.id !== id);
  }
  estSelection.addonTotal = estSelection.addons.reduce((sum, a) => sum + a.price, 0);
}

// ============================================
// STEP NAVIGATION
// ============================================

function showEstimatorStep(step) {
  estCurrentStep = step;

  // Update panels
  document.querySelectorAll('#estimator-modal .step-panel').forEach(panel => {
    panel.classList.remove('active');
  });
  const targetStep = step === 'result' ? 'result' : step;
  const activePanel = document.querySelector(`#estimator-modal .step-panel[data-step="${targetStep}"]`);
  if (activePanel) activePanel.classList.add('active');

  // Update dots
  document.querySelectorAll('#estimator-modal .step-dot').forEach(dot => {
    const dotStep = parseInt(dot.dataset.step);
    dot.classList.remove('active', 'completed');
    if (step === 'result' || dotStep < step) {
      dot.classList.add('completed');
    } else if (dotStep === step) {
      dot.classList.add('active');
    }
  });
}

function estimatorNext() {
  if (estCurrentStep < 4) {
    showEstimatorStep(estCurrentStep + 1);
  }
}

function estimatorPrev() {
  if (estCurrentStep > 1) {
    showEstimatorStep(estCurrentStep - 1);
  }
}

// ============================================
// CALCULATION
// ============================================

function estimatorCalculate() {
  const sqftUnits = estSelection.sqftValue / 100;
  const baseLow = sqftUnits * estSelection.basePer100[0];
  const baseHigh = sqftUnits * estSelection.basePer100[1];

  const discountedLow = baseLow * (1 - estSelection.discount);
  const discountedHigh = baseHigh * (1 - estSelection.discount);

  const totalLow = Math.round(discountedLow + estSelection.addonTotal);
  const totalHigh = Math.round(discountedHigh + estSelection.addonTotal);

  // Store for prefill
  window._estimatorResult = {
    serviceName: estSelection.serviceName,
    sqftLabel: estSelection.sqftLabel,
    frequencyName: estSelection.frequencyName,
    addons: estSelection.addons.map(a => a.name),
    low: totalLow,
    high: totalHigh
  };

  // Display
  document.getElementById('est-result-range').textContent = `$${totalLow} – $${totalHigh}`;

  let detail = `${estSelection.serviceName} · ${estSelection.sqftLabel} · ${estSelection.frequencyName}`;
  if (estSelection.addons.length > 0) {
    detail += ` · Add-ons: ${estSelection.addons.map(a => a.name).join(', ')}`;
  }
  document.getElementById('est-result-detail').textContent = detail;

  showEstimatorStep('result');

  // Log to CRM
  submitEstimate({
    service: estSelection.serviceName,
    sqft: estSelection.sqftLabel,
    frequency: estSelection.frequencyName,
    addons: estSelection.addons.map(a => a.name),
    low: totalLow,
    high: totalHigh
  });
}
