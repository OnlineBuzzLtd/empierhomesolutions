import type { EngineerDashboardData, EngineerDashboardJob } from "@/modules/crm/types";

const openJobStatuses = new Set(["enquiry", "booked", "in_progress"]);
const completedVisibleStatuses = new Set(["completed", "invoiced", "no_access", "aborted"]);

function compareScheduledJobs(a: EngineerDashboardJob, b: EngineerDashboardJob) {
  const dateA = a.scheduled_date ?? "9999-12-31";
  const dateB = b.scheduled_date ?? "9999-12-31";
  if (dateA !== dateB) {
    return dateA.localeCompare(dateB);
  }

  const timeA = a.scheduled_time ?? "23:59:59";
  const timeB = b.scheduled_time ?? "23:59:59";
  return timeA.localeCompare(timeB);
}

export function summarizeEngineerDashboardJobs(
  jobs: EngineerDashboardJob[],
  todayDate: string,
): EngineerDashboardData {
  const todaysAssignedJobs = jobs
    .filter((job) => job.scheduled_date === todayDate && openJobStatuses.has(job.status))
    .sort(compareScheduledJobs);
  const overdueAssignedJobs = jobs
    .filter((job) => job.scheduled_date && job.scheduled_date < todayDate && openJobStatuses.has(job.status))
    .sort(compareScheduledJobs);
  const upcomingAssignedJobs = jobs
    .filter((job) => job.scheduled_date && job.scheduled_date > todayDate && openJobStatuses.has(job.status))
    .sort(compareScheduledJobs);
  const readyJobs = jobs
    .filter((job) => {
      if (!openJobStatuses.has(job.status)) {
        return false;
      }
      return (
        job.scheduled_date === todayDate || Boolean(job.scheduled_date && job.scheduled_date < todayDate)
      );
    })
    .sort(compareScheduledJobs);
  const completedAssignedJobs = jobs
    .filter((job) => completedVisibleStatuses.has(job.status))
    .sort((a, b) => {
      const dateA = a.scheduled_date ?? a.updated_at.slice(0, 10);
      const dateB = b.scheduled_date ?? b.updated_at.slice(0, 10);
      if (dateA !== dateB) {
        return dateB.localeCompare(dateA);
      }
      return (b.scheduled_time ?? "23:59:59").localeCompare(a.scheduled_time ?? "23:59:59");
    });

  const nextAssignedJob =
    readyJobs[0] ??
    todaysAssignedJobs.find((job) => openJobStatuses.has(job.status)) ??
    todaysAssignedJobs[0] ??
    upcomingAssignedJobs[0] ??
    null;
  const outstandingJobs = readyJobs.length > 0 ? readyJobs : todaysAssignedJobs;

  return {
    nextAssignedJob,
    todaysAssignedJobs,
    overdueAssignedJobs,
    readyJobs,
    upcomingAssignedJobs,
    completedAssignedJobs,
    fieldTaskCounts: {
      missingNotes: outstandingJobs.filter((job) => job.missingNote).length,
      missingPhotos: outstandingJobs.filter((job) => job.missingPhoto).length,
      missingRequiredDocuments: outstandingJobs.filter((job) => job.missingRequiredDocument).length,
      overdueJobs: overdueAssignedJobs.length,
    },
  };
}
