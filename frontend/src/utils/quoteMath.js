// Mirrors backend/services/quotePdf.js's computeQuoteTotals exactly, so the
// live editor preview and the emailed PDF never show different numbers.
export function computeQuoteTotals(quote) {
  const lineItems = Array.isArray(quote.lineItems) ? quote.lineItems : [];
  const subtotal = lineItems.reduce((sum, li) => {
    const qty = Number(li.qty) || 0;
    const rate = Number(li.rate) || 0;
    return sum + qty * rate;
  }, 0);
  const discountPercent = Number(quote.discountPercent) || 0;
  const taxPercent = Number(quote.taxPercent) || 0;
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

export function money(n, symbol = '$') {
  return `${symbol}${Number(n || 0).toFixed(2)}`;
}
