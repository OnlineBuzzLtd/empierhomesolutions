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
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">Empire</p>
          <h1 className="text-3xl font-bold text-white">Home Solutions CRM</h1>
          <p className="mt-2 text-sm text-slate-400">Internal team access only</p>
        </div>

        {!setup.configured && setup.message ? <SetupNotice message={setup.message} /> : <LoginForm fallbackNext={fallbackNext} />}
      </div>
    </div>
  );
}
