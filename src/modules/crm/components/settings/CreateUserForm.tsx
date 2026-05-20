"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { DemoReadonlyNotice } from "@/modules/crm/components/demo/DemoReadonlyNotice";
import { useCrmDemoMode } from "@/modules/crm/components/demo/DemoModeProvider";
import { crmRoles } from "@/modules/crm/types";

type CreateUserResponse = {
  ok: boolean;
  error?: string;
  user_id?: string;
  email?: string;
  generated_password?: string | null;
};

export function CreateUserForm() {
  const demo = useCrmDemoMode();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [generatedEmail, setGeneratedEmail] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setGeneratedPassword(null);
    setGeneratedEmail(null);

    const formData = new FormData(event.currentTarget);
    const payload: Record<string, unknown> = {};
    formData.forEach((value, key) => {
      payload[key] = value;
    });

    const response = await fetch("/api/crm/settings/users/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = (await response.json().catch(() => ({ error: "Unexpected response." }))) as CreateUserResponse;

    if (!response.ok || !result.ok) {
      setError(result.error ?? "Failed to create user.");
      setIsSubmitting(false);
      return;
    }

    if (result.generated_password) {
      setGeneratedPassword(result.generated_password);
      setGeneratedEmail(result.email ?? null);
    }
    setIsSubmitting(false);
    (event.currentTarget as HTMLFormElement).reset();
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3">
      <fieldset disabled={isSubmitting || demo.active} className="grid gap-3 md:grid-cols-2 disabled:opacity-60">
        <input name="full_name" required placeholder="Full name" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <input name="email" required type="email" placeholder="Email" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <input name="phone" placeholder="Phone (optional)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <select name="role" defaultValue="engineer" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          {crmRoles.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
        <input name="agreed_hours" placeholder="Agreed hours (optional)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <input name="pay_type" placeholder="Pay type (optional)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <input
          name="password"
          type="text"
          placeholder="Leave blank to auto-generate a strong password"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2"
        />
      </fieldset>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isSubmitting || demo.active}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {demo.active ? "Demo Mode Locked" : isSubmitting ? "Creating..." : "Create User"}
        </button>
        <DemoReadonlyNotice />
        {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      </div>
      {generatedPassword ? (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm">
          <p className="font-semibold text-emerald-900">User created.</p>
          <p className="mt-1 text-emerald-900">
            Email: <code className="rounded bg-emerald-100 px-1">{generatedEmail}</code>
          </p>
          <p className="mt-1 text-emerald-900">
            Generated password (copy now &mdash; we don&apos;t store it):{" "}
            <code className="rounded bg-emerald-100 px-1 font-mono">{generatedPassword}</code>
          </p>
        </div>
      ) : null}
    </form>
  );
}
