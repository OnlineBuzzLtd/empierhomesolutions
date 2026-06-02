alter table crm.packages
  add column if not exists job_type_id uuid references crm.job_types(id) on delete set null,
  add column if not exists ai_pricing_style text not null default 'from';

alter table crm.packages
  drop constraint if exists crm_packages_ai_pricing_style_check;

alter table crm.packages
  add constraint crm_packages_ai_pricing_style_check
  check (ai_pricing_style in ('from', 'fixed'));

create index if not exists crm_packages_tenant_service_job_type_idx
  on crm.packages (tenant_id, service_id, job_type_id, is_active, ai_visible);
