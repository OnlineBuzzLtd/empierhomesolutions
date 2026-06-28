import "../../globals.css";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { DEMO_SESSION_COOKIE, isDemoCrmEnabled, verifySessionToken } from "@/modules/demo-crm/auth";
import { DemoShell } from "@/modules/demo-crm/components/DemoShell";
import { DemoStoreProvider } from "@/modules/demo-crm/store";

export const metadata = { title: "Empire CRM — Demo" };

export default async function TryAppLayout({ children }: { children: React.ReactNode }) {
  if (!isDemoCrmEnabled()) {
    notFound();
  }
  const cookieStore = await cookies();
  if (!verifySessionToken(cookieStore.get(DEMO_SESSION_COOKIE)?.value)) {
    redirect("/try/login");
  }

  return (
    <DemoStoreProvider>
      <DemoShell>{children}</DemoShell>
    </DemoStoreProvider>
  );
}
