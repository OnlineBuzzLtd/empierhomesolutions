import Link from "next/link";
import { notFound } from "next/navigation";
import { ApiForm } from "@/modules/crm/components/forms/ApiForm";
import { DeleteTrailButton } from "@/modules/crm/components/client/DeleteTrailButton";
import { AttachmentUploadForm } from "@/modules/crm/components/forms/AttachmentUploadForm";
import { NoteCreateForm } from "@/modules/crm/components/forms/NoteCreateForm";
import { SiteContactCreateForm } from "@/modules/crm/components/forms/SiteContactCreateForm";
import { AttachmentList } from "@/modules/crm/components/shared/AttachmentList";
import { CustomerPromiseStrip } from "@/modules/crm/components/shared/CustomerPromiseStrip";
import { EmptyState } from "@/modules/crm/components/shared/EmptyState";
import { SectionCard } from "@/modules/crm/components/shared/SectionCard";
import { requireCrmUser, userCanManageSettings } from "@/modules/crm/lib/auth";
import { buildCustomerPromiseSummary, choosePromiseSummary } from "@/modules/crm/lib/customer-promise";
import { listCustomerPromises } from "@/modules/crm/lib/customer-promises";
import { getCrmDemoState } from "@/modules/crm/lib/demo-state";
import { formatDate, formatDateTime } from "@/modules/crm/lib/format";
import { getCustomerDetail, listUserProfiles } from "@/modules/crm/lib/data";

type SearchParams = Record<string, string | string[] | undefined>;

function buildCreateJobHref(input: {
  customerId: string;
  siteId?: string | null;
  siteContactId?: string | null;
}) {
  const params = new URLSearchParams({ customer: input.customerId });
  if (input.siteId) {
    params.set("site", input.siteId);
  }
  if (input.siteContactId) {
    params.set("siteContact", input.siteContactId);
  }
  return `/jobs?${params.toString()}`;
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function telHref(phone: string | null | undefined) {
  const cleaned = phone?.replace(/[^\d+]/g, "");
  return cleaned ? `tel:${cleaned}` : null;
}

function buildCallNoteDraft(customerName: string) {
  return `Call with ${customerName}\nOutcome:\nNext action:\nOwner:\nDue:`;
}

export default async function CustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const [session, { id }, queryParams, demoState] = await Promise.all([
    requireCrmUser(),
    params,
    searchParams,
    getCrmDemoState(),
  ]);
  const [detail, promises, users] = await Promise.all([
    getCustomerDetail(id, demoState.mode),
    listCustomerPromises({ customerId: id, status: "open", limit: 10 }, demoState.mode),
    listUserProfiles(demoState.mode),
  ]);
  if (!detail) {
    notFound();
  }

  const { customer, jobs, leads, notes, assets, attachments } = detail;
  const sites = detail.sites ?? [];
  const siteContacts = detail.siteContacts ?? [];
  const primarySite = sites.find((site) => site.is_primary) ?? sites[0] ?? null;
  const primarySiteContact =
    siteContacts.find(
      (contact) => contact.is_primary && (!primarySite || contact.site_id === primarySite.id),
    ) ??
    siteContacts.find((contact) => !primarySite || contact.site_id === primarySite.id) ??
    null;
  const createJobHref = buildCreateJobHref({
    customerId: customer.id,
    siteId: primarySite?.id,
    siteContactId: primarySiteContact?.id,
  });
  const callMode = firstParam(queryParams.call) === "1";
  const customerTelHref = telHref(customer.phone);
  const callNoteDraft = callMode ? buildCallNoteDraft(customer.full_name) : undefined;
  const promise = choosePromiseSummary(
    promises,
    buildCustomerPromiseSummary(leads, {
      channelLabel: customer.phone ? "Phone" : customer.email ? "Email" : "Not set",
    }),
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <nav className="text-sm text-slate-500">
        <Link href="/customers" className="hover:text-blue-700">
          Customers
        </Link>
        <span className="mx-2">›</span>
        <span className="font-medium text-slate-900">{customer.full_name}</span>
      </nav>

      {callMode ? (
        <SectionCard title="Call Handling">
          <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-sm font-semibold text-slate-900">{customer.full_name}</p>
              <p className="mt-1 text-sm text-slate-600">
                {[customer.phone, customer.email, customer.postcode].filter(Boolean).join(" · ") || "No contact details saved."}
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Check active work, write the call outcome, then set the next action before leaving the page.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {customerTelHref ? (
                <a
                  href={customerTelHref}
                  className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Call customer
                </a>
              ) : null}
              <a
                href="#customer-call-note"
                className="rounded-lg border border-cyan-200 px-3 py-2 text-sm font-semibold text-cyan-800 hover:bg-cyan-50"
              >
                Log outcome
              </a>
              <Link
                href={createJobHref}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Book job
              </Link>
            </div>
          </div>
        </SectionCard>
      ) : null}

      <CustomerPromiseStrip
        promise={promise}
        editContext={{
          customerId: customer.id,
          users,
          invalidatePaths: ["/api/crm/promises", "/api/crm/dashboard/summary"],
        }}
      />

      <SectionCard title={customer.full_name} demoAnchor="customer-record">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-3">
            <p className="text-sm text-slate-600">Customer since {formatDate(customer.created_at)}</p>
            <div className="grid gap-3 md:grid-cols-2">
              <p className="text-sm text-slate-700">Phone: {customer.phone || "Not set"}</p>
              <p className="text-sm text-slate-700">Email: {customer.email || "Not set"}</p>
              <p className="text-sm text-slate-700">Postcode: {customer.postcode || "Not set"}</p>
              <p className="text-sm text-slate-700">Source: {customer.source || "Not set"}</p>
            </div>
            <p className="text-sm text-slate-700">
              Address:{" "}
              {[customer.address_line1, customer.address_line2, customer.city].filter(Boolean).join(", ") ||
                "Not set"}
            </p>
            <p className="text-sm text-slate-700">Notes: {customer.notes || "No notes"}</p>
          </div>

          <ApiForm
            endpoint={`/api/crm/customers/${customer.id}`}
            method="PATCH"
            submitLabel="Update Customer"
            className="grid gap-3"
          >
            <input
              name="full_name"
              defaultValue={customer.full_name}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              name="phone"
              defaultValue={customer.phone ?? ""}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              name="email"
              defaultValue={customer.email ?? ""}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              name="address_line1"
              defaultValue={customer.address_line1 ?? ""}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              name="city"
              defaultValue={customer.city ?? ""}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              name="postcode"
              defaultValue={customer.postcode ?? ""}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <textarea
              name="notes"
              defaultValue={customer.notes ?? ""}
              className="min-h-24 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </ApiForm>
        </div>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard
          title={`Jobs (${jobs.length})`}
          action={
            <Link
              href={createJobHref}
              className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
            >
              Create Job
            </Link>
          }
        >
          {jobs.length === 0 ? (
            <EmptyState message="No jobs linked to this customer yet." />
          ) : (
            <ul className="space-y-2">
              {jobs.map((job) => (
                <li key={job.id}>
                  <Link
                    href={`/jobs/${job.id}`}
                    className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-3 hover:bg-slate-50"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{job.title}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {job.site?.label ?? "Primary site"} · {job.scheduled_date || "TBC"} ·{" "}
                        {job.assignees && job.assignees.length > 0
                          ? job.assignees
                              .map((assignee) => assignee.user_profile?.full_name ?? "Engineer")
                              .join(", ")
                          : job.assigned_engineer || "Unassigned"}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title={`Assets (${assets.length})`}>
          {assets.length === 0 ? (
            <EmptyState message="No tracked assets for this customer yet." />
          ) : (
            <ul className="space-y-3">
              {assets.map((asset) => (
                <li key={asset.id} className="rounded-lg border border-slate-200 p-3">
                  <p className="text-sm font-semibold text-slate-900">{asset.asset_type}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {[asset.make, asset.model, asset.serial_number].filter(Boolean).join(" · ") ||
                      "No model details"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Service due {formatDate(asset.service_due_date)} · Warranty ends{" "}
                    {formatDate(asset.warranty_end_date)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title={`Sites (${sites.length})`}>
          {sites.length === 0 ? (
            <EmptyState message="No structured sites recorded yet." />
          ) : (
            <ul className="space-y-3">
              {sites.map((site) => (
                <li key={site.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">{site.label}</p>
                    {site.is_primary ? (
                      <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700">
                        Primary
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm text-slate-600">
                    {[site.address_line1, site.address_line2, site.city, site.postcode]
                      .filter(Boolean)
                      .join(", ") || "No site address saved."}
                  </p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <p className="rounded-lg bg-amber-50 p-3 text-xs text-slate-700">
                      <span className="block font-semibold text-slate-900">Access notes</span>
                      {site.access_notes || "No access notes."}
                    </p>
                    <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
                      <span className="block font-semibold text-slate-900">Parking notes</span>
                      {site.parking_notes || "No parking notes."}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title={`Site Contacts (${siteContacts.length})`}>
          {siteContacts.length === 0 ? (
            <EmptyState message="No site-specific contacts recorded yet." />
          ) : (
            <ul className="space-y-3">
              {siteContacts.map((contact) => (
                <li key={contact.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{contact.full_name}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {contact.site?.label ?? "Site"}
                        {contact.role_label ? ` · ${contact.role_label}` : ""}
                      </p>
                    </div>
                    {contact.is_primary ? (
                      <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700">
                        Primary
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm text-slate-600">
                    {[contact.phone, contact.email].filter(Boolean).join(" · ") || "No phone or email saved."}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 border-t border-slate-100 pt-4">
            <p className="mb-3 text-sm font-semibold text-slate-900">Add site contact</p>
            <SiteContactCreateForm sites={sites} />
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title={`Notes (${notes.length})`}>
          {notes.length === 0 ? <EmptyState message="No notes yet." /> : null}
          <ul className="space-y-3">
            {notes.map((note) => (
              <li key={note.id} className="rounded-lg bg-slate-50 p-3">
                <p className="text-sm text-slate-800">{note.body}</p>
                <p className="mt-1 text-xs text-slate-500">{formatDateTime(note.created_at)}</p>
              </li>
            ))}
          </ul>
          <div className="mt-4">
            {callMode ? (
              <p className="mb-2 rounded-lg border border-cyan-100 bg-cyan-50 px-3 py-2 text-sm text-cyan-900">
                Add the call outcome, then save it to the customer timeline.
              </p>
            ) : null}
            <NoteCreateForm
              entityType="customer"
              entityId={customer.id}
              initialBody={callNoteDraft}
              textareaId="customer-call-note"
            />
          </div>
        </SectionCard>

        <SectionCard title={`Attachments (${attachments.length})`}>
          <p className="mb-3 text-xs text-slate-500">
            Customer attachments are historical files tied to this customer record. Website enquiries do not
            automatically add files here unless someone uploads them to the customer, lead, or job later.
          </p>
          <AttachmentList
            attachments={attachments}
            canDelete={userCanManageSettings(session.profile?.role)}
          />
          <div className="mt-4">
            <AttachmentUploadForm entityType="customer" entityId={customer.id} />
          </div>
        </SectionCard>
      </div>

      {userCanManageSettings(session.profile?.role) ? (
        <SectionCard title="Danger Zone">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-900">Delete customer trail</p>
              <p className="mt-1 text-sm text-slate-600">
                Removes operational records tied to this customer and redacts retained financial history.
              </p>
            </div>
            <DeleteTrailButton rootType="customer" rootId={customer.id} />
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}
