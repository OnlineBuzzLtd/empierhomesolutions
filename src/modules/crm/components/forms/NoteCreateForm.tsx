"use client";

import { useState } from "react";
import { ApiForm } from "@/modules/crm/components/forms/ApiForm";

export function NoteCreateForm({
  entityType,
  entityId,
  initialBody,
  textareaId,
  onClearDraft,
}: {
  entityType: "customer" | "job" | "lead";
  entityId: string;
  initialBody?: string;
  textareaId?: string;
  onClearDraft?: () => void;
}) {
  const [body, setBody] = useState(initialBody ?? "");

  return (
    <ApiForm
      endpoint="/api/crm/notes"
      submitLabel="Add Note"
      className="space-y-3"
      onSuccess={() => {
        setBody("");
        onClearDraft?.();
      }}
    >
      <input type="hidden" name="entity_type" value={entityType} />
      <input type="hidden" name="entity_id" value={entityId} />
      <textarea
        id={textareaId}
        name="body"
        required
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="Add note…"
        className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
    </ApiForm>
  );
}
