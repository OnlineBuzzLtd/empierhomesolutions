import { createCrmServiceRoleClient } from "@/modules/crm/lib/supabase-server";

// Tables that hold tenant-scoped data. The order is stable so downstream
// consumers can reconstruct referential integrity (parents first).
export const TENANT_SCOPED_TABLES = [
  "tenants",
  "tenant_settings",
  "tenant_branding",
  "tenant_memberships",
  "tenant_twilio_state",
  "customerjourneys_runtime_links",
  "user_profiles",
  "user_certifications",
  "services",
  "job_types",
  "customers",
  "customer_assets",
  "leads",
  "sites",
  "site_contacts",
  "suppliers",
  "products",
  "product_addons",
  "quote_templates",
  "required_document_rules",
  "number_sequences",
  "custom_field_definitions",
  "custom_field_values",
  "jobs",
  "job_phases",
  "job_variations",
  "job_hazards",
  "job_checklists",
  "job_certificates",
  "job_assignees",
  "job_report_templates",
  "notes",
  "appointments",
  "quotes",
  "quote_versions",
  "quote_acceptances",
  "invoices",
  "invoice_schedules",
  "payments",
  "expenses",
  "attachments",
  "purchase_orders",
  "supplier_reconciliation",
  "ai_conversations",
  "ai_messages",
  "ai_actions",
  "ai_crm_impacts",
  "platform_event_log",
  "platform_command_log",
  "platform_outbox_events",
  "platform_conversation_links",
  "workspace_aliases",
  "tenant_lifecycle_events",
] as const;

export type TenantExportTable = (typeof TENANT_SCOPED_TABLES)[number];

const PAGE_SIZE = 500;

export async function* streamTenantExport(tenantId: string): AsyncGenerator<string> {
  const admin = createCrmServiceRoleClient();

  yield JSON.stringify({
    _export: "crm.tenant",
    tenant_id: tenantId,
    generated_at: new Date().toISOString(),
    tables: TENANT_SCOPED_TABLES,
  }) + "\n";

  for (const table of TENANT_SCOPED_TABLES) {
    let offset = 0;
    while (true) {
      const column = table === "tenants" ? "id" : "tenant_id";
      const { data, error } = await admin
        .schema("crm")
        .from(table)
        .select("*")
        .eq(column, tenantId)
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) {
        yield JSON.stringify({ _table: table, _error: error.message }) + "\n";
        break;
      }

      if (!data || data.length === 0) {
        break;
      }

      for (const row of data) {
        yield JSON.stringify({ _table: table, row }) + "\n";
      }

      if (data.length < PAGE_SIZE) {
        break;
      }
      offset += PAGE_SIZE;
    }
  }
}
