"use client";

import { useState, type FormEvent } from "react";

import { DemoReadonlyNotice } from "@/modules/crm/components/demo/DemoReadonlyNotice";
import { useCrmDemoMode } from "@/modules/crm/components/demo/DemoModeProvider";
import { changeOwnPasswordSchema } from "@/modules/crm/lib/password-validation";
import { getSupabaseBrowserClient } from "@/modules/crm/lib/supabase-browser";

type Props = {
  email: string | null;
};

export function ChangePasswordForm({ email }: Props) {
  const demo = useCrmDemoMode();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const parsed = changeOwnPasswordSchema.safeParse({
      current_password: formData.get("current_password"),
      new_password: formData.get("new_password"),
      confirm_password: formData.get("confirm_password"),
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid password details.");
      return;
    }

    if (!email) {
      setError("Your account does not have an email address.");
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setError("Password changes are not available in this environment.");
      return;
    }

    setIsSubmitting(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: parsed.data.current_password,
    });

    if (signInError) {
      setError("Current password is incorrect.");
      setIsSubmitting(false);
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: parsed.data.new_password,
    });

    if (updateError) {
      setError(updateError.message || "Failed to update password.");
      setIsSubmitting(false);
      return;
    }

    form.reset();
    setSuccess("Password updated.");
    setIsSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <fieldset disabled={isSubmitting || demo.active} className="grid gap-3 disabled:opacity-60">
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          Current password
          <input
            name="current_password"
            type="password"
            autoComplete="current-password"
            required
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal"
          />
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          New password
          <input
            name="new_password"
            type="password"
            autoComplete="new-password"
            required
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal"
          />
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          Confirm new password
          <input
            name="confirm_password"
            type="password"
            autoComplete="new-password"
            required
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal"
          />
        </label>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={isSubmitting || demo.active}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {demo.active ? "Demo Mode Locked" : isSubmitting ? "Updating..." : "Change Password"}
        </button>
        <DemoReadonlyNotice />
        {error ? <p className="text-sm text-rose-700">{error}</p> : null}
        {success ? <p className="text-sm font-medium text-emerald-700">{success}</p> : null}
      </div>
    </form>
  );
}
