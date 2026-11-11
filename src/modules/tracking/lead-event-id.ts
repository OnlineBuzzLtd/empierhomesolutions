import { createHash } from "node:crypto";

export function leadMeasurementEventId(tenantId: string, leadId: string): string {
  return `ehs_lead_${createHash("sha256").update(`${tenantId}:${leadId}`).digest("hex")}`;
}
