import { notFound } from "next/navigation";
import { ApiForm } from "@/modules/crm/components/forms/ApiForm";
import { DemoAnchor } from "@/modules/crm/components/demo/DemoAnchor";
import { CustomFieldSettingsForm } from "@/modules/crm/components/forms/CustomFieldSettingsForm";
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
  const [users, services, jobTypes, customFields, rules, suppliers, products, quoteTemplates] = await Promise.all([
    listUserProfiles(demoState.mode),
    listServices(),
    listJobTypes(),
    listCustomFieldDefinitions(),
    listRequiredDocumentRules(),
    listSuppliers(demoState.mode),
    listProducts(demoState.mode),
    listQuoteTemplates(demoState.mode),
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">Backend UI for CRM configuration, roles, services, job types, and rules.</p>
      </div>

      <DemoAnchor name="settings-config">
        <div className="grid gap-6 xl:grid-cols-2">
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
