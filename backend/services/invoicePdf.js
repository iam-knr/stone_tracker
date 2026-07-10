import PDFDocument from 'pdfkit';

// Computes subtotal / discount / tax / total from an invoice's line items
// and percentages. Kept as the single source of truth so the PDF, the
// email body, and the frontend preview never disagree on the numbers.
export function computeInvoiceTotals(invoice) {
  const lineItems = Array.isArray(invoice.lineItems) ? invoice.lineItems : [];
  const subtotal = lineItems.reduce((sum, li) => {
    const qty = Number(li.qty) || 0;
    const rate = Number(li.rate) || 0;
    return sum + qty * rate;
  }, 0);
  const discountPercent = Number(invoice.discountPercent) || 0;
  const taxPercent = Number(invoice.taxPercent) || 0;
  const discountAmount = subtotal * (discountPercent / 100);
  const taxableAmount = subtotal - discountAmount;
  const taxAmount = taxableAmount * (taxPercent / 100);
  const total = taxableAmount + taxAmount;
  return {
    subtotal: round2(subtotal),
    discountAmount: round2(discountAmount),
    taxAmount: round2(taxAmount),
    total: round2(total),
  };
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function money(n, currency) {
  const symbol = currency || '$';
  return `${symbol}${Number(n || 0).toFixed(2)}`;
}

// Company logo is stored as a data URI (e.g. "data:image/png;base64,...").
// pdfkit's doc.image() wants a raw Buffer, so strip the prefix and decode.
function decodeDataUri(dataUri) {
  if (!dataUri || typeof dataUri !== 'string') return null;
  const match = dataUri.match(/^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/);
  if (!match) return null;
  try {
    return Buffer.from(match[1], 'base64');
  } catch {
    return null;
  }
}

// Renders a Zoho-Invoice-style PDF: company header on the left, big
// "INVOICE" title + metadata on the right, a Bill To block, a line-item
// table, a totals block, and notes/terms at the bottom. Returns a Buffer
// (never touches disk) so it can be attached directly to an email or
// streamed back to the browser for a "download PDF" action.
export function renderInvoicePdf(invoice, settings) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const currency = settings?.currencySymbol || '$';
      const { subtotal, discountAmount, taxAmount, total } = computeInvoiceTotals(invoice);

      // --- Header: logo + company block (left) + INVOICE title/meta (right) ---
      const startY = doc.y;
      const logoBuffer = decodeDataUri(settings?.companyLogo);
      let textX = 50;
      if (logoBuffer) {
        try {
          doc.image(logoBuffer, 50, startY, { fit: [50, 50] });
          textX = 110;
        } catch {
          textX = 50;
        }
      }
      doc.fontSize(18).fillColor('#202124').font('Helvetica-Bold')
        .text(settings?.companyName || 'Your Company', textX, startY);
      doc.font('Helvetica').fontSize(9).fillColor('#5f6368');
      if (settings?.companyAddress) doc.text(settings.companyAddress, textX, doc.y + 2, { width: 260 - (textX - 50) });
      if (settings?.companyEmail) doc.text(settings.companyEmail, textX, doc.y + 2);
      if (settings?.companyPhone) doc.text(settings.companyPhone, textX, doc.y + 2);
      if (settings?.companyGstin) doc.text(`GSTIN: ${settings.companyGstin}`, textX, doc.y + 2);
      if (logoBuffer) doc.y = Math.max(doc.y, startY + 50);

      doc.font('Helvetica-Bold').fontSize(22).fillColor('#1a73e8')
        .text('INVOICE', 300, startY, { width: 245, align: 'right' });
      doc.font('Helvetica').fontSize(9).fillColor('#5f6368');
      doc.text(`Invoice #: ${invoice.invoiceNumber || '—'}`, 300, doc.y + 4, { width: 245, align: 'right' });
      doc.text(`Issue Date: ${invoice.issueDate || '—'}`, 300, doc.y + 2, { width: 245, align: 'right' });
      doc.text(`Due Date: ${invoice.dueDate || '—'}`, 300, doc.y + 2, { width: 245, align: 'right' });

      doc.moveDown(2);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e0e0e0').stroke();
      doc.moveDown(1);

      // --- Bill To ---
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#202124').text('Bill To', 50, doc.y);
      doc.font('Helvetica').fontSize(10).fillColor('#202124').text(invoice.clientName || '—', 50, doc.y + 2);
      doc.fontSize(9).fillColor('#5f6368');
      if (invoice.clientAddress) doc.text(invoice.clientAddress, 50, doc.y + 2, { width: 300 });
      if (invoice.clientEmail) doc.text(invoice.clientEmail, 50, doc.y + 2);
      if (invoice.clientGstin) doc.text(`GSTIN: ${invoice.clientGstin}`, 50, doc.y + 2);

      doc.moveDown(1.5);

      // --- Line items table ---
      const tableTop = doc.y;
      const colX = { desc: 50, qty: 330, rate: 390, amount: 470 };
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#ffffff');
      doc.rect(50, tableTop, 495, 22).fill('#1a73e8');
      doc.fillColor('#ffffff');
      doc.text('Description', colX.desc + 6, tableTop + 6, { width: 270 });
      doc.text('Qty', colX.qty, tableTop + 6, { width: 50, align: 'right' });
      doc.text('Rate', colX.rate, tableTop + 6, { width: 70, align: 'right' });
      doc.text('Amount', colX.amount, tableTop + 6, { width: 65, align: 'right' });

      let rowY = tableTop + 22;
      const items = Array.isArray(invoice.lineItems) ? invoice.lineItems : [];
      doc.font('Helvetica').fontSize(9.5).fillColor('#202124');
      items.forEach((li, i) => {
        const qty = Number(li.qty) || 0;
        const rate = Number(li.rate) || 0;
        const amount = qty * rate;
        const rowHeight = 22;
        if (i % 2 === 1) {
          doc.rect(50, rowY, 495, rowHeight).fill('#f8f9fa');
          doc.fillColor('#202124');
        }
        doc.text(li.description || '', colX.desc + 6, rowY + 6, { width: 270 });
        doc.text(String(qty), colX.qty, rowY + 6, { width: 50, align: 'right' });
        doc.text(money(rate, currency), colX.rate, rowY + 6, { width: 70, align: 'right' });
        doc.text(money(amount, currency), colX.amount, rowY + 6, { width: 65, align: 'right' });
        rowY += rowHeight;
      });
      doc.moveTo(50, rowY).lineTo(545, rowY).strokeColor('#e0e0e0').stroke();

      // --- Totals block ---
      let totalsY = rowY + 12;
      const labelX = 380, valueX = 470, valueWidth = 65;
      doc.fontSize(9.5).fillColor('#5f6368');
      doc.text('Subtotal', labelX, totalsY, { width: 85, align: 'right' });
      doc.fillColor('#202124').text(money(subtotal, currency), valueX, totalsY, { width: valueWidth, align: 'right' });
      totalsY += 16;
      if (Number(invoice.discountPercent) > 0) {
        doc.fillColor('#5f6368').text(`Discount (${invoice.discountPercent}%)`, labelX, totalsY, { width: 85, align: 'right' });
        doc.fillColor('#202124').text(`-${money(discountAmount, currency)}`, valueX, totalsY, { width: valueWidth, align: 'right' });
        totalsY += 16;
      }
      if (Number(invoice.taxPercent) > 0) {
        doc.fillColor('#5f6368').text(`Tax (${invoice.taxPercent}%)`, labelX, totalsY, { width: 85, align: 'right' });
        doc.fillColor('#202124').text(money(taxAmount, currency), valueX, totalsY, { width: valueWidth, align: 'right' });
        totalsY += 16;
      }
      doc.moveTo(labelX, totalsY).lineTo(545, totalsY).strokeColor('#e0e0e0').stroke();
      totalsY += 6;
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#1a73e8');
      doc.text('Total', labelX, totalsY, { width: 85, align: 'right' });
      doc.text(money(total, currency), valueX, totalsY, { width: valueWidth, align: 'right' });

      // --- Notes / Terms ---
      let footerY = totalsY + 40;
      doc.font('Helvetica').fontSize(9);
      if (invoice.notes) {
        doc.font('Helvetica-Bold').fillColor('#202124').text('Notes', 50, footerY);
        doc.font('Helvetica').fillColor('#5f6368').text(invoice.notes, 50, doc.y + 2, { width: 495 });
        footerY = doc.y + 10;
      }
      if (invoice.terms) {
        doc.font('Helvetica-Bold').fillColor('#202124').text('Terms & Conditions', 50, footerY);
        doc.font('Helvetica').fillColor('#5f6368').text(invoice.terms, 50, doc.y + 2, { width: 495 });
        footerY = doc.y + 10;
      }

      // --- Bank Details (for direct bank transfer payments) ---
      if (settings?.bankAccountName || settings?.bankAccountNumber || settings?.bankIfsc) {
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#202124').text('Bank Details', 50, footerY);
        doc.font('Helvetica').fillColor('#5f6368');
        if (settings?.bankAccountName) doc.text(`Account Name: ${settings.bankAccountName}`, 50, doc.y + 2);
        if (settings?.bankAccountNumber) doc.text(`Account Number: ${settings.bankAccountNumber}`, 50, doc.y + 2);
        if (settings?.bankIfsc) doc.text(`IFSC Code: ${settings.bankIfsc}`, 50, doc.y + 2);
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
