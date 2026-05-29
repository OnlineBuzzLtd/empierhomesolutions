import { redirect } from "next/navigation";
import { DiaryClientPanel } from "@/modules/crm/components/client/CrmFastScreenPanels";
import { requireCrmUser } from "@/modules/crm/lib/auth";

export default async function DiaryPage() {
  const session = await requireCrmUser();

  if (session.profile?.role !== "engineer") {
    redirect("/dashboard");
  }

  return <DiaryClientPanel />;
}
