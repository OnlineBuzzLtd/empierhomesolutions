import { redirect } from "next/navigation";
import { EngineerDashboard } from "@/modules/crm/components/dashboard/EngineerDashboard";
import { CommsoftDiary } from "@/modules/crm/components/commusoft/CommsoftDiary";
import { requireCrmUser } from "@/modules/crm/lib/auth";
import { getEngineerDashboardData } from "@/modules/crm/lib/data";
import { getCrmDemoState } from "@/modules/crm/lib/demo-state";
import { getUiPreference } from "@/app/actions/ui-preference";

export default async function CalendarTodayPage() {
  const session = await requireCrmUser();

  if (session.profile?.role !== "engineer" || !session.profile.full_name) {
    redirect("/calendar");
  }

  const [demoState, uiMode] = await Promise.all([getCrmDemoState(), getUiPreference()]);
  const data = await getEngineerDashboardData(session.profile.full_name, demoState.mode);

  if (uiMode === "commusoft") {
    const jobs = Array.from(
      new Map(
        [
          ...(data.overdueAssignedJobs ?? []),
          ...(data.todaysAssignedJobs ?? []),
          ...(data.readyJobs ?? []),
          ...(data.upcomingAssignedJobs ?? []),
          ...(data.completedAssignedJobs ?? []),
        ].map((job) => [job.id, job]),
      ).values(),
    );
    return <CommsoftDiary jobs={jobs} completedJobs={data.completedAssignedJobs ?? []} />;
  }

  return <EngineerDashboard data={data} engineerName={session.profile.full_name} />;
}
