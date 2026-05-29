import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/modules/crm/components/shared/EmptyState";
import { SectionCard } from "@/modules/crm/components/shared/SectionCard";
import { requireSettingsAccess } from "@/modules/crm/lib/auth";
import { createCrmServerClient } from "@/modules/crm/lib/supabase-server";
import { listNotificationTemplates } from "@/modules/crm/notifications/render";

export default async function NotificationTemplatesPage() {
  const session = await requireSettingsAccess();
  if (!session.user || !session.tenant) {
    notFound();
  }

  const supabase = await createCrmServerClient();
  const templates = await listNotificationTemplates(supabase, session.tenant.id);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Notification Templates</h1>
          <p className="mt-1 text-sm text-slate-500">
            Read-only view of workspace overrides and inherited defaults used by reminders, chase, invoices, and reviews.
          </p>
        </div>
        <Link href="/settings" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          Back to settings
        </Link>
      </div>

      <SectionCard title="Templates">
        {templates.length === 0 ? <EmptyState message="No notification templates are configured." /> : null}
        <ul className="space-y-3">
          {templates.map((template) => (
            <li key={template.id} className="rounded-lg border border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {template.key} · {template.channel}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {template.tenant_id ? "Workspace override" : "Inherited default"} · {template.locale}
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                  {template.active ? "Active" : "Inactive"}
                </span>
              </div>
              {template.subject ? <p className="mt-3 text-sm font-medium text-slate-800">{template.subject}</p> : null}
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{template.body}</p>
              {template.variables.length > 0 ? (
                <p className="mt-3 text-xs text-slate-500">Variables: {template.variables.join(", ")}</p>
              ) : null}
            </li>
          ))}
        </ul>
      </SectionCard>
    </div>
  );
}
