import type { Attachment } from "@/modules/crm/types";

export type AttachmentBucket = "photos" | "compliance" | "commercial" | "general";

type AttachmentBucketGroup = {
  bucket: AttachmentBucket;
  title: string;
  attachments: Attachment[];
};

const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "gif", "heic", "heif"] as const;

export function normalizeAttachmentType(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

export function isImageAttachment(attachment: Pick<Attachment, "file_name" | "file_type">) {
  const normalizedType = normalizeAttachmentType(attachment.file_type);
  if (normalizedType.includes("image") || normalizedType.includes("photo")) {
    return true;
  }

  const extension = attachment.file_name.split(".").pop()?.toLowerCase() ?? "";
  return IMAGE_EXTENSIONS.includes(extension as (typeof IMAGE_EXTENSIONS)[number]);
}

export function getAttachmentBucket(attachment: Pick<Attachment, "file_name" | "file_type">): AttachmentBucket {
  const normalizedType = normalizeAttachmentType(attachment.file_type);

  if (isImageAttachment(attachment)) {
    return "photos";
  }

  if (["certificate", "compliance", "warranty", "gas-safe", "safety", "service-record"].some((value) => normalizedType.includes(value))) {
    return "compliance";
  }

  if (["quote", "invoice", "receipt", "contract", "payment", "finance"].some((value) => normalizedType.includes(value))) {
    return "commercial";
  }

  return "general";
}

export function getAttachmentBucketTitle(bucket: AttachmentBucket) {
  switch (bucket) {
    case "photos":
      return "Photos";
    case "compliance":
      return "Compliance";
    case "commercial":
      return "Commercial Docs";
    default:
      return "Other Files";
  }
}

export function groupAttachmentsByBucket(attachments: Attachment[]): AttachmentBucketGroup[] {
  const grouped = new Map<AttachmentBucket, Attachment[]>();

  for (const attachment of attachments) {
    const bucket = getAttachmentBucket(attachment);
    const current = grouped.get(bucket) ?? [];
    current.push(attachment);
    grouped.set(bucket, current);
  }

  return ["photos", "compliance", "commercial", "general"]
    .map((bucket) => ({
      bucket: bucket as AttachmentBucket,
      title: getAttachmentBucketTitle(bucket as AttachmentBucket),
      attachments: grouped.get(bucket as AttachmentBucket) ?? [],
    }))
    .filter((group) => group.attachments.length > 0);
}

export function getAttachmentTypeOptions(entityType: string) {
  switch (entityType) {
    case "job":
      return ["photo", "certificate", "compliance", "receipt", "warranty", "other"];
    case "customer":
      return ["photo", "contract", "warranty", "compliance", "other"];
    case "quote":
      return ["quote", "commercial-doc", "photo", "other"];
    case "invoice":
      return ["invoice", "receipt", "finance", "other"];
    default:
      return ["photo", "compliance", "commercial-doc", "other"];
  }
}
