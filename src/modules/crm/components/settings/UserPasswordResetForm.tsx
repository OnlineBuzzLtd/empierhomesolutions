"use client";

import { useState, type FormEvent } from "react";

import { useCrmDemoMode } from "@/modules/crm/components/demo/DemoModeProvider";

type Props = {
  userId: string;
  email: string | null;
};

type ResetPasswordResponse = {
  ok?: boolean;
  error?: string;
  email?: string | null;
  generated_password?: string | null;
};

export function UserPasswordResetForm({ userId, email }: Props) {
  const demo = useCrmDemoMode();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [generatedEmail, setGeneratedEmail] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setGeneratedPassword(null);
    setGeneratedEmail(null);
    setIsSubmitting(true);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const password = String(formData.get("password") ?? "");

    const response = await fetch(`/api/crm/settings/users/${userId}/password`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, password }),
    });
    const result = (await response.json().catch(() => ({
      error: "Unexpected response.",
    }))) as ResetPasswordResponse;

    if (!response.ok || !result.ok) {
      setError(result.error ?? "Failed to reset password.");
      setIsSubmitting(false);
      return;
    }

    form.reset();
    if (result.generated_password) {
      setGeneratedPassword(result.generated_password);
      setGeneratedEmail(result.email ?? email);
    } else {
      setSuccess("Password updated.");
    }
    setIsSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        <input
          name="password"
          type="text"
          placeholder="Leave blank to generate"
          disabled={isSubmitting || demo.active}
          className="min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-xs disabled:opacity-60 sm:w-56"
        />
        <button
          type="submit"
          disabled={isSubmitting || demo.active}
          className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {demo.active ? "Locked" : isSubmitting ? "Resetting..." : "Reset Password"}
        </button>
      </div>
      {error ? <p className="text-right text-xs text-rose-700">{error}</p> : null}
      {success ? <p className="text-right text-xs font-medium text-emerald-700">{success}</p> : null}
      {generatedPassword ? (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-2 text-xs text-emerald-900">
          <p className="font-semibold">Generated password for {generatedEmail ?? "user"}.</p>
          <code className="mt-1 block break-all rounded bg-emerald-100 px-1.5 py-1 font-mono">
            {generatedPassword}
          </code>
        </div>
      ) : null}
    </form>
  );
}
