import Link from "next/link";
import { cookies } from "next/headers";
import { LoginForm } from "@/modules/crm/components/forms/LoginForm";
import { SetupNotice } from "@/modules/crm/components/shared/SetupNotice";
import { getCrmSetupState } from "@/modules/crm/lib/setup";

export default async function LoginPage() {
  const setup = getCrmSetupState();
  const cookieStore = await cookies();
  const fallbackNext = cookieStore.get("crm_next")?.value ?? null;

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">Trades CRM</p>
          <h1 className="text-3xl font-bold text-white">Sign in to your workspace</h1>
          <p className="mt-2 text-sm text-slate-400">Tenant-isolated CRM access for heating and plumbing teams.</p>
        </div>

        {!setup.configured && setup.message ? <SetupNotice message={setup.message} /> : <LoginForm fallbackNext={fallbackNext} />}

        <p className="mt-4 text-center text-sm text-slate-400">
          Need a new workspace?{" "}
          <Link href="/signup" className="font-medium text-blue-300 hover:text-blue-200">
            Create one here
          </Link>
        </p>

        <p className="mt-6 text-center text-xs uppercase tracking-[0.25em] text-slate-500">
          Powered by <span className="font-semibold text-slate-300">Customer Journeys AI</span>
        </p>
      </div>
    </div>
  );
}
