import Link from "next/link";
import { notFound } from "next/navigation";
import { ApiForm } from "@/modules/crm/components/forms/ApiForm";
import { DemoAnchor } from "@/modules/crm/components/demo/DemoAnchor";
import { CustomFieldSettingsForm } from "@/modules/crm/components/forms/CustomFieldSettingsForm";
import { JobReportTemplatesForm } from "@/modules/crm/components/settings/JobReportTemplatesForm";
import { TwilioProvisioningPanel } from "@/modules/crm/components/settings/TwilioProvisioningPanel";
import { JobTypeSettingsForm } from "@/modules/crm/components/forms/JobTypeSettingsForm";
import { RequiredDocumentRuleForm } from "@/modules/crm/components/forms/RequiredDocumentRuleForm";
import { ServiceSettingsForm } from "@/modules/crm/components/forms/ServiceSettingsForm";
import { EmptyState } from "@/modules/crm/components/shared/EmptyState";
import { SectionCard } from "@/modules/crm/components/shared/SectionCard";
import { SetupNotice } from "@/modules/crm/components/shared/SetupNotice";
import { requireSettingsAccess } from "@/modules/crm/lib/auth";
import { getCrmDemoState } from "@/modules/crm/lib/demo-state";
import { summarizePaymentTerms } from "@/modules/crm/lib/quote-templates";
import { getCrmSetupState } from "@/modules/crm/lib/setup";
import { createCrmServerClient } from "@/modules/crm/lib/supabase-server";
import { listCustomFieldDefinitions, listJobTypes, listProducts, listQuoteTemplates, listRequiredDocumentRules, listServices, listSuppliers, listUserProfiles } from "@/modules/crm/lib/data";

export default async function SettingsPage() {
  const setup = getCrmSetupState();
  if (!setup.configured && setup.message) {
    return <SetupNotice message={setup.message} />;
  }

  const session = await requireSettingsAccess();
  if (!session.user) {
    notFound();
  }

  const demoState = await getCrmDemoState();
  const supabase = await createCrmServerClient();
  const [{ data: tenantSettings }, users, services, jobTypes, customFields, rules, suppliers, products, quoteTemplates, { data: jobReportTemplates }, { data: twilioState }] = await Promise.all([
    supabase.schema("crm").from("tenant_settings").select("*").eq("tenant_id", session.tenant!.id).maybeSingle(),
    listUserProfiles(demoState.mode),
    listServices(),
    listJobTypes(),
    listCustomFieldDefinitions(),
    listRequiredDocumentRules(),
    listSuppliers(demoState.mode),
    listProducts(demoState.mode),
    listQuoteTemplates(demoState.mode),
    supabase.schema("crm").from("job_report_templates").select("id, title, position, is_active").eq("tenant_id", session.tenant!.id).eq("is_demo", false).order("position", { ascending: true }),
    supabase
      .schema("crm")
      .from("tenant_twilio_state")
      .select("messaging_service_sid, voice_number_sid, voice_number_e164, whatsapp_sender_id, whatsapp_status, last_synced_at, last_error")
      .eq("tenant_id", session.tenant!.id)
      .maybeSingle(),
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">Backend UI for CRM configuration, roles, services, job types, and rules.</p>
      </div>

      <DemoAnchor name="settings-config">
        <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="Workspace Profile">
          <ApiForm endpoint="/api/crm/settings/tenant" submitLabel="Save Workspace" className="grid gap-3 md:grid-cols-2">
            <input name="business_name" required defaultValue={session.branding?.business_name ?? session.tenant?.name ?? ""} placeholder="Business name" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input name="crm_display_name" defaultValue={session.branding?.crm_display_name ?? ""} placeholder="CRM display name" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input name="primary_phone" defaultValue={session.branding?.primary_phone ?? ""} placeholder="Primary phone" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input name="support_email" type="email" defaultValue={session.branding?.support_email ?? ""} placeholder="Support email" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input name="website_url" defaultValue={session.branding?.website_url ?? ""} placeholder="Website URL" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input name="logo_url" defaultValue={session.branding?.logo_url ?? ""} placeholder="Logo URL" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input name="accent_color" defaultValue={session.branding?.accent_color ?? ""} placeholder="Accent color (#0f172a)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input name="legal_name" defaultValue={String(tenantSettings?.legal_name ?? "")} placeholder="Legal name" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input name="vat_registration_number" defaultValue={String(tenantSettings?.vat_registration_number ?? "")} placeholder="VAT registration number" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input name="gas_safe_number" defaultValue={String(tenantSettings?.gas_safe_number ?? "")} placeholder="Gas Safe number" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <textarea name="quote_footer" defaultValue={String(tenantSettings?.quote_footer ?? "")} placeholder="Quote footer" className="min-h-20 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <textarea name="invoice_footer" defaultValue={String(tenantSettings?.invoice_footer ?? "")} placeholder="Invoice footer" className="min-h-20 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <textarea name="certificate_footer" defaultValue={String(tenantSettings?.certificate_footer ?? "")} placeholder="Certificate footer" className="min-h-20 rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2" />
            <label className="flex items-center gap-2 text-sm md:col-span-2">
              <input type="checkbox" name="show_per_package_vat" defaultChecked={Boolean(tenantSettings?.show_per_package_vat)} />
              <span>Show VAT line inside each package on the quote builder (cosmetic — quote-level VAT is unchanged)</span>
            </label>
          </ApiForm>
          <p className="mt-3 text-xs text-slate-500">These settings are owned by the current tenant and replace hardcoded Empire branding in the CRM shell and future documents.</p>
        </SectionCard>

        <SectionCard title="Twilio Provisioning">
          <TwilioProvisioningPanel
            initialState={
              twilioState
                ? {
                    messaging_service_sid: (twilioState.messaging_service_sid as string | null) ?? null,
                    voice_number_sid: (twilioState.voice_number_sid as string | null) ?? null,
                    voice_number_e164: (twilioState.voice_number_e164 as string | null) ?? null,
                    whatsapp_sender_id: (twilioState.whatsapp_sender_id as string | null) ?? null,
                    whatsapp_status: (twilioState.whatsapp_status as string | null) ?? "not_started",
                    last_synced_at: (twilioState.last_synced_at as string | null) ?? null,
                    last_error: (twilioState.last_error as string | null) ?? null,
                  }
                : null
            }
          />
          <p className="mt-3 text-xs text-slate-500">Re-runs the Twilio + CustomerJourneys provisioning pipeline for this tenant idempotently. Safe to run any time — existing SIDs are reused.</p>
        </SectionCard>

        <SectionCard title="Demo Console">
          <ApiForm endpoint="/api/crm/settings/demo-console" submitLabel="Save" className="grid gap-3">
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                name="demo_console_enabled"
                defaultChecked={Boolean(tenantSettings?.demo_console_enabled)}
                className="mt-0.5 h-4 w-4"
              />
              <span>
                <span className="font-semibold text-slate-900">Enable Demo Console</span>
                <span className="ml-1 text-slate-600">
                  — in-person sales demo capability at <code>/demo</code> and <code>/demo/run</code>. Manager/admin only.
                </span>
              </span>
            </label>
          </ApiForm>
          <p className="mt-3 text-xs text-slate-500">
            When enabled, this tenant gets a &quot;Demo&quot; item in the admin sidebar and the
            tenant-gated routes start returning 200 instead of 404. See{" "}
            <code>src/modules/crm/demo-console/README.md</code> for the operator runbook.
          </p>
        </SectionCard>

        <SectionCard title="Create New Tenant">
          <ApiForm endpoint="/api/crm/settings/tenants" submitLabel="Create Tenant" className="grid gap-3 md:grid-cols-2">
            <input name="name" required placeholder="Business name" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input name="slug" required placeholder="business-slug" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input name="business_name" placeholder="Branded business name" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input name="crm_display_name" placeholder="CRM display name" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input name="primary_phone" placeholder="Primary phone" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input name="support_email" type="email" placeholder="Support email" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input name="accent_color" placeholder="Accent color" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input name="legal_name" placeholder="Legal name" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input name="vat_registration_number" placeholder="VAT number" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input name="gas_safe_number" placeholder="Gas Safe number" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input type="hidden" name="clone_from_current" value="true" />
          </ApiForm>
          <p className="mt-3 text-xs text-slate-500">This creates a new workspace, assigns the current user as owner, and clones the current tenant&apos;s configuration baseline for services, job types, fields, rules, suppliers, products, templates, and add-ons.</p>
        </SectionCard>

        <SectionCard title="User Roles">
          {users.length === 0 ? <EmptyState message="No user profiles yet." /> : null}
          <div className="space-y-3">
            {users.map((user) => (
              <ApiForm key={user.id} endpoint="/api/crm/settings/users" submitLabel="Save Role" className="grid gap-3 rounded-lg border border-slate-200 p-3 md:grid-cols-[1fr_180px_auto]">
                <input type="hidden" name="user_id" value={user.user_id} />
                <input name="full_name" defaultValue={user.full_name} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                <select name="role" defaultValue={user.role} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                  <option value="management">Management</option>
                  <option value="admin">Admin</option>
                  <option value="sales">Sales</option>
                  <option value="engineer">Engineer</option>
                  <option value="accounts">Accounts</option>
                </select>
              </ApiForm>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Services">
          <ServiceSettingsForm />
          <div className="mt-4 space-y-2">
            {services.map((service) => (
              <div key={service.id} className="rounded-lg border border-slate-200 px-3 py-3 text-sm">
                {service.name} · {service.slug}
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Job Types">
          <JobTypeSettingsForm services={services} />
          <div className="mt-4 space-y-2">
            {jobTypes.map((jobType) => (
              <div key={jobType.id} className="rounded-lg border border-slate-200 px-3 py-3 text-sm">
                {jobType.name} · {jobType.slug}
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Custom Fields">
          <CustomFieldSettingsForm services={services} jobTypes={jobTypes} />
          <div className="mt-4 space-y-2">
            {customFields.map((field) => (
              <div key={field.id} className="rounded-lg border border-slate-200 px-3 py-3 text-sm">
                {field.entity_type} · {field.label} · {field.field_type}
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Required Document Rules">
          <RequiredDocumentRuleForm services={services} jobTypes={jobTypes} />
          <div className="mt-4 space-y-2">
            {rules.map((rule) => (
              <div key={rule.id} className="rounded-lg border border-slate-200 px-3 py-3 text-sm">
                {rule.entity_type} · {rule.document_type} · {rule.pipeline_stage || "all stages"}
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Job Report Questions">
          <JobReportTemplatesForm
            initialTemplates={(jobReportTemplates ?? []) as { id: string; title: string; position: number; is_active: boolean }[]}
          />
        </SectionCard>

        <SectionCard title="Suppliers">
          <ApiForm endpoint="/api/crm/catalog/suppliers" submitLabel="Save Supplier" className="grid gap-3 md:grid-cols-2">
            <input name="name" required placeholder="Supplier name" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input name="category" placeholder="Category" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input name="contact_name" placeholder="Contact name" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input name="email" type="email" placeholder="Email" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input name="phone" placeholder="Phone" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <textarea name="notes" placeholder="Notes" className="min-h-20 rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2" />
          </ApiForm>
          <div className="mt-4 space-y-2">
            {suppliers.map((supplier) => (
              <div key={supplier.id} className="rounded-lg border border-slate-200 px-3 py-3 text-sm">
                {supplier.name} · {supplier.category || "general"}
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Products">
          <ApiForm endpoint="/api/crm/catalog/products" submitLabel="Save Product" className="grid gap-3 md:grid-cols-2">
            <input name="name" required placeholder="Product name" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input name="category" placeholder="Category" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <select name="service_id" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="">All services</option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
            </select>
            <select name="supplier_id" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="">No supplier</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
            <input name="unit_cost" type="number" min="0" step="0.01" placeholder="Unit cost" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input name="sell_price" type="number" min="0" step="0.01" placeholder="Sell price" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input name="markup_percent" type="number" min="0" step="0.01" placeholder="Markup %" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input name="sku" placeholder="SKU" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </ApiForm>
          <div className="mt-4 space-y-2">
            {products.map((product) => (
              <div key={product.id} className="rounded-lg border border-slate-200 px-3 py-3 text-sm">
                {product.name} · £{Number(product.sell_price).toFixed(2)}
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Quote-builder Packages">
          <p className="text-sm text-slate-600">
            Reusable bundles (boiler + flue + labour, etc.) your team can drop into a quote as a single composite line.
            Items are snapshotted into the quote at insert time — editing a package later never mutates a sent quote.
          </p>
          <Link
            href="/settings/packages"
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Manage packages →
          </Link>
        </SectionCard>

        <SectionCard title="Quote Templates">
          <ApiForm endpoint="/api/crm/catalog/quote-templates" submitLabel="Save Template" className="grid gap-3">
            <input name="name" required placeholder="Template name" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <select name="service_id" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="">All services</option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
            </select>
            <select name="job_type_id" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="">All job types</option>
              {jobTypes.map((jobType) => (
                <option key={jobType.id} value={jobType.id}>
                  {jobType.name}
                </option>
              ))}
            </select>
            <textarea name="description" placeholder="Description" className="min-h-20 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <textarea
              name="line_items"
              placeholder='[{"description":"Boiler install","qty":1,"unit_price":2500}]'
              className="min-h-28 rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
            />
            <textarea
              name="optional_extras"
              placeholder='[{"description":"Magnetic filter","qty":1,"unit_price":180}]'
              className="min-h-24 rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
            />
            <textarea
              name="payment_terms"
              placeholder='{"deposit":"25% on booking","balance":"On completion"}'
              className="min-h-24 rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
            />
          </ApiForm>
          <div className="mt-4 space-y-2">
            {quoteTemplates.map((template) => (
              <div key={template.id} className="rounded-lg border border-slate-200 px-3 py-3 text-sm">
                <p className="font-medium text-slate-900">{template.name}</p>
                <p className="mt-1 text-slate-600">
                  {template.line_items.length} line items · {template.optional_extras.length} optional extras
                </p>
                {summarizePaymentTerms(template.payment_terms) ? <p className="mt-1 text-xs text-slate-500">{summarizePaymentTerms(template.payment_terms)}</p> : null}
              </div>
            ))}
          </div>
        </SectionCard>
        </div>
      </DemoAnchor>
    </div>
  );
}
