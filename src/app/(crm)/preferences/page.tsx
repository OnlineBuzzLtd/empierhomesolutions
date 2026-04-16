import Link from "next/link";
import { requireCrmUser } from "@/modules/crm/lib/auth";
import { getUiPreference } from "@/app/actions/ui-preference";
import { ViewToggle } from "@/modules/crm/components/commusoft/ViewToggle";

export default async function PreferencesPage() {
  await requireCrmUser();
  const current = await getUiPreference();

  return (
    <div className="mx-auto max-w-xl space-y-6 px-4 py-8">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800"
        >
          <BackArrow />
          Back
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-slate-900">View Preferences</h1>
        <p className="mt-1 text-sm text-slate-500">
          Switch between the streamlined field app view and the classic detailed view.
        </p>
      </div>

      <ViewToggle current={current} />
    </div>
  );
}

function BackArrow() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M10 3L5 8l5 5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
