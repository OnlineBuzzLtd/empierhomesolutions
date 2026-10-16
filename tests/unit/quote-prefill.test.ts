// @vitest-environment jsdom
import { createElement, type ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyJobToQuoteDraft,
  quoteCreateHref,
  quoteJobIdFromParams,
  wantsQuoteCreatePanel,
  withJobCustomer,
} from "@/modules/crm/lib/quote-prefill";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const JOB_ID = "11111111-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CUSTOMER_ID = "22222222-cccc-4ccc-8ccc-cccccccccccc";
const job = { id: JOB_ID, customer_id: CUSTOMER_ID, customer: { id: CUSTOMER_ID, full_name: "Hannah Mercer" } };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  document.body.innerHTML = "";
});

describe("quote prefill from a job link", () => {
  it("opens the New Quote form for /quotes?job=<id>, as sent by Empire CRM v2", () => {
    expect(quoteJobIdFromParams({ job: JOB_ID })).toBe(JOB_ID);
    expect(wantsQuoteCreatePanel({ job: JOB_ID })).toBe(true);
    expect(wantsQuoteCreatePanel({ new: "1" })).toBe(true);
    expect(wantsQuoteCreatePanel({ template: "t1" })).toBe(true);
    expect(wantsQuoteCreatePanel({})).toBe(false);
  });

  it("ignores malformed or repeated job params instead of querying with them", () => {
    for (const bad of ["", "abc", `${JOB_ID}'`, [JOB_ID, JOB_ID]]) {
      expect(quoteJobIdFromParams({ job: bad })).toBeNull();
      expect(wantsQuoteCreatePanel({ job: bad })).toBe(false);
    }
  });

  it("keeps the job and the open form when switching template", () => {
    expect(quoteCreateHref({ jobId: JOB_ID })).toBe(`/quotes?new=1&job=${JOB_ID}`);
    expect(quoteCreateHref({ templateId: "t1", jobId: JOB_ID })).toBe(`/quotes?new=1&template=t1&job=${JOB_ID}`);
    expect(quoteCreateHref({})).toBe("/quotes?new=1");
  });

  it("sets customer and job on the draft without losing template lines", () => {
    const draft = { line_items: [{ description: "Boiler", qty: 1, unit_price: 2000 }], vat_rate: 0.2 };
    expect(applyJobToQuoteDraft(draft, job)).toEqual({ ...draft, customer_id: CUSTOMER_ID, job_id: JOB_ID });
    expect(applyJobToQuoteDraft(undefined, job)).toEqual({ customer_id: CUSTOMER_ID, job_id: JOB_ID });
    expect(applyJobToQuoteDraft(draft, null)).toBe(draft);
  });

  it("adds the job's customer when it is outside the capped customer page", () => {
    const others = [{ id: "other", full_name: "Someone Else" }];
    expect(withJobCustomer(others, job).map((c) => c.id)).toEqual([CUSTOMER_ID, "other"]);
    const already = [{ id: CUSTOMER_ID, full_name: "Hannah Mercer" }];
    expect(withJobCustomer(already, job)).toBe(already);
    expect(withJobCustomer(others, null)).toBe(others);
  });

  it("renders the form with the job's customer and job already selected", async () => {
    vi.doMock("@/modules/crm/components/forms/ApiForm", () => ({
      ApiForm: ({ children }: { children: ReactNode }) => createElement("form", null, children),
    }));
    const requested: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      requested.push(url);
      return new Response(JSON.stringify({ items: [{ id: JOB_ID, customer_id: CUSTOMER_ID, title: "Boiler swap" }] }), {
        headers: { "content-type": "application/json" },
      });
    });
    const { QuoteCreateForm } = await import("@/modules/crm/components/forms/QuoteCreateForm");

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        createElement(QuoteCreateForm, {
          customers: withJobCustomer([{ id: "other", full_name: "Someone Else" }], job),
          jobs: [],
          initialQuote: applyJobToQuoteDraft(undefined, job),
        }),
      );
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const customer = container.querySelector<HTMLSelectElement>('select[name="customer_id"]')!;
    const jobSelect = container.querySelector<HTMLSelectElement>('select[name="job_id"]')!;
    expect(customer.value).toBe(CUSTOMER_ID);
    expect(requested[0]).toContain(`customerId=${CUSTOMER_ID}`);
    expect(jobSelect.disabled).toBe(false);
    expect(jobSelect.value).toBe(JOB_ID);
    act(() => root.unmount());
  });
});
