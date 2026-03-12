"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AttachmentUploadForm({
  entityType,
  entityId,
}: {
  entityType: string;
  entityId: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(formData: FormData) {
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

  return (
    <form action={handleSubmit} className="space-y-3">
      <input type="hidden" name="entity_type" value={entityType} />
      <input type="hidden" name="entity_id" value={entityId} />
      <div className="grid gap-3 md:grid-cols-[1fr_220px]">
        <input name="file" type="file" required className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <input name="file_type" placeholder="image / certificate / compliance" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      </div>
      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
      >
        {isSubmitting ? "Uploading..." : "Upload Attachment"}
      </button>
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
    </form>
  );
}
