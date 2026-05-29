-- Partial live-mode summary indexes for dashboard count/sum budgets.

create index if not exists crm_jobs_live_tenant_status_idx
  on crm.jobs (tenant_id, status)
  where coalesce(is_demo, false) = false;

create index if not exists crm_leads_live_tenant_status_idx
  on crm.leads (tenant_id, status)
  where coalesce(is_demo, false) = false;

create index if not exists crm_invoices_live_tenant_status_total_idx
  on crm.invoices (tenant_id, status) include (total)
  where coalesce(is_demo, false) = false;
