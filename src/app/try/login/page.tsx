import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { DEMO_SESSION_COOKIE, DEMO_CRM_EMAIL, isDemoCrmEnabled, verifySessionToken } from "@/modules/demo-crm/auth";
import { DemoLoginForm } from "./LoginForm";

export const metadata = { title: "Try Empire CRM" };

export default async function TryLoginPage() {
  if (!isDemoCrmEnabled()) {
    notFound();
  }
  const cookieStore = await cookies();
  if (verifySessionToken(cookieStore.get(DEMO_SESSION_COOKIE)?.value)) {
    redirect("/try/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500 text-xl font-black text-slate-950">
            E
          </div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">Trades CRM</p>
          <h1 className="text-2xl font-bold text-white">Sign in to your workspace</h1>
          <p className="mt-2 text-sm text-slate-400">An interactive demo of the Empire AI Receptionist CRM.</p>
        </div>

        <DemoLoginForm defaultEmail={DEMO_CRM_EMAIL} />

        <div className="mt-6 rounded-lg border border-white/10 bg-white/5 p-3 text-center text-xs text-slate-400">
          <p className="font-semibold text-slate-300">Demo login</p>
          <p className="mt-1">
            {DEMO_CRM_EMAIL} · password <span className="font-mono text-slate-200">trade2026</span>
          </p>
        </div>

        <p className="mt-6 text-center text-xs uppercase tracking-[0.25em] text-slate-500">
          Powered by <span className="font-semibold text-slate-300">Customer Journeys AI</span>
        </p>
      </div>
    </div>
  );
}
