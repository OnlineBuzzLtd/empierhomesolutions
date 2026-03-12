import Link from "next/link";
import { CustomerCreateForm } from "@/modules/crm/components/forms/CustomerCreateForm";
import { EmptyState } from "@/modules/crm/components/shared/EmptyState";
import { SectionCard } from "@/modules/crm/components/shared/SectionCard";
import { SetupNotice } from "@/modules/crm/components/shared/SetupNotice";
import { requireCrmUser } from "@/modules/crm/lib/auth";
import { getCrmSetupState } from "@/modules/crm/lib/setup";
import { listCustomers, listCustomFieldDefinitions } from "@/modules/crm/lib/data";

export default async function CustomersPage() {
  const setup = getCrmSetupState();
  if (!setup.configured && setup.message) {
    return <SetupNotice message={setup.message} />;
  }

  await requireCrmUser();
  const [customers, customFields] = await Promise.all([listCustomers(), listCustomFieldDefinitions()]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Customers</h1>
        <p className="mt-1 text-sm text-slate-500">{customers.length} customers in CRM.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        <SectionCard title="Customer List">
          {customers.length === 0 ? (
            <EmptyState message="No customers yet. Create the first customer using the form." />
          ) : (
            <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {customers.map((customer) => (
                <Link key={customer.id} href={`/customers/${customer.id}`} className="flex items-center justify-between gap-4 px-4 py-4 hover:bg-slate-50">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{customer.full_name}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {customer.phone || "No phone"} · {customer.postcode || "No postcode"}
                    </p>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    <p>{customer.job_count} total jobs</p>
                    <p>{customer.active_job_count} active</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Add Customer">
          <CustomerCreateForm customFields={customFields} />
        </SectionCard>
      </div>
    </div>
  );
}
