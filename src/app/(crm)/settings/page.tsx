import { notFound } from "next/navigation";
import { CustomFieldSettingsForm } from "@/modules/crm/components/forms/CustomFieldSettingsForm";
import { JobTypeSettingsForm } from "@/modules/crm/components/forms/JobTypeSettingsForm";
import { RequiredDocumentRuleForm } from "@/modules/crm/components/forms/RequiredDocumentRuleForm";
import { ServiceSettingsForm } from "@/modules/crm/components/forms/ServiceSettingsForm";
import { ApiForm } from "@/modules/crm/components/forms/ApiForm";
import { EmptyState } from "@/modules/crm/components/shared/EmptyState";
import { SectionCard } from "@/modules/crm/components/shared/SectionCard";
import { SetupNotice } from "@/modules/crm/components/shared/SetupNotice";
import { requireSettingsAccess } from "@/modules/crm/lib/auth";
import { getCrmSetupState } from "@/modules/crm/lib/setup";
import { listCustomFieldDefinitions, listJobTypes, listRequiredDocumentRules, listServices, listUserProfiles } from "@/modules/crm/lib/data";

export default async function SettingsPage() {
  const setup = getCrmSetupState();
  if (!setup.configured && setup.message) {
    return <SetupNotice message={setup.message} />;
  }

  const session = await requireSettingsAccess();
  if (!session.user) {
    notFound();
  }

  const [users, services, jobTypes, customFields, rules] = await Promise.all([
    listUserProfiles(),
    listServices(),
    listJobTypes(),
    listCustomFieldDefinitions(),
    listRequiredDocumentRules(),
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">Backend UI for CRM configuration, roles, services, job types, and rules.</p>
      </div>

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
      </div>
    </div>
  );
}
