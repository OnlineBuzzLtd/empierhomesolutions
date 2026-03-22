import type { Attachment } from "@/modules/crm/types";
import { AttachmentActions } from "@/modules/crm/components/shared/AttachmentActions";
import { EmptyState } from "@/modules/crm/components/shared/EmptyState";
import { formatDateTime } from "@/modules/crm/lib/format";
import { groupAttachmentsByBucket, isImageAttachment } from "@/modules/crm/lib/attachments";

export function AttachmentList({
  attachments,
  canDelete = false,
  emptyMessage = "No attachments yet.",
}: {
  attachments: Attachment[];
  canDelete?: boolean;
  emptyMessage?: string;
}) {
  const groups = groupAttachmentsByBucket(attachments);

  if (groups.length === 0) {
    return <EmptyState message={emptyMessage} />;
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.bucket} className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{group.title}</h3>
            <span className="text-xs text-slate-400">{group.attachments.length} files</span>
          </div>
          <ul className="space-y-2">
            {group.attachments.map((attachment) => (
              <li key={attachment.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-3 text-sm text-slate-700">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">{attachment.file_name}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {isImageAttachment(attachment) ? "Image" : "Document"} · {attachment.file_type || "file"} · {formatDateTime(attachment.created_at)}
                  </p>
                </div>
                <AttachmentActions attachmentId={attachment.id} canDelete={canDelete} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
