import { ApiForm } from "@/modules/crm/components/forms/ApiForm";

export function NoteCreateForm({ entityType, entityId }: { entityType: "customer" | "job" | "lead"; entityId: string }) {
  return (
    <ApiForm endpoint="/api/crm/notes" submitLabel="Add Note" className="space-y-3">
      <input type="hidden" name="entity_type" value={entityType} />
      <input type="hidden" name="entity_id" value={entityId} />
      <textarea name="body" required placeholder="Add note…" className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
    </ApiForm>
  );
}
