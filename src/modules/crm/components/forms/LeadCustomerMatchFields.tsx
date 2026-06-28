"use client";

import { useEffect, useMemo, useState } from "react";
import { findCustomerMatchCandidates } from "@/modules/crm/lib/customer-match";
import type { Customer } from "@/modules/crm/types";

type ServerMatchCandidate = {
  customer: Customer;
  score: number;
  reasons: string[];
  activeLeadCount: number;
  activeJobCount: number;
};

type MatchResponse = {
  ok: true;
  candidates: ServerMatchCandidate[];
};

export function LeadCustomerMatchFields({ customers }: { customers: Customer[] }) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [postcode, setPostcode] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [serverCandidates, setServerCandidates] = useState<ServerMatchCandidate[] | null>(null);
  const [matchLookupState, setMatchLookupState] = useState<"idle" | "loading" | "error">("idle");
  const localCandidates = useMemo(
    () => findCustomerMatchCandidates({ fullName, phone, email, postcode }, customers),
    [customers, email, fullName, phone, postcode],
  );
  const hasLookupInput =
    fullName.trim().length >= 3 ||
    phone.replace(/[^\d+]/g, "").length >= 6 ||
    email.trim().length >= 5 ||
    postcode.trim().length >= 3;
  const candidates = (hasLookupInput ? serverCandidates : null) ?? localCandidates.map((candidate) => ({
    ...candidate,
    activeLeadCount: 0,
    activeJobCount: 0,
  }));

  useEffect(() => {
    if (!hasLookupInput) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams();
      if (fullName.trim()) params.set("name", fullName.trim());
      if (phone.trim()) params.set("phone", phone.trim());
      if (email.trim()) params.set("email", email.trim());
      if (postcode.trim()) params.set("postcode", postcode.trim());
      setMatchLookupState("loading");
      fetch(`/api/crm/customers/matches?${params.toString()}`, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error("Could not check existing customers.");
          }
          return (await response.json()) as MatchResponse;
        })
        .then((payload) => {
          setServerCandidates(payload.candidates);
          setMatchLookupState("idle");
        })
        .catch((error) => {
          if (controller.signal.aborted) {
            return;
          }
          console.error(error);
          setServerCandidates(null);
          setMatchLookupState("error");
        });
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [email, fullName, hasLookupInput, phone, postcode]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Customer name</span>
          <input
            name="customer_full_name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Who is calling?"
            autoComplete="name"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Phone</span>
          <input
            name="customer_phone"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Best callback number"
            autoComplete="tel"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Email</span>
          <input
            name="customer_email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Optional"
            autoComplete="email"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Postcode</span>
          <input
            name="customer_postcode"
            value={postcode}
            onChange={(event) => setPostcode(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm uppercase"
            placeholder="Optional"
            autoComplete="postal-code"
          />
        </label>
      </div>

      {candidates.length > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-amber-950">Possible existing customer</p>
            {matchLookupState === "loading" ? <span className="text-xs font-semibold text-amber-800">Checking live records...</span> : null}
            {matchLookupState === "error" ? <span className="text-xs font-semibold text-rose-700">Live match check failed</span> : null}
          </div>
          <div className="mt-2 space-y-2">
            {candidates.map(({ customer, reasons, activeLeadCount, activeJobCount }) => (
              <div key={customer.id} className="flex flex-col gap-2 rounded-lg bg-white px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{customer.full_name}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {[customer.phone, customer.email, customer.postcode].filter(Boolean).join(" · ") || "Customer record"}
                  </p>
                  <p className="mt-0.5 text-xs text-amber-800">{reasons.join(", ")}</p>
                  {activeLeadCount > 0 || activeJobCount > 0 ? (
                    <p className="mt-1 text-xs font-semibold text-rose-700">
                      {[
                        activeLeadCount > 0 ? `${activeLeadCount} active ${activeLeadCount === 1 ? "enquiry" : "enquiries"}` : null,
                        activeJobCount > 0 ? `${activeJobCount} active job${activeJobCount === 1 ? "" : "s"}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCustomerId(customer.id)}
                  className="rounded-lg border border-amber-200 px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-50"
                >
                  Use existing
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <label className="block">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Existing customer, optional</span>
        <select
          name="customer_id"
          value={selectedCustomerId}
          onChange={(event) => setSelectedCustomerId(event.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">New or unknown customer</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.full_name} {customer.phone ? `- ${customer.phone}` : ""}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
