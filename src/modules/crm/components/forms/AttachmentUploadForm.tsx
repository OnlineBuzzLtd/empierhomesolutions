"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { DemoReadonlyNotice } from "@/modules/crm/components/demo/DemoReadonlyNotice";
import { useCrmDemoMode } from "@/modules/crm/components/demo/DemoModeProvider";
import { getAttachmentTypeOptions } from "@/modules/crm/lib/attachments";

export function AttachmentUploadForm({
  entityType,
  entityId,
}: {
  entityType: string;
  entityId: string;
}) {
  const demo = useCrmDemoMode();
  const attachmentTypes = getAttachmentTypeOptions(entityType);
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitForm(formData: FormData) {
    setError(null);
    setIsSubmitting(true);

    const response = await fetch("/api/crm/attachments/upload", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const result = await response.json().catch(() => ({ error: "Upload failed." }));
      setError(result.error ?? "Upload failed.");
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
    router.refresh();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitForm(new FormData(event.currentTarget));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <fieldset disabled={isSubmitting || demo.active} className="space-y-3 disabled:opacity-60">
        <input type="hidden" name="entity_type" value={entityType} />
        <input type="hidden" name="entity_id" value={entityId} />
        <div className="grid gap-3 md:grid-cols-[1fr_220px]">
          <input name="file" type="file" required className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <select name="file_type" defaultValue={attachmentTypes[0]} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            {attachmentTypes.map((type) => (
              <option key={type} value={type}>
                {type.replaceAll("-", " ")}
              </option>
            ))}
          </select>
        </div>
      </fieldset>
      <button
        type="submit"
        disabled={isSubmitting || demo.active}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
      >
        {demo.active ? "Demo Mode Locked" : isSubmitting ? "Uploading..." : "Upload Attachment"}
      </button>
      <DemoReadonlyNotice />
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
    </form>
  );
}
