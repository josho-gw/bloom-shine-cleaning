/**
 * Bloom & Shine Cleaning Services
 * Digital Contract / Service Agreement
 *
 * Replaces paper contracts. Flow:
 * Step 1: Client info + service details
 * Step 2: Terms review + media release + agree checkbox
 * Step 3: Signature pad + submit
 * Success: PDF download + data to Google Sheet
 */

let signaturePad = null;

// ============================================
// MODAL OPEN / CLOSE
// ============================================

function openContract() {
  const modal = document.getElementById('contract-modal');
  if (!modal) return;

  // Restore from session storage if available
  restoreContractState();

  // Show step 1
  showContractStep(1);

  // Set date
  const dateInput = document.getElementById('contract-date');
  if (dateInput) {
    dateInput.value = new Date().toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  modal.classList.add('active');
  document.body.style.overflow = 'hidden';

  // Initialize signature pad after modal is visible
  setTimeout(initSignaturePad, 100);
}

function closeContract() {
  const modal = document.getElementById('contract-modal');
  if (modal) {
    saveContractState();
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
}

// ============================================
// STEP NAVIGATION
// ============================================

function showContractStep(step) {
  document.querySelectorAll('.contract-step').forEach(s => s.style.display = 'none');
  const target = document.getElementById(`contract-step-${step}`);
  if (target) target.style.display = 'block';
}

function contractNextStep(step) {
  // Validate before advancing
  if (step === 2) {
    // Validate step 1
    const name = document.getElementById('contract-name').value.trim();
    const address = document.getElementById('contract-address').value.trim();
    const phone = document.getElementById('contract-phone').value.trim();
    const email = document.getElementById('contract-email').value.trim();
    const service = document.getElementById('contract-service').value;
    const frequency = document.getElementById('contract-frequency').value;

    if (!name || !address || !phone || !email || !service || !frequency) {
      alert('Please fill in all required fields.');
      return;
    }

    // Populate terms
    populateTerms();
  }

  if (step === 3) {
    // Validate step 2 - must agree
    const agreed = document.getElementById('contract-agree').checked;
    if (!agreed) {
      alert('Please read and agree to the Terms & Conditions before signing.');
      return;
    }

    // Re-init signature pad when stepping to step 3
    setTimeout(initSignaturePad, 100);
  }

  showContractStep(step);
}

// ============================================
// TERMS POPULATION
// ============================================

function populateTerms() {
  const container = document.getElementById('contract-terms');
  if (!container || !policiesData) return;

  container.innerHTML = policiesData.policies.map(p => `
    <div class="mb-4">
      <h5 class="font-semibold text-teal text-sm mb-1">${p.title}</h5>
      <p class="text-xs leading-relaxed">${p.content}</p>
    </div>
  `).join('');
}

// Enable/disable sign button based on checkbox
document.addEventListener('change', (e) => {
  if (e.target.id === 'contract-agree') {
    const btn = document.getElementById('contract-to-sign');
    if (btn) btn.disabled = !e.target.checked;
  }
});

// ============================================
// SIGNATURE PAD
// ============================================

function initSignaturePad() {
  const canvas = document.getElementById('signature-canvas');
  if (!canvas) return;

  // Size canvas to container
  const wrapper = canvas.parentElement;
  canvas.width = wrapper.offsetWidth;
  canvas.height = 150;

  if (signaturePad) {
    signaturePad.off();
  }

  signaturePad = new SignaturePad(canvas, {
    penColor: 'rgb(27, 58, 54)', // forest color
    backgroundColor: 'rgb(255, 255, 255)'
  });
}

function clearSignature() {
  if (signaturePad) {
    signaturePad.clear();
  }
}

// ============================================
// SESSION STORAGE (prevent data loss)
// ============================================

function saveContractState() {
  const state = {
    name: document.getElementById('contract-name')?.value || '',
    address: document.getElementById('contract-address')?.value || '',
    phone: document.getElementById('contract-phone')?.value || '',
    email: document.getElementById('contract-email')?.value || '',
    service: document.getElementById('contract-service')?.value || '',
    frequency: document.getElementById('contract-frequency')?.value || ''
  };
  sessionStorage.setItem('bloomshine_contract', JSON.stringify(state));
}

function restoreContractState() {
  const saved = sessionStorage.getItem('bloomshine_contract');
  if (!saved) return;

  try {
    const state = JSON.parse(saved);
    const fields = ['name', 'address', 'phone', 'email', 'service', 'frequency'];
    fields.forEach(f => {
      const el = document.getElementById(`contract-${f}`);
      if (el && state[f]) el.value = state[f];
    });
  } catch (e) {
    // Ignore parse errors
  }
}

// ============================================
// SUBMIT CONTRACT
// ============================================

async function submitContract() {
  if (!signaturePad || signaturePad.isEmpty()) {
    alert('Please sign the agreement before submitting.');
    return;
  }

  const btn = document.getElementById('contract-submit');
  btn.disabled = true;
  btn.textContent = 'Submitting...';

  const contractData = {
    name: document.getElementById('contract-name').value.trim(),
    address: document.getElementById('contract-address').value.trim(),
    phone: document.getElementById('contract-phone').value.trim(),
    email: document.getElementById('contract-email').value.trim(),
    service: document.getElementById('contract-service').value,
    frequency: document.getElementById('contract-frequency').value,
    mediaRelease: document.querySelector('input[name="media-release"]:checked')?.value || 'no',
    date: document.getElementById('contract-date').value,
    signatureDataUrl: signaturePad.toDataURL()
  };

  // Generate and download PDF
  generateContractPDF(contractData);

  // Submit to Google Sheet
  await submitContractData(contractData);

  // Clear session storage
  sessionStorage.removeItem('bloomshine_contract');

  // Show success
  showContractStep('success');
}

// ============================================
// PDF GENERATION
// ============================================

function generateContractPDF(data) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = 20;

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(45, 95, 93); // teal
  doc.text('Bloom & Shine Cleaning Services LLC', pageWidth / 2, y, { align: 'center' });
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text('Service Agreement', pageWidth / 2, y, { align: 'center' });
  y += 4;
  doc.text('706-363-5315 | bloom.shinecleaningservices@yahoo.com', pageWidth / 2, y, { align: 'center' });
  y += 10;

  // Divider
  doc.setDrawColor(183, 201, 168); // sage
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // Client Information
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(45, 95, 93);
  doc.text('Client Information', margin, y);
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(60);

  const clientInfo = [
    ['Name:', data.name],
    ['Address:', data.address],
    ['Phone:', data.phone],
    ['Email:', data.email],
    ['Service:', data.service],
    ['Frequency:', data.frequency],
    ['Media Release:', data.mediaRelease === 'yes' ? 'Consented' : 'Declined']
  ];

  clientInfo.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(value, margin + 35, y);
    y += 6;
  });

  y += 6;

  // Terms section
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(45, 95, 93);
  doc.text('Terms & Conditions', margin, y);
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(80);

  if (policiesData) {
    policiesData.policies.forEach(policy => {
      // Check if we need a new page
      if (y > 260) {
        doc.addPage();
        y = 20;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(policy.title, margin, y);
      y += 5;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      const lines = doc.splitTextToSize(policy.content, contentWidth);
      doc.text(lines, margin, y);
      y += lines.length * 3.5 + 4;
    });
  }

  // Signature page
  if (y > 200) {
    doc.addPage();
    y = 20;
  }

  y += 10;
  doc.setDrawColor(183, 201, 168);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(45, 95, 93);
  doc.text('Agreement & Signature', margin, y);
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(60);
  const agreeText = 'By signing below, both parties agree to the terms and provisions of this Service Agreement.';
  doc.text(agreeText, margin, y);
  y += 12;

  // Signature image
  if (data.signatureDataUrl) {
    doc.addImage(data.signatureDataUrl, 'PNG', margin, y, 60, 25);
    y += 28;
    doc.setDrawColor(150);
    doc.line(margin, y, margin + 70, y);
    y += 5;
    doc.setFontSize(8);
    doc.text(`Client Signature: ${data.name}`, margin, y);
    y += 5;
    doc.text(`Date: ${data.date}`, margin, y);
  }

  // Owner signature line
  y += 15;
  doc.setDrawColor(150);
  doc.line(margin, y, margin + 70, y);
  y += 5;
  doc.setFontSize(8);
  doc.text('Owner: Nicki Burnett', margin, y);
  y += 5;
  doc.text('Date: _______________', margin, y);

  // Footer scripture
  y += 15;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(143, 168, 138); // sage
  doc.text('"Whatever you do, in word or deed, do everything in the name of the Lord Jesus." — Colossians 3:17', pageWidth / 2, y, { align: 'center' });

  // Save
  const safeName = data.name.replace(/[^a-zA-Z0-9]/g, '_');
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  doc.save(`BloomShine_Agreement_${safeName}_${dateStr}.pdf`);
}
