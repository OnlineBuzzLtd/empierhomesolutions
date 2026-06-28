import { spawnSync } from "node:child_process";

export const EMPIRE_TENANT = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "empire-home-solutions",
  name: "Empire Home Solutions",
};

export const DEFAULT_WORKBOOK_PATH = "/Users/shehzadiqbal/Downloads/Empire Home Solutions (EHS)1.xlsx";
export const IMPORT_SOURCE = "EHS workbook import";

const XLSX_TO_JSON_PY = String.raw`
import json
import re
import sys
from zipfile import ZipFile
import xml.etree.ElementTree as ET

path = sys.argv[1]
NS = {
    "main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "rel": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}

def col_index(ref):
    match = re.match(r"([A-Z]+)", ref or "")
    if not match:
        return None
    value = 0
    for ch in match.group(1):
        value = value * 26 + (ord(ch) - 64)
    return value - 1

def cell_text(cell):
    return "".join(cell.itertext()) if cell is not None else ""

def read_rows(zip_file, sheet_path, shared):
    root = ET.fromstring(zip_file.read(sheet_path))
    rows = []
    for row in root.findall("main:sheetData/main:row", NS):
        values = []
        for cell in row.findall("main:c", NS):
            idx = col_index(cell.attrib.get("r"))
            if idx is None:
                idx = len(values)
            while len(values) <= idx:
                values.append("")
            cell_type = cell.attrib.get("t")
            if cell_type == "s":
                value = cell.find("main:v", NS)
                values[idx] = shared[int(value.text)] if value is not None and value.text is not None else ""
            elif cell_type == "inlineStr":
                values[idx] = cell_text(cell.find("main:is", NS))
            elif cell_type == "b":
                value = cell.find("main:v", NS)
                values[idx] = "true" if value is not None and value.text == "1" else "false"
            else:
                value = cell.find("main:v", NS)
                values[idx] = value.text if value is not None and value.text is not None else ""
        if any(str(value).strip() for value in values):
            rows.append(values)
    return rows

with ZipFile(path) as zip_file:
    shared = []
    if "xl/sharedStrings.xml" in zip_file.namelist():
        root = ET.fromstring(zip_file.read("xl/sharedStrings.xml"))
        for string_item in root.findall("main:si", NS):
            shared.append("".join(text.text or "" for text in string_item.findall(".//main:t", NS)))

    workbook = ET.fromstring(zip_file.read("xl/workbook.xml"))
    relationships = ET.fromstring(zip_file.read("xl/_rels/workbook.xml.rels"))
    targets = {rel.attrib["Id"]: rel.attrib["Target"] for rel in relationships}
    sheets = []

    for sheet in workbook.findall("main:sheets/main:sheet", NS):
        name = sheet.attrib["name"]
        relationship_id = sheet.attrib["{%s}id" % NS["rel"]]
        target = targets[relationship_id]
        sheet_path = "xl/" + target.lstrip("/") if not target.startswith("xl/") else target
        raw_rows = read_rows(zip_file, sheet_path, shared)
        if not raw_rows:
            sheets.append({"name": name, "rows": []})
            continue
        headers = [str(value or "").strip() for value in raw_rows[0]]
        records = []
        for row in raw_rows[1:]:
            record = {}
            for index, header in enumerate(headers):
                if not header:
                    continue
                record[header] = str(row[index] if index < len(row) else "").strip()
            if any(value for value in record.values()):
                records.append(record)
        sheets.append({"name": name, "rows": records})

print(json.dumps({"sheets": sheets}, ensure_ascii=False))
`;

export function parseArgs(argv) {
  const args = {
    apply: false,
    workbookPath: DEFAULT_WORKBOOK_PATH,
    allowReviewSkips: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--apply") {
      args.apply = true;
      continue;
    }
    if (arg === "--allow-review-skips") {
      args.allowReviewSkips = true;
      continue;
    }
    if (arg === "--file") {
      const next = argv[index + 1];
      if (!next) throw new Error("--file requires a path");
      args.workbookPath = next;
      index += 1;
      continue;
    }
    if (arg.startsWith("--file=")) {
      args.workbookPath = arg.slice("--file=".length);
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

export function readWorkbook(workbookPath) {
  const result = spawnSync("python3", ["-c", XLSX_TO_JSON_PY, workbookPath], {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `Failed to parse workbook: ${workbookPath}`);
  }

  return JSON.parse(result.stdout);
}

export function clean(value) {
  return String(value ?? "").trim();
}

export function normalizeText(value) {
  const normalized = clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized || null;
}

export function normalizeEmail(value) {
  const normalized = clean(value).toLowerCase();
  return normalized || null;
}

export function normalizePhone(value) {
  const trimmed = clean(value);
  if (!trimmed) return null;
  const digits = trimmed.replace(/\D+/g, "");
  if (!digits) return null;
  if (digits.startsWith("0044")) return `+44${digits.slice(4)}`;
  if (digits.startsWith("44") && digits.length >= 12) return `+${digits}`;
  if (digits.startsWith("0") && (digits.length === 10 || digits.length === 11)) return `+44${digits.slice(1)}`;
  if (digits.startsWith("7") && digits.length === 10) return `+44${digits}`;
  return digits;
}

export function phoneForStorage(value) {
  const trimmed = clean(value);
  if (!trimmed) return null;
  const normalized = normalizePhone(trimmed);
  if (!normalized) return null;
  const digits = trimmed.replace(/\D+/g, "");
  if (digits.startsWith("7") && digits.length === 10) {
    return `+44${digits}`;
  }
  if (digits.startsWith("0044")) {
    return `+44${digits.slice(4)}`;
  }
  if (trimmed.startsWith("+")) {
    return `+${trimmed.slice(1).replace(/\D+/g, "")}`;
  }
  return trimmed;
}

export function normalizePostcode(value) {
  const normalized = clean(value).replace(/\s+/g, "").toUpperCase();
  return normalized || null;
}

export function extractPostcode(address) {
  const match = clean(address).match(/\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i);
  return match ? match[1].replace(/\s+/g, " ").toUpperCase() : null;
}

export function normalizeAddress(value) {
  return normalizeText(clean(value).replace(/\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i, ""));
}

export function parseExcelDate(value) {
  const raw = clean(value);
  if (!raw) return null;

  if (/^\d+(\.\d+)?$/.test(raw)) {
    const serial = Number(raw);
    if (!Number.isFinite(serial)) return null;
    const epoch = Date.UTC(1899, 11, 30);
    return new Date(epoch + serial * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return null;
}

export function classifyDealType(type) {
  const value = normalizeText(type);
  if (!value || value === "other") return { serviceSlug: null, jobTypeSlug: null };
  if (value.includes("swap") || value.includes("conversion")) {
    return { serviceSlug: "boilers", jobTypeSlug: "boiler-install" };
  }
  if (value.includes("service")) {
    return { serviceSlug: "boilers", jobTypeSlug: "boiler-service" };
  }
  if (value.includes("breakdown") || value.includes("repair")) {
    return { serviceSlug: "boilers", jobTypeSlug: "boiler-repair" };
  }
  if (value.includes("gas safety")) {
    return { serviceSlug: "boilers", jobTypeSlug: "gas-safety-cert" };
  }
  if (value.includes("power flush")) {
    return { serviceSlug: "power-flushing", jobTypeSlug: "power-flush" };
  }
  return { serviceSlug: null, jobTypeSlug: null };
}

export function mapDealStatus(status) {
  const value = normalizeText(status);
  switch (value) {
    case "lead new":
      return { leadStatus: "new", jobStatus: null, lostReason: null };
    case "lead contacted":
      return { leadStatus: "contacted", jobStatus: null, lostReason: null };
    case "survey follow up":
      return { leadStatus: "follow_up", jobStatus: null, lostReason: null };
    case "survey booked":
      return { leadStatus: "survey_booked", jobStatus: null, lostReason: null };
    case "survey unsuccessful":
      return { leadStatus: "lost", jobStatus: null, lostReason: "Survey unsuccessful" };
    case "cancelled no further action":
      return { leadStatus: "lost", jobStatus: null, lostReason: "Cancelled - no further action" };
    case "order placed":
    case "job booked":
      return { leadStatus: "booked", jobStatus: "booked", lostReason: null };
    case "order completed":
    case "job completed":
      return { leadStatus: "completed", jobStatus: "completed", lostReason: null };
    default:
      return { leadStatus: "new", jobStatus: null, lostReason: null };
  }
}

export function prepareWorkbookImport(workbook) {
  const sheets = new Map((workbook.sheets ?? []).map((sheet) => [sheet.name, sheet.rows ?? []]));

  const customerRows = (sheets.get("customer_list") ?? []).map((row, index) => {
    const address = clean(row.Address);
    return {
      rowNumber: index + 2,
      fullName: clean(row.Customer),
      email: normalizeEmail(row.Email),
      phone: phoneForStorage(row["Mobile / Contact"]),
      phoneKey: normalizePhone(row["Mobile / Contact"]),
      addressLine1: address || null,
      addressKey: normalizeAddress(address),
      postcode: extractPostcode(address),
      postcodeKey: normalizePostcode(extractPostcode(address)),
      notes: clean(row.Notes),
    };
  });

  const dealRows = (sheets.get("Deals") ?? []).map((row, index) => {
    const address = clean(row.Address);
    const dealDate = parseExcelDate(row.Date);
    const classification = classifyDealType(row.Type);
    const status = mapDealStatus(row.Status);
    return {
      rowNumber: index + 2,
      dealDate,
      dealId: clean(row["Deal ID"]),
      fullName: clean(row.Customer),
      addressLine1: address || null,
      addressKey: normalizeAddress(address),
      postcode: extractPostcode(address),
      postcodeKey: normalizePostcode(extractPostcode(address)),
      type: clean(row.Type),
      source: clean(row.Source),
      quoteState: clean(row.Quotes),
      invoiceState: clean(row.Invoices),
      jobState: clean(row.Jobs),
      paymentState: clean(row.Payments),
      originalStatus: clean(row.Status),
      ...classification,
      ...status,
    };
  });

  return { customerRows, dealRows };
}

export function assertEmpireTenant(tenant) {
  if (!tenant) {
    throw new Error("Empire tenant was not found.");
  }
  if (tenant.id !== EMPIRE_TENANT.id || tenant.slug !== EMPIRE_TENANT.slug || tenant.name !== EMPIRE_TENANT.name) {
    throw new Error(
      `Refusing import: expected ${EMPIRE_TENANT.name} (${EMPIRE_TENANT.id}), got ${tenant.name ?? "unknown"} (${tenant.id ?? "unknown"}).`,
    );
  }
}

function customerKeys(customer) {
  const nameKey = normalizeText(customer.full_name ?? customer.fullName);
  const emailKey = normalizeEmail(customer.email);
  const phoneKey = normalizePhone(customer.phone);
  const postcodeKey = normalizePostcode(customer.postcode);
  const addressKey = normalizeAddress(customer.address_line1 ?? customer.addressLine1);
  return {
    emailKey,
    phoneKey,
    nameAddressKey: nameKey && addressKey ? `${nameKey}|${addressKey}` : null,
    namePostcodeKey: nameKey && postcodeKey ? `${nameKey}|${postcodeKey}` : null,
    nameKey,
    postcodeKey,
  };
}

function addIndex(index, key, value) {
  if (!value) return;
  const values = index.get(value) ?? [];
  values.push(key);
  index.set(value, values);
}

function buildCustomerIndex(customers) {
  const byKey = new Map();
  const indexes = {
    email: new Map(),
    phone: new Map(),
    nameAddress: new Map(),
    namePostcode: new Map(),
  };

  for (const customer of customers) {
    byKey.set(customer.key, customer);
    const keys = customerKeys(customer);
    addIndex(indexes.email, customer.key, keys.emailKey);
    addIndex(indexes.phone, customer.key, keys.phoneKey);
    addIndex(indexes.nameAddress, customer.key, keys.nameAddressKey);
    addIndex(indexes.namePostcode, customer.key, keys.namePostcodeKey);
  }

  return { byKey, indexes };
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function findMatches(row, customerIndex) {
  const rowKeys = customerKeys(row);
  const contactMatches = unique([
    ...(rowKeys.emailKey ? customerIndex.indexes.email.get(rowKeys.emailKey) ?? [] : []),
    ...(rowKeys.phoneKey ? customerIndex.indexes.phone.get(rowKeys.phoneKey) ?? [] : []),
  ]);
  const identityMatches = unique([
    ...(rowKeys.nameAddressKey ? customerIndex.indexes.nameAddress.get(rowKeys.nameAddressKey) ?? [] : []),
    ...(rowKeys.namePostcodeKey ? customerIndex.indexes.namePostcode.get(rowKeys.namePostcodeKey) ?? [] : []),
  ]);

  return { contactMatches, identityMatches };
}

function hasContactConflict(candidate, row) {
  const candidateName = normalizeText(candidate.full_name ?? candidate.fullName);
  const rowName = normalizeText(row.fullName);
  if (candidateName && rowName && candidateName !== rowName) {
    return `contact matched ${candidate.full_name ?? candidate.fullName}, but row name is ${row.fullName}`;
  }

  const candidatePostcode = normalizePostcode(candidate.postcode);
  const rowPostcode = normalizePostcode(row.postcode);
  if (candidatePostcode && rowPostcode && candidatePostcode !== rowPostcode) {
    return `contact matched ${candidate.full_name ?? candidate.fullName}, but row postcode is ${row.postcode}`;
  }

  return null;
}

function customerPayload(row) {
  return {
    tenant_id: EMPIRE_TENANT.id,
    full_name: row.fullName,
    phone: row.phone,
    email: row.email,
    address_line1: row.addressLine1,
    postcode: row.postcode,
    source: IMPORT_SOURCE,
    notes: buildCustomerNotes(row),
    archived: false,
    is_test: false,
  };
}

function buildCustomerNotes(row) {
  const lines = [IMPORT_SOURCE, `Source sheet: customer_list`, `Workbook row: ${row.rowNumber}`];
  if (row.notes && row.notes.toLowerCase() !== "n/a") {
    lines.push("", row.notes);
  }
  return lines.join("\n");
}

function buildDealNotes(deal) {
  return [
    IMPORT_SOURCE,
    `Source sheet: Deals`,
    `Workbook row: ${deal.rowNumber}`,
    `Deal ID: ${deal.dealId || "missing"}`,
    `Deal date: ${deal.dealDate || "not provided"}`,
    `Original status: ${deal.originalStatus || "not provided"}`,
    `Original type: ${deal.type || "not provided"}`,
    `Original source: ${deal.source || "not provided"}`,
    `Quote state: ${deal.quoteState || "not provided"}`,
    `Invoice state: ${deal.invoiceState || "not provided"}`,
    `Job state: ${deal.jobState || "not provided"}`,
    `Payment state: ${deal.paymentState || "not provided"}`,
  ].join("\n");
}

function dealCreatedAt(deal) {
  return deal.dealDate ? `${deal.dealDate}T12:00:00.000Z` : undefined;
}

function leadPayload(deal, customerId, catalog) {
  const serviceId = deal.serviceSlug ? catalog.serviceIdsBySlug.get(deal.serviceSlug) ?? null : null;
  const jobTypeId = deal.jobTypeSlug ? catalog.jobTypeIdsBySlug.get(deal.jobTypeSlug) ?? null : null;
  const createdAt = dealCreatedAt(deal);
  return {
    tenant_id: EMPIRE_TENANT.id,
    customer_id: customerId,
    service_id: serviceId,
    job_type_id: jobTypeId,
    status: deal.leadStatus,
    lost_reason: deal.lostReason,
    source: deal.source || IMPORT_SOURCE,
    notes: buildDealNotes(deal),
    created_at: createdAt,
    updated_at: createdAt,
    is_test: false,
  };
}

function jobPayload(deal, customerId, leadId, catalog) {
  const serviceId = deal.serviceSlug ? catalog.serviceIdsBySlug.get(deal.serviceSlug) ?? null : null;
  const jobTypeId = deal.jobTypeSlug ? catalog.jobTypeIdsBySlug.get(deal.jobTypeSlug) ?? null : null;
  const createdAt = dealCreatedAt(deal);
  const title = [deal.type || "EHS workbook deal", deal.fullName].filter(Boolean).join(" - ");
  return {
    tenant_id: EMPIRE_TENANT.id,
    customer_id: customerId,
    lead_id: leadId,
    service_id: serviceId,
    job_type_id: jobTypeId,
    title,
    description: buildDealNotes(deal),
    status: deal.jobStatus,
    created_at: createdAt,
    updated_at: createdAt,
    is_test: false,
  };
}

function sitePayload(row, customerId) {
  return {
    tenant_id: EMPIRE_TENANT.id,
    customer_id: customerId,
    label: "Primary Site",
    address_line1: row.addressLine1,
    postcode: row.postcode,
    is_primary: true,
    is_demo: false,
  };
}

function extractDealIdFromNotes(notes) {
  const match = clean(notes).match(/^Deal ID:\s*(.+)$/im);
  return match ? match[1].trim() : null;
}

export function makeCatalog(services = [], jobTypes = []) {
  return {
    serviceIdsBySlug: new Map(services.map((service) => [service.slug, service.id])),
    jobTypeIdsBySlug: new Map(jobTypes.map((jobType) => [jobType.slug, jobType.id])),
  };
}

export function makeExistingState(state = {}) {
  return {
    customers: state.customers ?? [],
    sites: state.sites ?? [],
    leads: state.leads ?? [],
    jobs: state.jobs ?? [],
  };
}

export function buildImportPlan(prepared, existingState, catalog) {
  const plan = {
    customerCreates: [],
    siteCreates: [],
    leadCreates: [],
    jobCreates: [],
    skippedCustomers: [],
    skippedDeals: [],
    reviewItems: [],
    customerMappings: new Map(),
  };
  const siteSourcesByCustomerKey = new Map();

  const existingCustomers = existingState.customers
    .filter((customer) => customer.tenant_id === EMPIRE_TENANT.id && customer.is_test !== true)
    .map((customer) => ({ key: `existing:${customer.id}`, ...customer }));
  const customerIndex = buildCustomerIndex(existingCustomers);
  let tempCustomerSequence = 0;

  for (const row of prepared.customerRows) {
    if (!row.fullName) {
      plan.reviewItems.push({ kind: "customer_missing_name", rowNumber: row.rowNumber });
      continue;
    }

    const { contactMatches, identityMatches } = findMatches(row, customerIndex);
    const candidateKeys = contactMatches.length > 0 ? contactMatches : identityMatches;

    if (candidateKeys.length > 1) {
      plan.reviewItems.push({
        kind: "customer_multiple_matches",
        rowNumber: row.rowNumber,
        fullName: row.fullName,
        matchCount: candidateKeys.length,
      });
      continue;
    }

    if (candidateKeys.length === 1) {
      const candidate = customerIndex.byKey.get(candidateKeys[0]);
      const conflict = contactMatches.length > 0 ? hasContactConflict(candidate, row) : null;
      if (conflict) {
        plan.reviewItems.push({
          kind: "customer_contact_conflict",
          rowNumber: row.rowNumber,
          fullName: row.fullName,
          reason: conflict,
        });
        continue;
      }
      plan.customerMappings.set(`customer_list:${row.rowNumber}`, candidate.key);
      if (row.addressLine1) {
        siteSourcesByCustomerKey.set(candidate.key, row);
      }
      plan.skippedCustomers.push({ rowNumber: row.rowNumber, reason: "matched_existing_or_planned", customerKey: candidate.key });
      continue;
    }

    const tempKey = `planned:customer:${tempCustomerSequence += 1}`;
    const payload = customerPayload(row);
    const plannedCustomer = {
      key: tempKey,
      id: tempKey,
      full_name: payload.full_name,
      phone: payload.phone,
      email: payload.email,
      address_line1: payload.address_line1,
      postcode: payload.postcode,
      tenant_id: EMPIRE_TENANT.id,
      is_test: false,
      payload,
      sourceRow: row,
    };
    customerIndex.byKey.set(tempKey, plannedCustomer);
    const keys = customerKeys(plannedCustomer);
    addIndex(customerIndex.indexes.email, tempKey, keys.emailKey);
    addIndex(customerIndex.indexes.phone, tempKey, keys.phoneKey);
    addIndex(customerIndex.indexes.nameAddress, tempKey, keys.nameAddressKey);
    addIndex(customerIndex.indexes.namePostcode, tempKey, keys.namePostcodeKey);
    plan.customerCreates.push({ tempKey, row, payload });
    plan.customerMappings.set(`customer_list:${row.rowNumber}`, tempKey);
    if (row.addressLine1) {
      siteSourcesByCustomerKey.set(tempKey, row);
    }
  }

  const existingSiteKeys = new Set(
    existingState.sites.map((site) => {
      const addressKey = normalizeAddress(site.address_line1);
      const postcodeKey = normalizePostcode(site.postcode);
      return `${site.customer_id}|${addressKey ?? ""}|${postcodeKey ?? ""}`;
    }),
  );

  for (const [customerKey, sourceRow] of siteSourcesByCustomerKey.entries()) {
    const customer = customerIndex.byKey.get(customerKey);
    if (!customer || !sourceRow.addressLine1) continue;
    const addressKey = normalizeAddress(sourceRow.addressLine1);
    const postcodeKey = normalizePostcode(sourceRow.postcode);
    const key = `${customer.id}|${addressKey ?? ""}|${postcodeKey ?? ""}`;
    if (existingSiteKeys.has(key)) continue;
    plan.siteCreates.push({
      customerKey: customer.key,
      payload: sitePayload(sourceRow, customer.id),
    });
    existingSiteKeys.add(key);
  }

  const existingDealLeadIds = new Map();
  for (const lead of existingState.leads) {
    const dealId = extractDealIdFromNotes(lead.notes);
    if (dealId) existingDealLeadIds.set(dealId, lead);
  }
  const existingDealJobIds = new Set();
  for (const job of existingState.jobs) {
    const dealId = extractDealIdFromNotes(job.description);
    if (dealId) existingDealJobIds.add(dealId);
  }

  let tempLeadSequence = 0;
  for (const deal of prepared.dealRows) {
    if (!deal.dealId) {
      plan.reviewItems.push({ kind: "deal_missing_id", rowNumber: deal.rowNumber, fullName: deal.fullName });
      continue;
    }

    const existingLead = existingDealLeadIds.get(deal.dealId);
    if (existingLead && (!deal.jobStatus || existingDealJobIds.has(deal.dealId))) {
      plan.skippedDeals.push({ rowNumber: deal.rowNumber, dealId: deal.dealId, reason: "deal_id_already_imported" });
      continue;
    }

    const { identityMatches } = findMatches(deal, customerIndex);
    if (identityMatches.length !== 1) {
      plan.reviewItems.push({
        kind: identityMatches.length > 1 ? "deal_multiple_customer_matches" : "deal_unmatched_customer",
        rowNumber: deal.rowNumber,
        dealId: deal.dealId,
        fullName: deal.fullName,
      });
      continue;
    }

    const customerKey = identityMatches[0];
    const customer = customerIndex.byKey.get(customerKey);
    const customerId = customer.id;
    let leadTempKey = existingLead ? `existing-lead:${existingLead.id}` : `planned:lead:${tempLeadSequence += 1}`;

    if (!existingLead) {
      const payload = leadPayload(deal, customerId, catalog);
      plan.leadCreates.push({ tempKey: leadTempKey, customerKey, deal, payload });
    }

    if (deal.jobStatus && !existingDealJobIds.has(deal.dealId)) {
      const payload = jobPayload(deal, customerId, existingLead?.id ?? leadTempKey, catalog);
      plan.jobCreates.push({ leadKey: leadTempKey, customerKey, deal, payload });
    }
  }

  return plan;
}

export function summarizePlan(plan) {
  return {
    customersToCreate: plan.customerCreates.length,
    sitesToCreate: plan.siteCreates.length,
    leadsToCreate: plan.leadCreates.length,
    jobsToCreate: plan.jobCreates.length,
    skippedCustomers: plan.skippedCustomers.length,
    skippedDeals: plan.skippedDeals.length,
    reviewItems: plan.reviewItems.length,
  };
}

export function formatPlanReport(plan) {
  const summary = summarizePlan(plan);
  const lines = [
    "EHS customer data import preview",
    `  customers to create: ${summary.customersToCreate}`,
    `  sites to create:     ${summary.sitesToCreate}`,
    `  leads to create:     ${summary.leadsToCreate}`,
    `  jobs to create:      ${summary.jobsToCreate}`,
    `  skipped customers:   ${summary.skippedCustomers}`,
    `  skipped deals:       ${summary.skippedDeals}`,
    `  review items:        ${summary.reviewItems}`,
  ];

  if (plan.reviewItems.length > 0) {
    lines.push("", "Review list:");
    for (const item of plan.reviewItems.slice(0, 30)) {
      lines.push(`  - ${item.kind} row=${item.rowNumber}${item.dealId ? ` deal=${item.dealId}` : ""}${item.reason ? ` reason=${item.reason}` : ""}`);
    }
    if (plan.reviewItems.length > 30) {
      lines.push(`  ... ${plan.reviewItems.length - 30} more review items`);
    }
  }

  return lines.join("\n");
}

function resolveRuntimeId(runtimeIds, key) {
  if (!key) return null;
  if (key.startsWith("existing:")) return key.slice("existing:".length);
  if (key.startsWith("existing-lead:")) return key.slice("existing-lead:".length);
  return runtimeIds.get(key) ?? key;
}

export async function applyImportPlan(admin, plan) {
  const runtimeIds = new Map();
  const created = {
    customers: [],
    sites: [],
    leads: [],
    jobs: [],
  };

  for (const entry of plan.customerCreates) {
    const { data, error } = await admin.schema("crm").from("customers").insert(entry.payload).select("id").single();
    if (error) throw error;
    runtimeIds.set(entry.tempKey, data.id);
    created.customers.push(data.id);
  }

  for (const entry of plan.siteCreates) {
    const customerId = resolveRuntimeId(runtimeIds, entry.customerKey);
    const payload = { ...entry.payload, customer_id: customerId };
    const { data, error } = await admin.schema("crm").from("sites").insert(payload).select("id").single();
    if (error) throw error;
    created.sites.push(data.id);
  }

  for (const entry of plan.leadCreates) {
    const customerId = resolveRuntimeId(runtimeIds, entry.customerKey);
    const payload = { ...entry.payload, customer_id: customerId };
    const { data, error } = await admin.schema("crm").from("leads").insert(payload).select("id").single();
    if (error) throw error;
    runtimeIds.set(entry.tempKey, data.id);
    created.leads.push(data.id);
  }

  for (const entry of plan.jobCreates) {
    const customerId = resolveRuntimeId(runtimeIds, entry.customerKey);
    const leadId = resolveRuntimeId(runtimeIds, entry.leadKey);
    const payload = { ...entry.payload, customer_id: customerId, lead_id: leadId };
    const { data, error } = await admin.schema("crm").from("jobs").insert(payload).select("id").single();
    if (error) throw error;
    created.jobs.push(data.id);
  }

  return created;
}

async function fetchRowsByIds(admin, table, ids, select) {
  if (ids.length === 0) return [];
  const { data, error } = await admin.schema("crm").from(table).select(select).in("id", ids);
  if (error) throw error;
  return data ?? [];
}

export async function verifyImportedRows(admin, created) {
  const customers = await fetchRowsByIds(admin, "customers", created.customers, "id, tenant_id, is_test");
  const sites = await fetchRowsByIds(admin, "sites", created.sites, "id, tenant_id, is_demo");
  const leads = await fetchRowsByIds(admin, "leads", created.leads, "id, tenant_id, is_test");
  const jobs = await fetchRowsByIds(admin, "jobs", created.jobs, "id, tenant_id, is_test");

  for (const row of customers) {
    if (row.tenant_id !== EMPIRE_TENANT.id || row.is_test !== false) {
      throw new Error(`Customer verification failed for ${row.id}`);
    }
  }
  for (const row of sites) {
    if (row.tenant_id !== EMPIRE_TENANT.id || row.is_demo !== false) {
      throw new Error(`Site verification failed for ${row.id}`);
    }
  }
  for (const row of leads) {
    if (row.tenant_id !== EMPIRE_TENANT.id || row.is_test !== false) {
      throw new Error(`Lead verification failed for ${row.id}`);
    }
  }
  for (const row of jobs) {
    if (row.tenant_id !== EMPIRE_TENANT.id || row.is_test !== false) {
      throw new Error(`Job verification failed for ${row.id}`);
    }
  }

  return {
    customers: customers.length,
    sites: sites.length,
    leads: leads.length,
    jobs: jobs.length,
  };
}
