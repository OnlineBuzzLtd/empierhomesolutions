import React from "react";
import { Document, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";
import type { InvoiceWithRelations, QuoteWithRelations } from "@/modules/crm/types";
import { formatCurrency } from "@/modules/crm/lib/format";

const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontSize: 12,
    color: "#0f172a",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  heading: {
    fontSize: 24,
    marginBottom: 12,
    fontWeight: 700,
  },
  subheading: {
    fontSize: 14,
    marginBottom: 8,
    fontWeight: 700,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingVertical: 8,
  },
  cellGrow: {
    flexGrow: 1,
  },
  cellSmall: {
    width: 72,
    textAlign: "right",
  },
});

function QuotePdfDocument({ quote }: { quote: QuoteWithRelations }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.heading}>Empire Home Solutions Quote</Text>
        <View style={styles.row}>
          <View>
            <Text style={styles.subheading}>{quote.quote_number}</Text>
            <Text>Status: {quote.status}</Text>
            <Text>Valid until: {quote.valid_until ?? "Not set"}</Text>
          </View>
          <View>
            <Text>{quote.customer?.full_name ?? "Customer"}</Text>
            <Text>{quote.customer?.address_line1 ?? ""}</Text>
            <Text>{quote.customer?.postcode ?? ""}</Text>
          </View>
        </View>
        <Text style={styles.subheading}>Line items</Text>
        {quote.line_items.map((item, index) => (
          <View key={`${item.description}-${index}`} style={styles.tableRow}>
            <Text style={styles.cellGrow}>{item.description}</Text>
            <Text style={styles.cellSmall}>{item.qty}</Text>
            <Text style={styles.cellSmall}>{formatCurrency(item.unit_price)}</Text>
            <Text style={styles.cellSmall}>{formatCurrency(item.qty * item.unit_price)}</Text>
          </View>
        ))}
        <View style={{ marginTop: 16 }}>
          <View style={styles.row}>
            <Text>Subtotal</Text>
            <Text>{formatCurrency(quote.subtotal)}</Text>
          </View>
          <View style={styles.row}>
            <Text>VAT</Text>
            <Text>{formatCurrency(quote.subtotal * quote.vat_rate)}</Text>
          </View>
          <View style={styles.row}>
            <Text>Total</Text>
            <Text>{formatCurrency(quote.total)}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

function InvoicePdfDocument({ invoice }: { invoice: InvoiceWithRelations }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.heading}>Empire Home Solutions Invoice</Text>
        <View style={styles.row}>
          <View>
            <Text style={styles.subheading}>{invoice.invoice_number}</Text>
            <Text>Status: {invoice.status}</Text>
            <Text>Due date: {invoice.due_date ?? "Not set"}</Text>
          </View>
          <View>
            <Text>{invoice.customer?.full_name ?? "Customer"}</Text>
            <Text>{invoice.customer?.address_line1 ?? ""}</Text>
            <Text>{invoice.customer?.postcode ?? ""}</Text>
          </View>
        </View>
        <Text style={styles.subheading}>Line items</Text>
        {invoice.line_items.map((item, index) => (
          <View key={`${item.description}-${index}`} style={styles.tableRow}>
            <Text style={styles.cellGrow}>{item.description}</Text>
            <Text style={styles.cellSmall}>{item.qty}</Text>
            <Text style={styles.cellSmall}>{formatCurrency(item.unit_price)}</Text>
            <Text style={styles.cellSmall}>{formatCurrency(item.qty * item.unit_price)}</Text>
          </View>
        ))}
        <View style={{ marginTop: 16 }}>
          <View style={styles.row}>
            <Text>Subtotal</Text>
            <Text>{formatCurrency(invoice.subtotal)}</Text>
          </View>
          <View style={styles.row}>
            <Text>VAT</Text>
            <Text>{formatCurrency(invoice.subtotal * invoice.vat_rate)}</Text>
          </View>
          <View style={styles.row}>
            <Text>Total</Text>
            <Text>{formatCurrency(invoice.total)}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

export async function renderQuotePdf(quote: QuoteWithRelations) {
  return pdf(<QuotePdfDocument quote={quote} />).toBlob();
}

export async function renderInvoicePdf(invoice: InvoiceWithRelations) {
  return pdf(<InvoicePdfDocument invoice={invoice} />).toBlob();
}
