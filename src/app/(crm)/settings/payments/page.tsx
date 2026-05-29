import { notFound } from "next/navigation";
import { ApiForm } from "@/modules/crm/components/forms/ApiForm";
import { SectionCard } from "@/modules/crm/components/shared/SectionCard";
import { SetupNotice } from "@/modules/crm/components/shared/SetupNotice";
import { requireSettingsAccess } from "@/modules/crm/lib/auth";
import { getCrmSetupState } from "@/modules/crm/lib/setup";
import { createCrmServerClient } from "@/modules/crm/lib/supabase-server";

export default async function PaymentSettingsPage() {
  const setup = getCrmSetupState();
  if (!setup.configured && setup.message) {
    return <SetupNotice message={setup.message} />;
  }

  const session = await requireSettingsAccess();
  if (!session.user || !session.tenant) {
    notFound();
  }

  const supabase = await createCrmServerClient();
  const { data: settings } = await supabase
    .schema("crm")
    .from("tenant_settings")
    .select("*")
    .eq("tenant_id", session.tenant.id)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Payment Providers</h1>
        <p className="mt-1 text-sm text-slate-500">
          Store tenant payment-provider identifiers for invoice payment links.
        </p>
      </div>

      <SectionCard title="Primary Provider">
        <ApiForm
          endpoint="/api/crm/settings/payments"
          submitLabel="Save Payment Settings"
          className="grid gap-3"
        >
          <select
            name="payment_primary_provider"
            defaultValue={String(settings?.payment_primary_provider ?? "none")}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="none">None</option>
            <option value="stripe">Stripe</option>
            <option value="gocardless">GoCardless</option>
          </select>
          <input
            name="stripe_account_id"
            defaultValue={String(settings?.stripe_account_id ?? "")}
            placeholder="Stripe account ID"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            name="gocardless_merchant_id"
            defaultValue={String(settings?.gocardless_merchant_id ?? "")}
            placeholder="GoCardless merchant ID"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </ApiForm>
      </SectionCard>
    </div>
  );
}
