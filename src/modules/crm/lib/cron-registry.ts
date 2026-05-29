import type { SupabaseClient } from "@supabase/supabase-js";
import { dispatchDueNotifications } from "@/modules/crm/notifications/scheduler";
import { scheduleDueLeadChases } from "@/modules/crm/notifications/lead-chase";
import { scheduleDueInvoiceChases } from "@/modules/crm/notifications/invoice-chase";
import { scheduleDueLostLeadReengagements } from "@/modules/crm/notifications/lost-lead-reengagement";

export type CronJobContext = {
  supabase: SupabaseClient;
  now: Date;
};

export type CronJobResult = Record<string, unknown>;

export type CronJobDefinition = {
  name: string;
  cadenceMinutes: number;
  run: (context: CronJobContext) => Promise<CronJobResult>;
};

const jobs = new Map<string, CronJobDefinition>();

export function registerCronJob(job: CronJobDefinition) {
  jobs.set(job.name, job);
}

export function listCronJobs() {
  return [...jobs.values()];
}

export function clearCronJobsForTests() {
  jobs.clear();
}

export function getWindowStart(now: Date, cadenceMinutes: number) {
  const cadenceMs = cadenceMinutes * 60 * 1000;
  return new Date(Math.floor(now.getTime() / cadenceMs) * cadenceMs);
}

export async function claimCronDispatch(
  supabase: SupabaseClient,
  input: { jobName: string; windowStart: Date; tenantId?: string | null },
) {
  const idempotencyKey = [
    "cron",
    input.tenantId ?? "global",
    input.jobName,
    input.windowStart.toISOString(),
  ].join(":");
  const { data, error } = await supabase
    .schema("crm")
    .from("cron_dispatch_log")
    .insert({
      tenant_id: input.tenantId ?? null,
      job_name: input.jobName,
      window_start: input.windowStart.toISOString(),
      idempotency_key: idempotencyKey,
      status: "running",
    })
    .select("id")
    .single();

  if (error) {
    if ("code" in error && error.code === "23505") {
      return { claimed: false as const, id: null, idempotencyKey };
    }
    throw error;
  }

  return { claimed: true as const, id: String(data.id), idempotencyKey };
}

export async function finishCronDispatch(
  supabase: SupabaseClient,
  input: { id: string; status: "succeeded" | "failed"; result?: CronJobResult; error?: string | null },
) {
  const { error } = await supabase
    .schema("crm")
    .from("cron_dispatch_log")
    .update({
      status: input.status,
      result: input.result ?? {},
      last_error: input.error ?? null,
      finished_at: new Date().toISOString(),
    })
    .eq("id", input.id);
  if (error) {
    throw error;
  }
}

export async function runDueCronJobs(
  supabase: SupabaseClient,
  options: { now?: Date; onlyJob?: string | null } = {},
) {
  const now = options.now ?? new Date();
  const selectedJobs = listCronJobs().filter((job) => !options.onlyJob || job.name === options.onlyJob);
  const results = [];

  for (const job of selectedJobs) {
    const windowStart = getWindowStart(now, job.cadenceMinutes);
    const claim = await claimCronDispatch(supabase, { jobName: job.name, windowStart });
    if (!claim.claimed) {
      results.push({ job: job.name, status: "skipped", reason: "already_claimed" });
      continue;
    }

    try {
      const result = await job.run({ supabase, now });
      await finishCronDispatch(supabase, { id: claim.id, status: "succeeded", result });
      results.push({ job: job.name, status: "succeeded", result });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Cron job failed.";
      await finishCronDispatch(supabase, { id: claim.id, status: "failed", error: message });
      results.push({ job: job.name, status: "failed", error: message });
    }
  }

  return {
    attempted: selectedJobs.length,
    results,
  };
}

registerCronJob({
  name: "dispatch-notifications",
  cadenceMinutes: 5,
  run: async ({ supabase, now }) => dispatchDueNotifications(supabase, { now }),
});

registerCronJob({
  name: "schedule-lead-chases",
  cadenceMinutes: 60,
  run: async ({ supabase, now }) => scheduleDueLeadChases(supabase, { now }),
});

registerCronJob({
  name: "schedule-invoice-chases",
  cadenceMinutes: 60 * 24,
  run: async ({ supabase, now }) => scheduleDueInvoiceChases(supabase, { now }),
});

registerCronJob({
  name: "schedule-lost-lead-reengagements",
  cadenceMinutes: 60 * 24,
  run: async ({ supabase, now }) => scheduleDueLostLeadReengagements(supabase, { now }),
});
