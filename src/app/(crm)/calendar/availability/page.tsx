import { AvailabilityManager } from "@/modules/crm/components/calendar/AvailabilityManager";
import { SetupNotice } from "@/modules/crm/components/shared/SetupNotice";
import { requireCrmUser } from "@/modules/crm/lib/auth";
import { resolveCalendarAdminAccessState } from "@/modules/crm/lib/calendar-admin";
import { getCustomerJourneysRuntimeLink } from "@/modules/crm/lib/customerjourneys";
import { getCrmSetupState } from "@/modules/crm/lib/setup";
import { createCrmServiceRoleClient } from "@/modules/crm/lib/supabase-server";

export default async function CalendarAvailabilityPage() {
  const setup = getCrmSetupState();
  if (!setup.configured && setup.message) {
    return <SetupNotice message={setup.message} />;
  }

  const session = await requireCrmUser();
  if (!session.configured || !session.tenant) {
    return <SetupNotice message="Sign in to manage native calendar availability." />;
  }

  const supabase = createCrmServiceRoleClient();
  const link = await getCustomerJourneysRuntimeLink(supabase, session.tenant.id);
  const access = resolveCalendarAdminAccessState(link);

  if (!access.ready || !access.platformTenantId) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Availability</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage working hours, time off, holidays, and ICS subscriptions through the CustomerJourneys
            control plane.
          </p>
        </div>
        <SetupNotice
          message={access.message ?? "Native calendar availability is not ready for this tenant yet."}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Availability</h1>
        <p className="mt-1 text-sm text-slate-500">
          CustomerJourneys is the source of truth for native calendar administration. Changes here write
          directly to platform working hours, time off, holidays, and ICS subscriptions.
        </p>
      </div>
      <AvailabilityManager platformTenantId={access.platformTenantId} />
    </div>
  );
}
