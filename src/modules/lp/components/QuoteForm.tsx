"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Section } from "@/modules/ui/Section";
import { getAttribution } from "@/modules/tracking/attribution";
import { pushDataLayer, trackFormEvent } from "@/modules/tracking/pushDataLayer";

const quoteFormSchema = z.object({
  name: z.string().min(2, "Enter your name"),
  postcode: z.string().regex(/^[A-Za-z]{1,2}\d[A-Za-z\d]?\s?\d[A-Za-z]{2}$/i, "Enter a valid UK postcode"),
  phone: z.string().regex(/^[0-9+\s()-]{10,15}$/, "Enter a valid phone number"),
  issue: z.string().default(""),
  companyWebsite: z.string().optional(),
});

type QuoteFormInput = z.input<typeof quoteFormSchema>;

type QuoteFormProps = {
  service?: string;
  location?: string;
  leadType?: "repair" | "install" | "finance" | "power-flush";
  heading?: string;
};

export function QuoteForm({
  service,
  location,
  leadType = "repair",
  heading = "Book now - request a callback",
}: QuoteFormProps) {
  const [submitState, setSubmitState] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const attribution = useMemo(() => getAttribution(), []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const updateMobileState = () => setIsMobile(mediaQuery.matches);
    updateMobileState();
    mediaQuery.addEventListener("change", updateMobileState);
    return () => mediaQuery.removeEventListener("change", updateMobileState);
  }, []);

  const {
    register,
    handleSubmit,
    clearErrors,
    setError,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<QuoteFormInput>({
    resolver: zodResolver(quoteFormSchema),
    defaultValues: {
      name: "",
      postcode: "",
      phone: "",
      issue: "",
      companyWebsite: "",
    },
  });

  const onFirstFocus = () => {
    if (typeof window === "undefined") {
      return;
    }

    const key = "ehs_form_started";
    if (!window.sessionStorage.getItem(key)) {
      trackFormEvent("form_start");
      window.sessionStorage.setItem(key, "1");
    }
  };

  const onSubmit = handleSubmit(async (values) => {
    setSubmitState("idle");
    setErrorMessage("");
    const issueText = (values.issue ?? "").trim();

    if (!isMobile && issueText.length < 10) {
      setError("issue", { type: "manual", message: "Tell us a bit more about the issue" });
      return;
    }

    clearErrors("issue");

    trackFormEvent("form_submit_attempt");
    trackFormEvent("form_submit");

    try {
      const response = await fetch("/api/lead", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...values,
          issue: issueText,
          pagePath: window.location.pathname,
          service,
          location,
          leadType,
          origin: window.location.origin,
          attribution,
        }),
      });

      const payload = (await response.json()) as { error?: { code?: string; message?: string } };

      if (!response.ok) {
        const label = payload.error?.code ?? "unknown";
        trackFormEvent("form_error", label);
        setSubmitState("error");
        setErrorMessage(payload.error?.message ?? "Submission failed. Please try again.");
        return;
      }

      trackFormEvent("form_success");
      pushDataLayer({ event: "lead_conversion", category: "lead_form", action: leadType });
      setSubmitState("success");
      reset();
    } catch {
      trackFormEvent("form_error", "network_error");
      setSubmitState("error");
      setErrorMessage("Network error. Please call us directly.");
    }
  });

  return (
    <Section title={heading} subtitle="Share your details and we will call you back.">
      <form
        id="lead-form"
        className="space-y-4 rounded-xl border border-slate-200 border-t-4 border-t-[var(--ehs-brand-accent)] bg-white p-5 shadow-[var(--ehs-card-shadow)]"
        onSubmit={onSubmit}
      >
        <input
          {...register("companyWebsite")}
          tabIndex={-1}
          autoComplete="off"
          className="absolute left-[-10000px] top-auto h-px w-px overflow-hidden"
          aria-hidden="true"
        />

        <Field label="Name" error={errors.name?.message}>
          <input
            {...register("name")}
            onFocus={onFirstFocus}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-[var(--ehs-brand-accent)] focus:ring-2 focus:ring-[var(--ehs-brand-accent)]/20"
            placeholder="Jane Smith"
          />
        </Field>

        <Field label="Postcode" error={errors.postcode?.message}>
          <input
            {...register("postcode")}
            onFocus={onFirstFocus}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-[var(--ehs-brand-accent)] focus:ring-2 focus:ring-[var(--ehs-brand-accent)]/20"
            placeholder="UB8 1AA"
          />
        </Field>

        <Field label="Phone" error={errors.phone?.message}>
          <input
            {...register("phone")}
            onFocus={onFirstFocus}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-[var(--ehs-brand-accent)] focus:ring-2 focus:ring-[var(--ehs-brand-accent)]/20"
            placeholder="07XXXXXXXXX"
          />
        </Field>

        <Field label="Issue" error={errors.issue?.message}>
          <textarea
            {...register("issue")}
            onFocus={onFirstFocus}
            rows={4}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-[var(--ehs-brand-accent)] focus:ring-2 focus:ring-[var(--ehs-brand-accent)]/20"
            placeholder="Tell us what is happening..."
          />
        </Field>

        <input type="hidden" name="utm_source" value={attribution.utm_source ?? ""} readOnly />
        <input type="hidden" name="utm_medium" value={attribution.utm_medium ?? ""} readOnly />
        <input type="hidden" name="utm_campaign" value={attribution.utm_campaign ?? ""} readOnly />
        <input type="hidden" name="utm_term" value={attribution.utm_term ?? ""} readOnly />
        <input type="hidden" name="utm_content" value={attribution.utm_content ?? ""} readOnly />
        <input type="hidden" name="gclid" value={attribution.gclid ?? ""} readOnly />
        <input type="hidden" name="msclkid" value={attribution.msclkid ?? ""} readOnly />
        <input type="hidden" name="landing_url" value={attribution.landing_url ?? ""} readOnly />

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-[var(--ehs-brand-accent)] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isSubmitting ? "Booking..." : "Book Now"}
        </button>
        <p className="rounded-md bg-[var(--ehs-brand-dark)]/8 px-3 py-2 text-xs font-medium text-[var(--ehs-brand-dark)]">
          Callback target: within 30 minutes for urgent requests, 24/7 emergency call out.
        </p>

        {submitState === "success" ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Thank you. Your request is in and our team will contact you shortly.
          </p>
        ) : null}

        {submitState === "error" ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </p>
        ) : null}
      </form>
    </Section>
  );
}

type FieldProps = {
  label: string;
  error?: string;
  children: ReactNode;
};

function Field({ label, error, children }: FieldProps) {
  return (
    <label className="block text-sm font-medium text-[var(--ehs-brand-dark)]">
      {label}
      <div className="mt-1">{children}</div>
      {error ? <span className="mt-1 block text-xs text-red-600">{error}</span> : null}
    </label>
  );
}
