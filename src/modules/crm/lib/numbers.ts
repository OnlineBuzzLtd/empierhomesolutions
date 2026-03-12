export function buildQuoteNumber(sequence: number, year = new Date().getUTCFullYear()) {
  return `Q-${year}-${String(sequence).padStart(4, "0")}`;
}

export function buildInvoiceNumber(sequence: number, year = new Date().getUTCFullYear()) {
  return `INV-${year}-${String(sequence).padStart(4, "0")}`;
}
