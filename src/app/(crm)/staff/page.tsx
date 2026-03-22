import { EmptyState } from "@/modules/crm/components/shared/EmptyState";
import { SectionCard } from "@/modules/crm/components/shared/SectionCard";
import { SetupNotice } from "@/modules/crm/components/shared/SetupNotice";
import { ApiForm } from "@/modules/crm/components/forms/ApiForm";
import { DemoAnchor } from "@/modules/crm/components/demo/DemoAnchor";
import { getCrmSession, requireCrmUser, userCanManageSettings } from "@/modules/crm/lib/auth";
import { getCrmDemoEmptyMessage } from "@/modules/crm/lib/demo";
import { getCrmDemoState } from "@/modules/crm/lib/demo-state";
import { formatDate } from "@/modules/crm/lib/format";
import { getCrmSetupState } from "@/modules/crm/lib/setup";
import { listStaffDirectory } from "@/modules/crm/lib/data";

export default async function StaffPage() {
  const setup = getCrmSetupState();
  if (!setup.configured && setup.message) {
    return <SetupNotice message={setup.message} />;
  }

  await requireCrmUser();
  const fullSession = await getCrmSession();
  const demoState = await getCrmDemoState();
  const staff = await listStaffDirectory(demoState.mode);
  const canManage = userCanManageSettings(fullSession.profile?.role);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Staff</h1>
        <p className="mt-1 text-sm text-slate-500">Internal directory, contracts/pay notes, and certification expiry tracking.</p>
      </div>

      {staff.length === 0 ? <EmptyState message={demoState.active ? getCrmDemoEmptyMessage("staff profiles") : "No staff profiles found yet."} /> : null}

      <DemoAnchor name="staff-directory">
        <div className="grid gap-6 xl:grid-cols-2">
        {staff.map((member) => (
          <SectionCard key={member.id} title={member.full_name}>
            <div className="space-y-4">
              <div className="grid gap-2 text-sm text-slate-600 md:grid-cols-2">
                <p>Role: <span className="font-medium capitalize text-slate-900">{member.role}</span></p>
                <p>Status: <span className="font-medium text-slate-900">{member.active ? "Active" : "Inactive"}</span></p>
                <p>Email: {member.email || "Not set"}</p>
                <p>Phone: {member.phone || "Not set"}</p>
                <p>Hours: {member.agreed_hours || "Not set"}</p>
                <p>Pay type: {member.pay_type || "Not set"}</p>
              </div>
              <p className="text-sm text-slate-600">Pay notes: {member.pay_notes || "No pay notes"}</p>

              <div>
                <h3 className="text-sm font-semibold text-slate-900">Certifications</h3>
                {member.certifications.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">No certifications recorded.</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {member.certifications.map((certification) => (
                      <div key={certification.id} className="rounded-lg border border-slate-200 px-3 py-3 text-sm">
                        <p className="font-medium text-slate-900">{certification.title}</p>
                        <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">{certification.category}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          Issue {formatDate(certification.issue_date)} · Expiry {formatDate(certification.expiry_date)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {canManage ? (
                <ApiForm endpoint="/api/crm/staff/certifications" submitLabel="Add Certification" className="grid gap-3 md:grid-cols-2">
                  <input type="hidden" name="user_profile_id" value={member.id} />
                  <input name="title" required placeholder="Certification title" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                  <select name="category" defaultValue="qualification" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                    <option value="qualification">Qualification</option>
                    <option value="id">ID</option>
                    <option value="compliance">Compliance</option>
                    <option value="training">Training</option>
                  </select>
                  <input name="issuer" placeholder="Issuer" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                  <input name="issue_date" type="date" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                  <input name="expiry_date" type="date" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                  <input name="reminder_days_before" type="number" min="0" defaultValue="30" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                  <textarea name="notes" placeholder="Notes" className="min-h-20 rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2" />
                </ApiForm>
              ) : null}
            </div>
          </SectionCard>
        ))}
        </div>
      </DemoAnchor>
    </div>
  );
}
