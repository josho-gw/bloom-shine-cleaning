/**
 * Bloom & Shine Cleaning Services
 * Invoice Generator (Admin-facing)
 *
 * Creates branded invoices as downloadable PDFs.
 * Accessible via a subtle link in the footer.
 */

let invoiceLineItems = [];
let invoiceCounter = 1;

// ============================================
// MODAL OPEN / CLOSE
// ============================================

function openInvoice() {
  const modal = document.getElementById('invoice-modal');
  if (!modal) return;

  // Set invoice number
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const numStr = String(invoiceCounter).padStart(3, '0');
  document.getElementById('inv-number').value = `BS-${dateStr}-${numStr}`;

  // Set date
  document.getElementById('inv-date').value = today.toISOString().slice(0, 10);

  // Init with one empty line item if none
  if (invoiceLineItems.length === 0) {
    addInvoiceLineItem();
  } else {
    renderInvoiceLineItems();
  }

  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeInvoice() {
  const modal = document.getElementById('invoice-modal');
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
}

// ============================================
// LINE ITEMS
// ============================================

function addInvoiceLineItem(description = '', amount = 0) {
  invoiceLineItems.push({
    id: Date.now(),
    description,
    amount
  });
  renderInvoiceLineItems();
}

function addInvoiceAddon(name, price) {
  invoiceLineItems.push({
    id: Date.now(),
    description: name,
    amount: price
  });
  renderInvoiceLineItems();
}

function removeInvoiceLineItem(id) {
  invoiceLineItems = invoiceLineItems.filter(item => item.id !== id);
  renderInvoiceLineItems();
}

function updateInvoiceLineItem(id, field, value) {
  const item = invoiceLineItems.find(i => i.id === id);
  if (item) {
    item[field] = field === 'amount' ? parseFloat(value) || 0 : value;
  }
  updateInvoiceTotal();
}

function renderInvoiceLineItems() {
  const container = document.getElementById('inv-line-items');
  if (!container) return;

  container.innerHTML = invoiceLineItems.map(item => `
    <div class="flex gap-2 items-center">
      <input type="text" value="${item.description}" placeholder="Service description"
        class="form-input flex-1 text-sm"
        onchange="updateInvoiceLineItem(${item.id}, 'description', this.value)">
      <div class="relative">
        <span class="absolute text-sm" style="left:0.5rem;top:50%;transform:translateY(-50%);color:var(--color-gray-400);pointer-events:none;">$</span>
        <input type="number" value="${item.amount || ''}" placeholder="0.00"
          class="form-input w-28 text-sm text-right" style="padding-left:1.5rem;"
          onchange="updateInvoiceLineItem(${item.id}, 'amount', this.value)"
          oninput="updateInvoiceLineItem(${item.id}, 'amount', this.value)"
          min="0" step="0.01">
      </div>
      <button onclick="removeInvoiceLineItem(${item.id})" class="text-gray-400 hover:text-rose p-1" title="Remove">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
    </div>
  `).join('');

  updateInvoiceTotal();
}

function updateInvoiceTotal() {
  const total = invoiceLineItems.reduce((sum, item) => sum + (item.amount || 0), 0);
  const totalEl = document.getElementById('inv-total');
  if (totalEl) {
    totalEl.textContent = `$${total.toFixed(2)}`;
  }
}

function getInvoiceTotal() {
  return invoiceLineItems.reduce((sum, item) => sum + (item.amount || 0), 0);
}

// ============================================
// PAYMENT LINK
// ============================================

function sendInvoicePaymentLink() {
  const method = document.getElementById('inv-payment-method').value;
  const total = getInvoiceTotal();
  let link = '';

  if (method === 'venmo') {
    link = `https://venmo.com/bloomshinecleaningLLC?txn=pay&amount=${total}&note=Bloom%20%26%20Shine%20Cleaning`;
  } else if (method === 'cashapp') {
    link = `https://cash.app/$bloomshinecleanLLC/${total}`;
  } else {
    alert('Cash payment — no link needed. Payment is collected at time of service.');
    return;
  }

  // Copy to clipboard
  navigator.clipboard.writeText(link).then(() => {
    alert(`Payment link copied to clipboard!\n\n${link}`);
  }).catch(() => {
    prompt('Copy this payment link:', link);
  });
}

// ============================================
// PDF GENERATION
// ============================================

function generateInvoicePDF() {
  const clientName = document.getElementById('inv-client-name').value.trim();
  const clientEmail = document.getElementById('inv-client-email').value.trim();
  const clientAddress = document.getElementById('inv-client-address').value.trim();
  const invoiceNumber = document.getElementById('inv-number').value;
  const invoiceDate = document.getElementById('inv-date').value;
  const paymentMethod = document.getElementById('inv-payment-method').value;

  if (!clientName) {
    alert('Please enter the client name.');
    return;
  }

  if (invoiceLineItems.length === 0 || invoiceLineItems.every(i => !i.description)) {
    alert('Please add at least one line item.');
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let y = 20;

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(45, 95, 93);
  doc.text('Bloom & Shine', margin, y);
  y += 7;
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text('CLEANING SERVICES LLC', margin, y);

  // Invoice label (right side)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.setTextColor(212, 132, 138); // rose
  doc.text('INVOICE', pageWidth - margin, 22, { align: 'right' });

  y += 12;

  // Business info
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text('706-363-5315', margin, y);
  doc.text(`Invoice #: ${invoiceNumber}`, pageWidth - margin, y, { align: 'right' });
  y += 4;
  doc.text('bloom.shinecleaningservices@yahoo.com', margin, y);
  doc.text(`Date: ${invoiceDate}`, pageWidth - margin, y, { align: 'right' });
  y += 4;
  doc.text('Hall, Jackson & Gwinnett County, GA', margin, y);
  y += 10;

  // Divider
  doc.setDrawColor(183, 201, 168);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // Bill To
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(45, 95, 93);
  doc.text('BILL TO:', margin, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(60);
  doc.text(clientName, margin, y);
  y += 5;
  if (clientAddress) { doc.text(clientAddress, margin, y); y += 5; }
  if (clientEmail) { doc.text(clientEmail, margin, y); y += 5; }
  y += 10;

  // Line items table
  const tableData = invoiceLineItems
    .filter(item => item.description)
    .map(item => [item.description, `$${(item.amount || 0).toFixed(2)}`]);

  const total = getInvoiceTotal();

  doc.autoTable({
    startY: y,
    head: [['Description', 'Amount']],
    body: tableData,
    foot: [['Total', `$${total.toFixed(2)}`]],
    margin: { left: margin, right: margin },
    headStyles: {
      fillColor: [45, 95, 93],
      font: 'helvetica',
      fontStyle: 'bold',
      fontSize: 10
    },
    bodyStyles: {
      font: 'helvetica',
      fontSize: 10,
      textColor: [60, 60, 60]
    },
    footStyles: {
      fillColor: [242, 215, 217], // blush
      textColor: [45, 95, 93],
      font: 'helvetica',
      fontStyle: 'bold',
      fontSize: 12
    },
    columnStyles: {
      1: { halign: 'right', cellWidth: 40 }
    },
    alternateRowStyles: {
      fillColor: [253, 248, 240] // cream
    }
  });

  y = doc.lastAutoTable.finalY + 15;

  // Payment info
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(45, 95, 93);
  doc.text('Payment Information', margin, y);
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(80);

  const paymentInfo = {
    venmo: 'Venmo: @bloomshinecleaningLLC',
    cashapp: 'Cash App: $bloomshinecleanLLC',
    cash: 'Cash: Accepted at time of service'
  };

  doc.text(paymentInfo[paymentMethod] || 'Please contact us for payment options.', margin, y);
  y += 5;
  doc.text('Payment is required before or at time of service.', margin, y);
  y += 5;
  doc.setFontSize(8);
  doc.text('We do not accept credit cards.', margin, y);

  // Footer
  y = doc.internal.pageSize.getHeight() - 20;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(143, 168, 138);
  doc.text('"Whatever you do, work at it with all your heart, as working for the Lord." — Colossians 3:23', pageWidth / 2, y, { align: 'center' });

  // Save
  const safeName = clientName.replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`BloomShine_Invoice_${invoiceNumber}_${safeName}.pdf`);

  // Increment counter
  invoiceCounter++;
}
