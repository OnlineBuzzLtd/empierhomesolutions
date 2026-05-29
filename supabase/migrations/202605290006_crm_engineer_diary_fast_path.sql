-- Engineer diary fast path.
-- Supports tenant-safe, exact engineer assignment lookup over the active diary
-- window used by getEngineerDashboardData.

create index if not exists crm_jobs_tenant_engineer_scheduled_idx
  on crm.jobs (tenant_id, assigned_engineer, scheduled_date, scheduled_time, created_at desc)
  where assigned_engineer is not null;
