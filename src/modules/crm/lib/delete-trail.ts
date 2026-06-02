import { createHash } from "crypto";

export const deleteTrailRootTypes = ["customer", "job", "lead", "appointment", "ai_recovery_case"] as const;
export type DeleteTrailRootType = (typeof deleteTrailRootTypes)[number];

type AnySupabase = {
  schema: (schema: string) => {
    from: (table: string) => unknown;
  };
  storage?: {
    from: (bucket: string) => {
      remove: (paths: string[]) => Promise<{ data?: unknown; error?: { message: string } | null }>;
    };
  };
};

type SupabaseQueryResult = {
  data?: unknown;
  error?: { message: string } | null;
};

type SupabaseQuery = PromiseLike<SupabaseQueryResult> & {
  select: (...args: unknown[]) => SupabaseQuery;
  eq: (column: string, value: unknown) => SupabaseQuery;
  in: (column: string, values: readonly unknown[]) => SupabaseQuery;
  is: (column: string, value: null) => SupabaseQuery;
  or: (expression: string) => SupabaseQuery;
  order: (...args: unknown[]) => SupabaseQuery;
  limit: (count: number) => SupabaseQuery;
  returns: <T = unknown>() => PromiseLike<{ data?: T; error?: { message: string } | null }>;
  maybeSingle: () => PromiseLike<SupabaseQueryResult>;
  single: () => PromiseLike<SupabaseQueryResult>;
  insert: (payload: unknown) => SupabaseQuery;
  update: (payload: Record<string, unknown>) => SupabaseQuery;
  delete: () => SupabaseQuery;
};

type DeletionRequestRow = { id: string; status?: string };

function fromCrm(supabase: AnySupabase, table: string) {
  return supabase.schema("crm").from(table) as SupabaseQuery;
}

export type DeleteTrailPlanItem = {
  table: string;
  label: string;
  count: number;
};

export type DeleteTrailPlan = {
  root: {
    type: DeleteTrailRootType;
    id: string;
    label: string;
  };
  mode: "compliance_safe";
  confirmationPhrase: string;
  planHash: string;
  will_delete: DeleteTrailPlanItem[];
  will_anonymise: DeleteTrailPlanItem[];
  will_unlink: DeleteTrailPlanItem[];
  storage_cleanup: DeleteTrailPlanItem[];
  warnings: string[];
  blockers: string[];
  internal: {
    tenantId: string;
    customerIds: string[];
    leadIds: string[];
    jobIds: string[];
    appointmentIds: string[];
    deleteIds: Record<string, string[]>;
    anonymiseIds: Record<string, string[]>;
    storagePaths: string[];
  };
};

type IdSets = {
  customerIds: Set<string>;
  leadIds: Set<string>;
  jobIds: Set<string>;
  appointmentIds: Set<string>;
  siteIds: Set<string>;
  platformLinkIds: Set<string>;
  platformEventIds: Set<string>;
};

const tableLabels: Record<string, string> = {
  appointments: "appointments",
  attachments: "attachments",
  customer_assets: "customer assets",
  custom_field_values: "custom field values",
  expenses: "expenses",
  job_assignees: "job assignments",
  job_certificates: "job certificates",
  job_checklists: "job checklists",
  job_hazards: "job hazards",
  job_phases: "job phases",
  job_variations: "job variations",
  notes: "notes",
  platform_conversation_links: "AI conversation links",
  purchase_orders: "purchase orders",
  scheduled_notifications: "pending notifications",
  site_contacts: "site contacts",
  sites: "sites",
  supplier_reconciliation: "supplier reconciliation",
};

function sorted(values: Iterable<string>) {
  return [...new Set([...values].filter(Boolean))].sort();
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function pickString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

function bookingIdFromPayload(payload: Record<string, unknown>) {
  return pickString(payload, ["booking_id", "booking_uid", "calcom_booking_id"]);
}

function addIfPresent(set: Set<string>, value: unknown) {
  if (typeof value === "string" && value.length > 0) {
    set.add(value);
  }
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function runRows<T>(query: PromiseLike<SupabaseQueryResult>): Promise<T[]> {
  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []) as T[];
}

async function maybeSingle<T>(query: PromiseLike<SupabaseQueryResult>): Promise<T | null> {
  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? null) as T | null;
}

async function selectByIds<T extends { id: string }>(
  supabase: AnySupabase,
  tenantId: string,
  table: string,
  ids: Iterable<string>,
  columns = "*",
) {
  const idList = sorted(ids);
  if (idList.length === 0) {
    return [] as T[];
  }
  return runRows<T>(
    fromCrm(supabase, table).select(columns).eq("tenant_id", tenantId).in("id", idList),
  );
}

async function selectByColumn<T extends { id: string }>(
  supabase: AnySupabase,
  tenantId: string,
  table: string,
  column: string,
  values: Iterable<string>,
  columns = "id",
) {
  const valueList = sorted(values);
  if (valueList.length === 0) {
    return [] as T[];
  }
  return runRows<T>(
    fromCrm(supabase, table).select(columns).eq("tenant_id", tenantId).in(column, valueList),
  );
}

async function selectEntityRows<T extends { id: string }>(
  supabase: AnySupabase,
  tenantId: string,
  table: string,
  entityType: string,
  entityIds: Iterable<string>,
  columns = "id",
) {
  const idList = sorted(entityIds);
  if (idList.length === 0) {
    return [] as T[];
  }
  return runRows<T>(
    fromCrm(supabase, table)
      .select(columns)
      .eq("tenant_id", tenantId)
      .eq("entity_type", entityType)
      .in("entity_id", idList),
  );
}

function planHashFor(plan: Omit<DeleteTrailPlan, "planHash">) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        root: plan.root,
        mode: plan.mode,
        confirmationPhrase: plan.confirmationPhrase,
        will_delete: plan.will_delete,
        will_anonymise: plan.will_anonymise,
        will_unlink: plan.will_unlink,
        storage_cleanup: plan.storage_cleanup,
        internal: plan.internal,
      }),
    )
    .digest("hex");
}

function countItem(table: string, ids: Iterable<string>, label = tableLabels[table] ?? table): DeleteTrailPlanItem | null {
  const count = sorted(ids).length;
  return count > 0 ? { table, label, count } : null;
}

function pushItem(items: DeleteTrailPlanItem[], item: DeleteTrailPlanItem | null) {
  if (item) {
    items.push(item);
  }
}

async function collectRoot(
  supabase: AnySupabase,
  tenantId: string,
  rootType: DeleteTrailRootType,
  rootId: string,
  ids: IdSets,
) {
  if (rootType === "customer") {
    const customer = await maybeSingle<{ id: string; full_name: string | null }>(
      fromCrm(supabase, "customers")
        .select("id, full_name")
        .eq("tenant_id", tenantId)
        .eq("id", rootId)
        .maybeSingle(),
    );
    if (!customer) return null;
    ids.customerIds.add(customer.id);
    return customer.full_name ?? "Customer";
  }

  if (rootType === "job") {
    const job = await maybeSingle<{ id: string; title: string | null; lead_id: string | null }>(
      fromCrm(supabase, "jobs")
        .select("id, title, lead_id")
        .eq("tenant_id", tenantId)
        .eq("id", rootId)
        .maybeSingle(),
    );
    if (!job) return null;
    ids.jobIds.add(job.id);
    addIfPresent(ids.leadIds, job.lead_id);
    return job.title ?? "Job";
  }

  if (rootType === "lead") {
    const lead = await maybeSingle<{ id: string; customer_id: string | null; source: string | null }>(
      fromCrm(supabase, "leads")
        .select("id, customer_id, source")
        .eq("tenant_id", tenantId)
        .eq("id", rootId)
        .maybeSingle(),
    );
    if (!lead) return null;
    ids.leadIds.add(lead.id);
    return lead.source ? `${lead.source} enquiry` : "Enquiry";
  }

  if (rootType === "appointment") {
    const appointment = await maybeSingle<{
      id: string;
      title: string | null;
      lead_id: string | null;
      job_id: string | null;
    }>(
      fromCrm(supabase, "appointments")
        .select("id, title, lead_id, job_id")
        .eq("tenant_id", tenantId)
        .eq("id", rootId)
        .maybeSingle(),
    );
    if (!appointment) return null;
    ids.appointmentIds.add(appointment.id);
    addIfPresent(ids.leadIds, appointment.lead_id);
    addIfPresent(ids.jobIds, appointment.job_id);
    return appointment.title ?? "Appointment";
  }

  if (rootType === "ai_recovery_case") {
    if (rootId.startsWith("review:")) {
      const linkId = rootId.slice("review:".length);
      const link = await maybeSingle<{
        id: string;
        customer_id: string | null;
        lead_id: string | null;
        job_id: string | null;
        booking_appointment_id: string | null;
      }>(
        fromCrm(supabase, "platform_conversation_links")
          .select("id, customer_id, lead_id, job_id, booking_appointment_id")
          .eq("tenant_id", tenantId)
          .eq("id", linkId)
          .maybeSingle(),
      );
      if (!link) return null;
      ids.platformLinkIds.add(link.id);
      addIfPresent(ids.leadIds, link.lead_id);
      addIfPresent(ids.jobIds, link.job_id);
      addIfPresent(ids.appointmentIds, link.booking_appointment_id);
      return "AI recovery review";
    }

    if (rootId.startsWith("appointment:")) {
      const bookingId = rootId.slice("appointment:".length);
      const clauses = [`external_id.eq.${bookingId}`];
      if (isUuid(bookingId)) {
        clauses.push(`id.eq.${bookingId}`);
      }
      const appointment = await maybeSingle<{
        id: string;
        title: string | null;
        external_id: string | null;
        lead_id: string | null;
        job_id: string | null;
      }>(
        fromCrm(supabase, "appointments")
        .select("id, title, external_id, lead_id, job_id")
        .eq("tenant_id", tenantId)
        .or(clauses.join(","))
        .maybeSingle(),
      );
      if (!appointment) return null;
      ids.appointmentIds.add(appointment.id);
      addIfPresent(ids.leadIds, appointment.lead_id);
      addIfPresent(ids.jobIds, appointment.job_id);
      return appointment.title ?? "AI recovery appointment";
    }

    const event = await maybeSingle<{ event_id: string; payload: Record<string, unknown> }>(
      fromCrm(supabase, "platform_event_log")
        .select("event_id, payload")
        .eq("tenant_id", tenantId)
        .eq("event_id", rootId)
        .maybeSingle(),
    );
    if (!event) return null;
    ids.platformEventIds.add(event.event_id);
    const bookingId = bookingIdFromPayload(asRecord(event.payload));
    if (bookingId) {
      const appointment = await maybeSingle<{ id: string; lead_id: string | null; job_id: string | null }>(
        fromCrm(supabase, "appointments")
          .select("id, lead_id, job_id")
          .eq("tenant_id", tenantId)
          .eq("external_id", bookingId)
          .maybeSingle(),
      );
      if (appointment) {
        ids.appointmentIds.add(appointment.id);
        addIfPresent(ids.leadIds, appointment.lead_id);
        addIfPresent(ids.jobIds, appointment.job_id);
      }
    }
    return "AI recovery event";
  }

  return null;
}

async function expandIds(supabase: AnySupabase, tenantId: string, rootType: DeleteTrailRootType, ids: IdSets) {
  for (let i = 0; i < 4; i += 1) {
    const before = JSON.stringify({
      customers: sorted(ids.customerIds),
      leads: sorted(ids.leadIds),
      jobs: sorted(ids.jobIds),
      appointments: sorted(ids.appointmentIds),
      sites: sorted(ids.siteIds),
    });

    if (rootType === "customer") {
      for (const job of await selectByColumn<{ id: string; lead_id: string | null }>(
        supabase,
        tenantId,
        "jobs",
        "customer_id",
        ids.customerIds,
        "id, lead_id",
      )) {
        ids.jobIds.add(job.id);
        addIfPresent(ids.leadIds, job.lead_id);
      }
      for (const lead of await selectByColumn<{ id: string }>(supabase, tenantId, "leads", "customer_id", ids.customerIds)) {
        ids.leadIds.add(lead.id);
      }
      for (const appointment of await selectByColumn<{ id: string; lead_id: string | null; job_id: string | null }>(
        supabase,
        tenantId,
        "appointments",
        "customer_id",
        ids.customerIds,
        "id, lead_id, job_id",
      )) {
        ids.appointmentIds.add(appointment.id);
        addIfPresent(ids.leadIds, appointment.lead_id);
        addIfPresent(ids.jobIds, appointment.job_id);
      }
      for (const site of await selectByColumn<{ id: string }>(supabase, tenantId, "sites", "customer_id", ids.customerIds)) {
        ids.siteIds.add(site.id);
      }
    }

    for (const job of await selectByColumn<{ id: string; lead_id: string | null }>(
      supabase,
      tenantId,
      "jobs",
      "lead_id",
      ids.leadIds,
      "id, lead_id",
    )) {
      ids.jobIds.add(job.id);
      addIfPresent(ids.leadIds, job.lead_id);
    }

    for (const appointment of await selectByColumn<{ id: string; lead_id: string | null; job_id: string | null }>(
      supabase,
      tenantId,
      "appointments",
      "lead_id",
      ids.leadIds,
      "id, lead_id, job_id",
    )) {
      ids.appointmentIds.add(appointment.id);
      addIfPresent(ids.jobIds, appointment.job_id);
    }

    for (const appointment of await selectByColumn<{ id: string; lead_id: string | null; job_id: string | null }>(
      supabase,
      tenantId,
      "appointments",
      "job_id",
      ids.jobIds,
      "id, lead_id, job_id",
    )) {
      ids.appointmentIds.add(appointment.id);
      addIfPresent(ids.leadIds, appointment.lead_id);
      addIfPresent(ids.jobIds, appointment.job_id);
    }

    for (const appointment of await selectByIds<{ id: string; lead_id: string | null; job_id: string | null }>(
      supabase,
      tenantId,
      "appointments",
      ids.appointmentIds,
      "id, lead_id, job_id",
    )) {
      addIfPresent(ids.leadIds, appointment.lead_id);
      addIfPresent(ids.jobIds, appointment.job_id);
    }

    const after = JSON.stringify({
      customers: sorted(ids.customerIds),
      leads: sorted(ids.leadIds),
      jobs: sorted(ids.jobIds),
      appointments: sorted(ids.appointmentIds),
      sites: sorted(ids.siteIds),
    });
    if (before === after) {
      break;
    }
  }
}

async function collectDeleteRows(supabase: AnySupabase, tenantId: string, ids: IdSets) {
  const deleteIds: Record<string, string[]> = {};
  const storagePaths = new Set<string>();

  async function setRows(table: string, rows: Array<{ id: string }>) {
    deleteIds[table] = sorted(rows.map((row) => row.id));
  }

  await setRows("appointments", await selectByIds(supabase, tenantId, "appointments", ids.appointmentIds));
  await setRows("customer_assets", await selectByColumn(supabase, tenantId, "customer_assets", "customer_id", ids.customerIds));
  await setRows("site_contacts", await selectByColumn(supabase, tenantId, "site_contacts", "site_id", ids.siteIds));
  await setRows("sites", await selectByIds(supabase, tenantId, "sites", ids.siteIds));

  for (const table of [
    "supplier_reconciliation",
    "purchase_orders",
    "job_certificates",
    "job_checklists",
    "job_hazards",
    "job_variations",
    "job_phases",
    "job_assignees",
    "expenses",
  ]) {
    const rows = await selectByColumn<{ id: string; file_url?: string | null }>(
      supabase,
      tenantId,
      table,
      "job_id",
      ids.jobIds,
      table === "job_certificates" ? "id, file_url" : "id",
    );
    if (table === "job_certificates") {
      rows.forEach((row) => addIfPresent(storagePaths, row.file_url));
    }
    await setRows(table, rows);
  }

  const noteRows = [
    ...(await selectEntityRows(supabase, tenantId, "notes", "customer", ids.customerIds)),
    ...(await selectEntityRows(supabase, tenantId, "notes", "lead", ids.leadIds)),
    ...(await selectEntityRows(supabase, tenantId, "notes", "job", ids.jobIds)),
  ];
  await setRows("notes", noteRows);

  const attachmentRows = [
    ...(await selectEntityRows<{ id: string; file_url: string }>(supabase, tenantId, "attachments", "customer", ids.customerIds, "id, file_url")),
    ...(await selectEntityRows<{ id: string; file_url: string }>(supabase, tenantId, "attachments", "lead", ids.leadIds, "id, file_url")),
    ...(await selectEntityRows<{ id: string; file_url: string }>(supabase, tenantId, "attachments", "job", ids.jobIds, "id, file_url")),
  ];
  attachmentRows.forEach((row) => addIfPresent(storagePaths, row.file_url));
  await setRows("attachments", attachmentRows);

  const customFieldRows = [
    ...(await selectEntityRows(supabase, tenantId, "custom_field_values", "customer", ids.customerIds)),
    ...(await selectEntityRows(supabase, tenantId, "custom_field_values", "lead", ids.leadIds)),
    ...(await selectEntityRows(supabase, tenantId, "custom_field_values", "job", ids.jobIds)),
    ...(await selectEntityRows(supabase, tenantId, "custom_field_values", "asset", deleteIds.customer_assets ?? [])),
  ];
  await setRows("custom_field_values", customFieldRows);

  const platformLinks = await runRows<{ id: string }>(
    fromCrm(supabase, "platform_conversation_links")
      .select("id")
      .eq("tenant_id", tenantId)
      .or(
        [
          ...sorted(ids.platformLinkIds).map((id) => `id.eq.${id}`),
          ...sorted(ids.customerIds).map((id) => `customer_id.eq.${id}`),
          ...sorted(ids.leadIds).map((id) => `lead_id.eq.${id}`),
          ...sorted(ids.jobIds).map((id) => `job_id.eq.${id}`),
          ...sorted(ids.appointmentIds).flatMap((id) => [
            `callback_appointment_id.eq.${id}`,
            `booking_appointment_id.eq.${id}`,
          ]),
        ].join(",") || "id.is.null",
      ),
  );
  await setRows("platform_conversation_links", platformLinks);

  const notifications = await runRows<{ id: string; metadata: Record<string, unknown> }>(
    fromCrm(supabase, "scheduled_notifications")
      .select("id, metadata")
      .eq("tenant_id", tenantId)
      .eq("status", "pending")
      .limit(1000),
  );
  const targetIds = new Set([
    ...ids.customerIds,
    ...ids.leadIds,
    ...ids.jobIds,
    ...ids.appointmentIds,
  ]);
  await setRows(
    "scheduled_notifications",
    notifications.filter((row) => {
      const text = JSON.stringify(row.metadata ?? {});
      return [...targetIds].some((id) => text.includes(id));
    }),
  );

  for (const key of Object.keys(deleteIds)) {
    if (deleteIds[key].length === 0) {
      delete deleteIds[key];
    }
  }

  return { deleteIds, storagePaths: sorted(storagePaths) };
}

async function collectFinancialRows(supabase: AnySupabase, tenantId: string, ids: IdSets) {
  const anonymiseIds: Record<string, string[]> = {};
  const quotes = [
    ...(await selectByColumn<{ id: string }>(supabase, tenantId, "quotes", "job_id", ids.jobIds)),
    ...(await selectByColumn<{ id: string }>(supabase, tenantId, "quotes", "customer_id", ids.customerIds)),
  ];
  const quoteIds = sorted(quotes.map((quote) => quote.id));
  anonymiseIds.quotes = quoteIds;
  anonymiseIds.quote_versions = sorted(
    (await selectByColumn<{ id: string }>(supabase, tenantId, "quote_versions", "quote_id", quoteIds)).map((row) => row.id),
  );
  anonymiseIds.quote_acceptances = sorted(
    (await selectByColumn<{ id: string }>(supabase, tenantId, "quote_acceptances", "quote_id", quoteIds)).map((row) => row.id),
  );

  const invoices = [
    ...(await selectByColumn<{ id: string }>(supabase, tenantId, "invoices", "job_id", ids.jobIds)),
    ...(await selectByColumn<{ id: string }>(supabase, tenantId, "invoices", "customer_id", ids.customerIds)),
    ...(await selectByColumn<{ id: string }>(supabase, tenantId, "invoices", "quote_id", quoteIds)),
  ];
  const invoiceIds = sorted(invoices.map((invoice) => invoice.id));
  anonymiseIds.invoices = invoiceIds;
  const payments = [
    ...(await selectByColumn<{ id: string }>(supabase, tenantId, "payments", "invoice_id", invoiceIds)),
    ...(await selectByColumn<{ id: string }>(supabase, tenantId, "payments", "quote_id", quoteIds)),
    ...(await selectByColumn<{ id: string }>(supabase, tenantId, "payments", "customer_id", ids.customerIds)),
  ];
  anonymiseIds.payments = sorted(payments.map((payment) => payment.id));

  anonymiseIds.leads = sorted(ids.leadIds);
  anonymiseIds.jobs = sorted(ids.jobIds);
  anonymiseIds.customers = sorted(ids.customerIds);
  anonymiseIds.platform_event_log = sorted(ids.platformEventIds);

  for (const key of Object.keys(anonymiseIds)) {
    if (anonymiseIds[key].length === 0) {
      delete anonymiseIds[key];
    }
  }

  return anonymiseIds;
}

export async function buildDeleteTrailPlan(input: {
  supabase: AnySupabase;
  tenantId: string;
  rootType: DeleteTrailRootType;
  rootId: string;
}) {
  const ids: IdSets = {
    customerIds: new Set(),
    leadIds: new Set(),
    jobIds: new Set(),
    appointmentIds: new Set(),
    siteIds: new Set(),
    platformLinkIds: new Set(),
    platformEventIds: new Set(),
  };
  const warnings: string[] = [];
  const blockers: string[] = [];
  const label = await collectRoot(input.supabase, input.tenantId, input.rootType, input.rootId, ids);

  if (!label) {
    blockers.push("Root record was not found for this tenant.");
  } else {
    await expandIds(input.supabase, input.tenantId, input.rootType, ids);
  }

  if (input.rootType !== "customer" && ids.customerIds.size === 0) {
    warnings.push("Linked customer records are retained. Use the customer danger zone to delete a full customer trail.");
  }

  const { deleteIds, storagePaths } = blockers.length
    ? { deleteIds: {}, storagePaths: [] as string[] }
    : await collectDeleteRows(input.supabase, input.tenantId, ids);
  const anonymiseIds = blockers.length ? {} : await collectFinancialRows(input.supabase, input.tenantId, ids);

  const willDelete: DeleteTrailPlanItem[] = [];
  Object.entries(deleteIds).forEach(([table, rowIds]) => pushItem(willDelete, countItem(table, rowIds)));
  const willAnonymise: DeleteTrailPlanItem[] = [];
  Object.entries(anonymiseIds).forEach(([table, rowIds]) => {
    const labelOverride = table === "platform_event_log" ? "AI event audit rows" : undefined;
    pushItem(willAnonymise, countItem(table, rowIds, labelOverride ?? table.replaceAll("_", " ")));
  });
  const willUnlink: DeleteTrailPlanItem[] = [];
  if ((deleteIds.platform_conversation_links?.length ?? 0) > 0) {
    pushItem(willUnlink, {
      table: "platform_conversation_links",
      label: "conversation CRM references",
      count: deleteIds.platform_conversation_links.length,
    });
  }

  const planWithoutHash: Omit<DeleteTrailPlan, "planHash"> = {
    root: {
      type: input.rootType,
      id: input.rootId,
      label: label ?? "Missing record",
    },
    mode: "compliance_safe",
    confirmationPhrase: `DELETE ${input.rootType.replaceAll("_", " ").toUpperCase()}`,
    will_delete: willDelete.sort((a, b) => a.table.localeCompare(b.table)),
    will_anonymise: willAnonymise.sort((a, b) => a.table.localeCompare(b.table)),
    will_unlink: willUnlink,
    storage_cleanup: storagePaths.length > 0 ? [{ table: "storage", label: "CRM upload files", count: storagePaths.length }] : [],
    warnings,
    blockers,
    internal: {
      tenantId: input.tenantId,
      customerIds: sorted(ids.customerIds),
      leadIds: sorted(ids.leadIds),
      jobIds: sorted(ids.jobIds),
      appointmentIds: sorted(ids.appointmentIds),
      deleteIds,
      anonymiseIds,
      storagePaths,
    },
  };

  return {
    ...planWithoutHash,
    planHash: planHashFor(planWithoutHash),
  };
}

function previewCounts(plan: DeleteTrailPlan) {
  return {
    will_delete: plan.will_delete,
    will_anonymise: plan.will_anonymise,
    will_unlink: plan.will_unlink,
    storage_cleanup: plan.storage_cleanup,
  };
}

async function deleteIds(supabase: AnySupabase, tenantId: string, table: string, ids: string[]) {
  if (ids.length === 0) return;
  const { error } = await fromCrm(supabase, table).delete().eq("tenant_id", tenantId).in("id", ids);
  if (error) throw new Error(error.message);
}

async function updateIds(
  supabase: AnySupabase,
  tenantId: string,
  table: string,
  ids: string[],
  payload: Record<string, unknown>,
) {
  if (ids.length === 0) return;
  const { error } = await fromCrm(supabase, table).update(payload).eq("tenant_id", tenantId).in("id", ids);
  if (error) throw new Error(error.message);
}

async function executeDatabasePlan(input: {
  supabase: AnySupabase;
  plan: DeleteTrailPlan;
  actorId: string;
  reason: string;
}) {
  const { tenantId, deleteIds: rowsToDelete, anonymiseIds } = input.plan.internal;
  const now = new Date().toISOString();
  const redaction = {
    redacted_at: now,
    redacted_by: input.actorId,
    redaction_reason: input.reason,
  };

  for (const table of [
    "supplier_reconciliation",
    "purchase_orders",
    "job_certificates",
    "job_checklists",
    "job_hazards",
    "job_variations",
    "job_phases",
    "job_assignees",
    "expenses",
    "scheduled_notifications",
    "platform_conversation_links",
    "appointments",
    "attachments",
    "notes",
    "custom_field_values",
    "site_contacts",
    "sites",
    "customer_assets",
  ]) {
    await deleteIds(input.supabase, tenantId, table, rowsToDelete[table] ?? []);
  }

  await updateIds(input.supabase, tenantId, "quote_acceptances", anonymiseIds.quote_acceptances ?? [], {
    accepted_by_name: "Redacted",
    accepted_by_email: null,
    notes: null,
    ...redaction,
  });
  await updateIds(input.supabase, tenantId, "quote_versions", anonymiseIds.quote_versions ?? [], {
    line_items: [],
    change_summary: "Redacted by deletion trail",
    ...redaction,
  });
  await updateIds(input.supabase, tenantId, "quotes", anonymiseIds.quotes ?? [], {
    line_items: [],
    ...redaction,
  });
  await updateIds(input.supabase, tenantId, "invoices", anonymiseIds.invoices ?? [], {
    line_items: [],
    ...redaction,
  });
  await updateIds(input.supabase, tenantId, "payments", anonymiseIds.payments ?? [], {
    notes: null,
    ...redaction,
  });
  await updateIds(input.supabase, tenantId, "jobs", anonymiseIds.jobs ?? [], {
    title: "Deleted job",
    description: null,
    lead_id: null,
    service_id: null,
    job_type_id: null,
    site_id: null,
    site_contact_id: null,
    scheduled_date: null,
    scheduled_time: null,
    duration_hours: null,
    status: "aborted",
    assigned_engineer: null,
    record_deleted_at: now,
    ...redaction,
  });
  await updateIds(input.supabase, tenantId, "leads", anonymiseIds.leads ?? [], {
    customer_id: null,
    service_id: null,
    job_type_id: null,
    status: "lost",
    lost_reason: "Deleted by manager",
    notes: null,
    problem_description: null,
    affected_area: null,
    urgency_level: null,
    preferred_date_text: null,
    preferred_time_window: null,
    record_deleted_at: now,
    ...redaction,
  });
  await updateIds(input.supabase, tenantId, "customers", anonymiseIds.customers ?? [], {
    full_name: "Deleted customer",
    phone: null,
    email: null,
    address_line1: null,
    address_line2: null,
    city: null,
    postcode: null,
    property_type: null,
    occupancy_type: null,
    referral_notes: null,
    notes: null,
    archived: true,
    record_deleted_at: now,
    ...redaction,
  });
  await updateIds(input.supabase, tenantId, "platform_event_log", anonymiseIds.platform_event_log ?? [], {
    payload: { redacted: true },
    last_error: null,
    processing_status: "ignored",
  });
}

export async function executeDeleteTrailPlan(input: {
  supabase: AnySupabase;
  storageSupabase?: AnySupabase;
  tenantId: string;
  actorId: string;
  rootType: DeleteTrailRootType;
  rootId: string;
  reason: string;
  planHash: string;
  confirmationPhrase: string;
}) {
  const plan = await buildDeleteTrailPlan({
    supabase: input.supabase,
    tenantId: input.tenantId,
    rootType: input.rootType,
    rootId: input.rootId,
  });

  if (plan.blockers.length > 0) {
    throw new Error(plan.blockers[0]);
  }
  if (plan.planHash !== input.planHash) {
    throw new Error("Deletion preview is stale. Refresh the preview and try again.");
  }
  if (input.confirmationPhrase.trim() !== plan.confirmationPhrase) {
    throw new Error(`Type ${plan.confirmationPhrase} to confirm this deletion.`);
  }
  if (input.reason.trim().length < 8) {
    throw new Error("Add a deletion reason with at least 8 characters.");
  }

  const { data: requestRow, error: requestError } = await fromCrm(input.supabase, "deletion_requests")
    .insert({
      tenant_id: input.tenantId,
      requested_by: input.actorId,
      root_type: input.rootType,
      root_id: input.rootId,
      reason: input.reason.trim(),
      confirmation_phrase: plan.confirmationPhrase,
      plan_hash: plan.planHash,
      preview_counts: previewCounts(plan),
      status: "pending",
    })
    .select("*")
    .single();
  if (requestError) {
    throw new Error(requestError.message);
  }
  const deletionRequest = requestRow as DeletionRequestRow;

  try {
    await executeDatabasePlan({
      supabase: input.supabase,
      plan,
      actorId: input.actorId,
      reason: input.reason.trim(),
    });

    let storageWarning: string | null = null;
    const paths = plan.internal.storagePaths;
    if (paths.length > 0) {
      const storageRows = paths.map((objectPath) => ({
        tenant_id: input.tenantId,
        deletion_request_id: deletionRequest.id,
        bucket: "crm-uploads",
        object_path: objectPath,
        status: "pending",
      }));
      const { error: storageTaskError } = await fromCrm(input.supabase, "deletion_storage_tasks")
        .insert(storageRows);
      if (storageTaskError) {
        throw new Error(storageTaskError.message);
      }

      const storageClient = input.storageSupabase ?? input.supabase;
      const removeResult = await storageClient.storage?.from("crm-uploads").remove(paths);
      if (removeResult?.error) {
        storageWarning = removeResult.error.message;
        await fromCrm(input.supabase, "deletion_storage_tasks")
          .update({ status: "failed", attempts: 1, last_error: storageWarning })
          .eq("tenant_id", input.tenantId)
          .eq("deletion_request_id", deletionRequest.id);
      } else {
        await fromCrm(input.supabase, "deletion_storage_tasks")
          .update({ status: "completed", attempts: 1, completed_at: new Date().toISOString() })
          .eq("tenant_id", input.tenantId)
          .eq("deletion_request_id", deletionRequest.id);
      }
    }

    const status = storageWarning ? "completed_with_storage_warnings" : "completed";
    const { data: updatedRequest, error: updateError } = await fromCrm(input.supabase, "deletion_requests")
      .update({ status, error: storageWarning, executed_at: new Date().toISOString() })
      .eq("tenant_id", input.tenantId)
      .eq("id", deletionRequest.id)
      .select("*")
      .single();
    if (updateError) {
      throw new Error(updateError.message);
    }

    return { plan, deletionRequest: updatedRequest as DeletionRequestRow, storageWarning };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Deletion failed.";
    await fromCrm(input.supabase, "deletion_requests")
      .update({ status: "failed", error: message })
      .eq("tenant_id", input.tenantId)
      .eq("id", deletionRequest.id);
    throw error;
  }
}
