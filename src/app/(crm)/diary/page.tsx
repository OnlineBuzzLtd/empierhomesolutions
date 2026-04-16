import { redirect } from "next/navigation";
import { CommsoftDiary } from "@/modules/crm/components/commusoft/CommsoftDiary";
import { requireCrmUser } from "@/modules/crm/lib/auth";
import { getEngineerDashboardData } from "@/modules/crm/lib/data";
import { getCrmDemoState } from "@/modules/crm/lib/demo-state";

export default async function DiaryPage() {
  const session = await requireCrmUser();

  if (session.profile?.role !== "engineer") {
    redirect("/dashboard");
  }

  const demoState = await getCrmDemoState();
  const data = await getEngineerDashboardData(session.profile.full_name, demoState.mode);

  const allJobs = [
    ...(data.todaysAssignedJobs ?? []),
    ...(data.upcomingAssignedJobs ?? []),
    ...(data.overdueAssignedJobs ?? []),
    ...(data.readyJobs ?? []),
  ];

  const uniqueJobs = Array.from(new Map(allJobs.map((j) => [j.id, j])).values());

  return <CommsoftDiary jobs={uniqueJobs} />;
}
