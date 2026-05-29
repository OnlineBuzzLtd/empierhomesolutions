-- Hot list follow-up indexes.
-- The first performance index pack covered status-filtered and scheduled
-- access. These support the default newest-first CRM inbox lists.

create index if not exists crm_jobs_tenant_created_idx
  on crm.jobs (tenant_id, created_at desc);

create index if not exists crm_quotes_tenant_created_idx
  on crm.quotes (tenant_id, created_at desc);

create index if not exists crm_invoices_tenant_created_idx
  on crm.invoices (tenant_id, created_at desc);

create index if not exists crm_jobs_tenant_customer_idx
  on crm.jobs (tenant_id, customer_id);
