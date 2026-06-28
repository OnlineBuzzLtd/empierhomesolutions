import { findCustomerMatchCandidates } from "@/modules/crm/lib/customer-match";
import type { Customer, JobWithRelations } from "@/modules/crm/types";
import type { BookingRecoveryCase } from "@/modules/platform/lib/booking-recovery";

export function findBookingRecoveryCustomerCandidates(recovery: BookingRecoveryCase, customers: Customer[]) {
  return findCustomerMatchCandidates(
    {
      fullName: recovery.customerName,
      phone: recovery.phone,
      email: recovery.email,
      postcode: recovery.postcode,
    },
    customers,
  );
}

export function findBookingRecoveryJobCandidates(recovery: BookingRecoveryCase, jobs: JobWithRelations[], limit = 4) {
  const normalizedPostcode = recovery.postcode?.replace(/\s+/g, "").toUpperCase() ?? null;
  const nameTokens = recovery.customerName?.toLowerCase().split(/\s+/).filter((token) => token.length >= 3) ?? [];
  const phone = recovery.phone?.replace(/[^\d+]/g, "") ?? null;
  const service = recovery.service?.toLowerCase() ?? null;

  return jobs
    .map((job) => {
      const reasons: string[] = [];
      let score = 0;
      const jobPostcode = job.customer?.postcode?.replace(/\s+/g, "").toUpperCase() ?? job.site?.postcode?.replace(/\s+/g, "").toUpperCase() ?? null;
      const jobPhone = job.customer?.phone?.replace(/[^\d+]/g, "") ?? null;
      const jobName = job.customer?.full_name?.toLowerCase() ?? "";
      const jobTitle = job.title.toLowerCase();

      if (phone && jobPhone === phone) {
        score += 80;
        reasons.push("same phone");
      }
      if (normalizedPostcode && jobPostcode === normalizedPostcode) {
        score += 35;
        reasons.push("same postcode");
      }
      if (nameTokens.some((token) => jobName.includes(token))) {
        score += 25;
        reasons.push("similar customer");
      }
      if (service && jobTitle.includes(service)) {
        score += 15;
        reasons.push("similar work");
      }

      return { job, score, reasons };
    })
    .filter((candidate) => candidate.score >= 25)
    .sort((left, right) => right.score - left.score || left.job.title.localeCompare(right.job.title))
    .slice(0, limit);
}
