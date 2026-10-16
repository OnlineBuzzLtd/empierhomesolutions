import type { Customer, Quote } from "@/modules/crm/types";

// Empire CRM v2 sends "Create quote" on a job to /quotes?job=<id>. Treat a
// well-formed job id as a request to open the New Quote form for that job.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type SearchParams = Record<string, string | string[] | undefined>;

export function quoteJobIdFromParams(params: SearchParams): string | null {
  return typeof params.job === "string" && UUID.test(params.job) ? params.job : null;
}

export function wantsQuoteCreatePanel(params: SearchParams) {
  return params.new === "1" || typeof params.template === "string" || quoteJobIdFromParams(params) !== null;
}

// Template chips must keep the job, otherwise switching template drops the
// prefill the user arrived with.
export function quoteCreateHref({ templateId, jobId }: { templateId?: string | null; jobId?: string | null }) {
  const search = new URLSearchParams({ new: "1" });
  if (templateId) search.set("template", templateId);
  if (jobId) search.set("job", jobId);
  return `/quotes?${search.toString()}`;
}

type CustomerOption = Pick<Customer, "id" | "full_name">;
type PrefillJob = { id: string; customer_id: string; customer?: CustomerOption | null };

export function applyJobToQuoteDraft(draft: Partial<Quote> | undefined, job: PrefillJob | null): Partial<Quote> | undefined {
  if (!job) return draft;
  return { ...draft, customer_id: job.customer_id, job_id: job.id };
}

// The customer dropdown is a capped page; make sure the job's customer is an
// option so the preselection is visible and submitted.
export function withJobCustomer<T extends CustomerOption>(customers: T[], job: PrefillJob | null): Array<T | CustomerOption> {
  if (!job?.customer || customers.some((customer) => customer.id === job.customer_id)) return customers;
  return [{ id: job.customer_id, full_name: job.customer.full_name }, ...customers];
}
