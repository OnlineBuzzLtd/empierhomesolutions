import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCrmUser, userCanManageSettings } from "@/modules/crm/lib/auth";
import { LiveDemoPane } from "@/modules/crm/demo-console/LiveDemoPane";

// Demo Console landing + live preview (tickets C-1, C-2, C-4 integration).
// Tenant-gated by crm.tenant_settings.demo_console_enabled; manager/admin
// only. Returns 404 for tenants without the flag.
//
// Until Stream D/E ships, this page is the only Demo Console surface.
// The LiveDemoPane is embedded here with no active session so the
// operator can see the structure and confirm realtime is wired (rows
// will appear once Stream E adds the consent flow + session start).

export default async function DemoConsolePage() {
  const session = await requireCrmUser();

  if (!session.settings?.demo_console_enabled) {
    notFound();
  }
  if (!userCanManageSettings(session.profile?.role)) {
    notFound();
  }

  const tenantName = session.tenant?.name ?? "this tenant";
  const tenantId = session.tenant?.id ?? null;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          Demo Console
        </p>
        <h1 className="text-3xl font-bold text-slate-900">In-person sales demo</h1>
        <p className="text-sm text-slate-600">
          Live demo capability for {tenantName}. Open the fullscreen prospect view to run a demo.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Link
            href="/demo/run"
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Open /demo/run
          </Link>
        </div>
      </header>

      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-semibold">Preview only — no session is active.</p>
        <p className="mt-1 leading-relaxed">
          The pane below subscribes to Supabase realtime for{" "}
          <code className="rounded bg-amber-100 px-1 py-0.5 text-[12px]">is_test=true</code>{" "}
          rows in this tenant. Rows will appear as soon as the consent capture flow lands
          in Stream E and you start a demo session. Until then it stays idle.
        </p>
      </section>

      <div className="h-[60vh]">
        <LiveDemoPane sessionStartedAt={null} tenantId={tenantId} />
      </div>
    </div>
  );
}
