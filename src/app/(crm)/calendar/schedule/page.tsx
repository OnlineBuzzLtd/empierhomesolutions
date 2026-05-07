import { ScheduleBoard } from "@/modules/crm/components/calendar/ScheduleBoard";
import { SetupNotice } from "@/modules/crm/components/shared/SetupNotice";
import { requireCrmUser } from "@/modules/crm/lib/auth";
import { resolveCalendarAdminAccessState } from "@/modules/crm/lib/calendar-admin";
import { getCustomerJourneysRuntimeLink } from "@/modules/crm/lib/customerjourneys";
import { getCrmSetupState } from "@/modules/crm/lib/setup";
import { createCrmServiceRoleClient } from "@/modules/crm/lib/supabase-server";

export default async function CalendarSchedulePage() {
  const setup = getCrmSetupState();
  if (!setup.configured && setup.message) {
    return <SetupNotice message={setup.message} />;
  }

  const session = await requireCrmUser();
  if (!session.configured || !session.tenant) {
    return <SetupNotice message="Sign in to view the dispatch board." />;
  }

  const supabase = createCrmServiceRoleClient();
  const link = await getCustomerJourneysRuntimeLink(supabase, session.tenant.id);
  const access = resolveCalendarAdminAccessState(link);

  if (!access.ready || !access.platformTenantId) {
    return (
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Schedule</h1>
          <p className="mt-1 text-sm text-slate-500">
            Read-only dispatch board from the CustomerJourneys platform booking source of truth.
          </p>
        </div>
        <SetupNotice message={access.message ?? "Native booking schedule is not ready for this tenant yet."} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Schedule</h1>
        <p className="mt-1 text-sm text-slate-500">
          Dispatch board from canonical platform bookings. CRM appointments remain mirrored operational records,
          not the native booking source of truth.
        </p>
      </div>
      <ScheduleBoard platformTenantId={access.platformTenantId} />
    </div>
  );
}
