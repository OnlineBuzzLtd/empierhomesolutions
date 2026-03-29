import { SignupForm } from "@/modules/crm/components/forms/SignupForm";
import { SetupNotice } from "@/modules/crm/components/shared/SetupNotice";
import { getCrmSetupState } from "@/modules/crm/lib/setup";

export default function SignupPage() {
  const setup = getCrmSetupState();

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="mb-8 text-center">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">Trades CRM</p>
          <h1 className="text-3xl font-bold text-white">Create your workspace</h1>
          <p className="mt-2 text-sm text-slate-400">Launch a tenant-isolated CRM workspace for your heating or plumbing business.</p>
        </div>

        {!setup.configured && setup.message ? <SetupNotice message={setup.message} /> : <SignupForm />}

        <p className="mt-6 text-center text-xs uppercase tracking-[0.25em] text-slate-500">
          Powered by <span className="font-semibold text-slate-300">Customer Journeys AI</span>
        </p>
      </div>
    </div>
  );
}
