"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/modules/crm/lib/supabase-browser";

type SignupState = {
  error: string | null;
  success: string | null;
  isSubmitting: boolean;
};

export function SignupForm() {
  const router = useRouter();
  const [state, setState] = useState<SignupState>({
    error: null,
    success: null,
    isSubmitting: false,
  });

  async function handleSubmit(formData: FormData) {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setState({ error: "Supabase CRM environment variables are missing.", success: null, isSubmitting: false });
      return;
    }

    const payload = {
      business_name: String(formData.get("business_name") ?? ""),
      slug: String(formData.get("slug") ?? ""),
      full_name: String(formData.get("full_name") ?? ""),
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      primary_phone: String(formData.get("primary_phone") ?? ""),
      support_email: String(formData.get("support_email") ?? ""),
      legal_name: String(formData.get("legal_name") ?? ""),
      vat_registration_number: String(formData.get("vat_registration_number") ?? ""),
      gas_safe_number: String(formData.get("gas_safe_number") ?? ""),
    };

    setState({ error: null, success: null, isSubmitting: true });

    const response = await fetch("/api/crm/onboarding/signup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const body = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setState({
        error: body.error ?? "Failed to create the workspace.",
        success: null,
        isSubmitting: false,
      });
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: payload.email,
      password: payload.password,
    });

    if (signInError) {
      setState({
        error: null,
        success: "Workspace created. Sign in with the owner email and password to continue.",
        isSubmitting: false,
      });
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form action={handleSubmit} className="space-y-4 rounded-2xl bg-white p-6 shadow-2xl">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Business Name</label>
          <input name="business_name" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Workspace Slug</label>
          <input name="slug" placeholder="acme-heating" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Primary Phone</label>
          <input name="primary_phone" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Owner Name</label>
          <input name="full_name" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Owner Email</label>
          <input name="email" type="email" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Password</label>
          <input name="password" type="password" minLength={8} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Support Email</label>
          <input name="support_email" type="email" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Legal Name</label>
          <input name="legal_name" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">VAT Number</label>
          <input name="vat_registration_number" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="md:col-span-2">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Gas Safe Number</label>
          <input name="gas_safe_number" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      {state.error ? <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</p> : null}
      {state.success ? <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{state.success}</p> : null}

      <button
        type="submit"
        disabled={state.isSubmitting}
        className="block w-full rounded-lg bg-blue-600 py-2.5 text-center text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
      >
        {state.isSubmitting ? "Creating Workspace..." : "Create Workspace"}
      </button>

      <p className="text-center text-sm text-slate-500">
        Already have access?{" "}
        <Link href="/login" className="font-medium text-blue-600 hover:text-blue-700">
          Sign in
        </Link>
      </p>
    </form>
  );
}
