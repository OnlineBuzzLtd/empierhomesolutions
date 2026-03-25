"use client";

import { useState } from "react";
import { AttachmentUploadForm } from "@/modules/crm/components/forms/AttachmentUploadForm";
import { NoteCreateForm } from "@/modules/crm/components/forms/NoteCreateForm";
import { EngineerAiAssistPanel } from "@/modules/crm/components/jobs/EngineerAiAssistPanel";
import { AttachmentList } from "@/modules/crm/components/shared/AttachmentList";
import { EmptyState } from "@/modules/crm/components/shared/EmptyState";
import { formatDateTime } from "@/modules/crm/lib/format";
import type { Attachment, EngineerAiAssistDraft, EngineerAiAssistState, Note } from "@/modules/crm/types";

const noteTextareaId = "engineer-job-note-draft";

export function EngineerJobWorkspace({
  jobId,
  notes,
  attachments,
  canDeleteAttachments,
  aiAccess,
}: {
  jobId: string;
  notes: Note[];
  attachments: Attachment[];
  canDeleteAttachments: boolean;
  aiAccess: EngineerAiAssistState;
}) {
  const [draftBody, setDraftBody] = useState("");
  const [draftLabel, setDraftLabel] = useState<string | null>(null);
  const [draftVersion, setDraftVersion] = useState(0);

  function handleUseDraft(draft: EngineerAiAssistDraft) {
    if (!draft.note_body) {
      return;
    }

    setDraftBody(draft.note_body);
    setDraftLabel(draft.title);
    setDraftVersion((current) => current + 1);
    document.getElementById(noteTextareaId)?.scrollIntoView({ behavior: "smooth", block: "center" });
    document.getElementById(noteTextareaId)?.focus();
  }

  function clearDraft() {
    setDraftBody("");
    setDraftLabel(null);
    setDraftVersion((current) => current + 1);
  }

  return (
    <div className="space-y-6">
      <EngineerAiAssistPanel jobId={jobId} access={aiAccess} onUseDraft={handleUseDraft} />

      <div id="job-notes" className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-slate-900">Notes ({notes.length})</h2>
          </div>
          {notes.length === 0 ? <EmptyState message="No notes yet." /> : null}
          <ul className="space-y-3">
            {notes.map((note) => (
              <li key={note.id} className="rounded-lg bg-slate-50 p-3">
                <p className="text-sm text-slate-800">{note.body}</p>
                <p className="mt-1 text-xs text-slate-500">{formatDateTime(note.created_at)}</p>
              </li>
            ))}
          </ul>
          <div className="mt-4">
            {draftLabel ? (
              <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                <p>{draftLabel} inserted into the note form. Review it before saving.</p>
                <button type="button" onClick={clearDraft} className="rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-semibold text-blue-800 hover:bg-blue-100">
                  Clear Draft
                </button>
              </div>
            ) : null}
            <NoteCreateForm
              entityType="job"
              entityId={jobId}
              initialBody={draftBody}
              bodyVersion={draftVersion}
              textareaId={noteTextareaId}
              onClearDraft={clearDraft}
            />
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-slate-900">Attachments ({attachments.length})</h2>
          </div>
          <div id="job-attachments">
            <AttachmentList attachments={attachments} canDelete={canDeleteAttachments} />
            <div className="mt-4">
              <AttachmentUploadForm entityType="job" entityId={jobId} />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
