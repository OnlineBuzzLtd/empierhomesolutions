alter table crm.customers add column if not exists record_deleted_at timestamptz;
alter table crm.customers add column if not exists redacted_at timestamptz;
alter table crm.customers add column if not exists redacted_by uuid references auth.users(id) on delete set null;
alter table crm.customers add column if not exists redaction_reason text;

alter table crm.leads add column if not exists record_deleted_at timestamptz;
alter table crm.leads add column if not exists redacted_at timestamptz;
alter table crm.leads add column if not exists redacted_by uuid references auth.users(id) on delete set null;
alter table crm.leads add column if not exists redaction_reason text;

alter table crm.jobs add column if not exists record_deleted_at timestamptz;
alter table crm.jobs add column if not exists redacted_at timestamptz;
alter table crm.jobs add column if not exists redacted_by uuid references auth.users(id) on delete set null;
alter table crm.jobs add column if not exists redaction_reason text;

alter table crm.quotes add column if not exists redacted_at timestamptz;
alter table crm.quotes add column if not exists redacted_by uuid references auth.users(id) on delete set null;
alter table crm.quotes add column if not exists redaction_reason text;

alter table crm.quote_versions add column if not exists redacted_at timestamptz;
alter table crm.quote_versions add column if not exists redacted_by uuid references auth.users(id) on delete set null;
alter table crm.quote_versions add column if not exists redaction_reason text;

alter table crm.quote_acceptances add column if not exists redacted_at timestamptz;
alter table crm.quote_acceptances add column if not exists redacted_by uuid references auth.users(id) on delete set null;
alter table crm.quote_acceptances add column if not exists redaction_reason text;

alter table crm.invoices add column if not exists redacted_at timestamptz;
alter table crm.invoices add column if not exists redacted_by uuid references auth.users(id) on delete set null;
alter table crm.invoices add column if not exists redaction_reason text;

alter table crm.payments add column if not exists redacted_at timestamptz;
alter table crm.payments add column if not exists redacted_by uuid references auth.users(id) on delete set null;
alter table crm.payments add column if not exists redaction_reason text;

create table if not exists crm.deletion_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references crm.tenants(id) on delete cascade,
  requested_by uuid references auth.users(id) on delete set null,
  root_type text not null check (root_type in ('customer', 'job', 'lead', 'appointment', 'ai_recovery_case')),
  root_id text not null,
  mode text not null default 'compliance_safe' check (mode = 'compliance_safe'),
  reason text not null,
  confirmation_phrase text not null,
  plan_hash text not null,
  preview_counts jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'completed', 'completed_with_storage_warnings', 'failed')),
  error text,
  created_at timestamptz not null default timezone('utc', now()),
  executed_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists crm.deletion_storage_tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references crm.tenants(id) on delete cascade,
  deletion_request_id uuid references crm.deletion_requests(id) on delete cascade,
  bucket text not null default 'crm-uploads',
  object_path text not null,
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  created_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, bucket, object_path, deletion_request_id)
);

create trigger crm_deletion_requests_set_updated_at
before update on crm.deletion_requests
for each row execute procedure crm.set_updated_at();

create trigger crm_deletion_storage_tasks_set_updated_at
before update on crm.deletion_storage_tasks
for each row execute procedure crm.set_updated_at();

create index if not exists crm_deletion_requests_tenant_created_idx
  on crm.deletion_requests (tenant_id, created_at desc);

create index if not exists crm_deletion_storage_tasks_pending_idx
  on crm.deletion_storage_tasks (tenant_id, status, created_at asc)
  where status in ('pending', 'failed');

create index if not exists crm_customers_record_deleted_idx
  on crm.customers (tenant_id, record_deleted_at)
  where record_deleted_at is null;

create index if not exists crm_leads_record_deleted_idx
  on crm.leads (tenant_id, record_deleted_at)
  where record_deleted_at is null;

create index if not exists crm_jobs_record_deleted_idx
  on crm.jobs (tenant_id, record_deleted_at)
  where record_deleted_at is null;

alter table crm.deletion_requests enable row level security;
alter table crm.deletion_storage_tasks enable row level security;

create policy "crm_read_deletion_requests" on crm.deletion_requests
for select to authenticated
using (crm.is_manager_or_admin(tenant_id));

create policy "crm_insert_deletion_requests" on crm.deletion_requests
for insert to authenticated
with check (crm.is_manager_or_admin(tenant_id));

create policy "crm_update_deletion_requests" on crm.deletion_requests
for update to authenticated
using (crm.is_manager_or_admin(tenant_id))
with check (crm.is_manager_or_admin(tenant_id));

create policy "crm_read_deletion_storage_tasks" on crm.deletion_storage_tasks
for select to authenticated
using (crm.is_manager_or_admin(tenant_id));

create policy "crm_insert_deletion_storage_tasks" on crm.deletion_storage_tasks
for insert to authenticated
with check (crm.is_manager_or_admin(tenant_id));

create policy "crm_update_deletion_storage_tasks" on crm.deletion_storage_tasks
for update to authenticated
using (crm.is_manager_or_admin(tenant_id))
with check (crm.is_manager_or_admin(tenant_id));

create or replace function crm.dashboard_summary(
  p_mode text default 'live',
  p_demo_scenario_key text default 'core-walkthrough'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = crm, public
as $$
declare
  v_tenant_id uuid := crm.current_user_tenant_id();
  v_open_jobs bigint := 0;
  v_unpaid_total numeric := 0;
  v_new_leads bigint := 0;
begin
  if v_tenant_id is null then
    return jsonb_build_object(
      'openJobsCount', 0,
      'unpaidInvoicesTotal', 0,
      'newLeadCount', 0
    );
  end if;

  if p_mode = 'demo' then
    select count(*)
    into v_open_jobs
    from crm.jobs j
    where j.tenant_id = v_tenant_id
      and j.record_deleted_at is null
      and j.status in ('enquiry', 'booked', 'in_progress')
      and coalesce(j.is_demo, false) = true
      and coalesce(j.demo_scenario_key, 'core-walkthrough') = coalesce(p_demo_scenario_key, 'core-walkthrough');

    select coalesce(sum(coalesce(i.total, 0)), 0)
    into v_unpaid_total
    from crm.invoices i
    where i.tenant_id = v_tenant_id
      and i.status = 'unpaid'
      and coalesce(i.is_demo, false) = true
      and coalesce(i.demo_scenario_key, 'core-walkthrough') = coalesce(p_demo_scenario_key, 'core-walkthrough');

    select count(*)
    into v_new_leads
    from crm.leads l
    where l.tenant_id = v_tenant_id
      and l.record_deleted_at is null
      and l.status in ('new', 'contacted', 'follow_up')
      and coalesce(l.is_demo, false) = true
      and coalesce(l.demo_scenario_key, 'core-walkthrough') = coalesce(p_demo_scenario_key, 'core-walkthrough');
  else
    select count(*)
    into v_open_jobs
    from crm.jobs j
    where j.tenant_id = v_tenant_id
      and j.record_deleted_at is null
      and j.status in ('enquiry', 'booked', 'in_progress')
      and coalesce(j.is_demo, false) = false;

    select coalesce(sum(coalesce(i.total, 0)), 0)
    into v_unpaid_total
    from crm.invoices i
    where i.tenant_id = v_tenant_id
      and i.status = 'unpaid'
      and coalesce(i.is_demo, false) = false;

    select count(*)
    into v_new_leads
    from crm.leads l
    where l.tenant_id = v_tenant_id
      and l.record_deleted_at is null
      and l.status in ('new', 'contacted', 'follow_up')
      and coalesce(l.is_demo, false) = false;
  end if;

  return jsonb_build_object(
    'openJobsCount', coalesce(v_open_jobs, 0),
    'unpaidInvoicesTotal', coalesce(v_unpaid_total, 0),
    'newLeadCount', coalesce(v_new_leads, 0)
  );
end;
$$;

grant execute on function crm.dashboard_summary(text, text) to authenticated;

create or replace function crm.reports_summary(
  p_mode text default 'live',
  p_demo_scenario_key text default 'core-walkthrough'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = crm, public
as $$
declare
  v_tenant_id uuid := crm.current_user_tenant_id();
  v_total_revenue numeric := 0;
  v_unpaid_revenue numeric := 0;
  v_invoice_count bigint := 0;
  v_paid_invoice_count bigint := 0;
  v_lead_count bigint := 0;
  v_converted_lead_count bigint := 0;
  v_job_count bigint := 0;
  v_completed_job_count bigint := 0;
  v_total_expenses numeric := 0;
  v_engineer_workload jsonb := '[]'::jsonb;
begin
  if v_tenant_id is null then
    return jsonb_build_object(
      'totalRevenue', 0,
      'unpaidRevenue', 0,
      'invoiceCount', 0,
      'paidInvoiceCount', 0,
      'leadCount', 0,
      'convertedLeadCount', 0,
      'jobCount', 0,
      'completedJobCount', 0,
      'totalExpenses', 0,
      'profitEstimate', 0,
      'engineerWorkload', '[]'::jsonb
    );
  end if;

  if p_mode = 'demo' then
    select
      coalesce(sum(coalesce(i.total, 0)), 0),
      coalesce(sum(coalesce(i.total, 0)) filter (where i.status in ('unpaid', 'overdue')), 0),
      count(*),
      count(*) filter (where i.status = 'paid')
    into v_total_revenue, v_unpaid_revenue, v_invoice_count, v_paid_invoice_count
    from crm.invoices i
    where i.tenant_id = v_tenant_id
      and coalesce(i.is_demo, false) = true
      and coalesce(i.demo_scenario_key, 'core-walkthrough') = coalesce(p_demo_scenario_key, 'core-walkthrough');

    select count(*), count(*) filter (where l.status in ('accepted', 'booked', 'completed'))
    into v_lead_count, v_converted_lead_count
    from crm.leads l
    where l.tenant_id = v_tenant_id
      and l.record_deleted_at is null
      and coalesce(l.is_demo, false) = true
      and coalesce(l.demo_scenario_key, 'core-walkthrough') = coalesce(p_demo_scenario_key, 'core-walkthrough');

    select count(*), count(*) filter (where j.status in ('completed', 'invoiced'))
    into v_job_count, v_completed_job_count
    from crm.jobs j
    where j.tenant_id = v_tenant_id
      and j.record_deleted_at is null
      and coalesce(j.is_demo, false) = true
      and coalesce(j.demo_scenario_key, 'core-walkthrough') = coalesce(p_demo_scenario_key, 'core-walkthrough');

    select coalesce(sum(coalesce(e.amount, 0)), 0)
    into v_total_expenses
    from crm.expenses e
    where e.tenant_id = v_tenant_id
      and coalesce(e.is_demo, false) = true
      and coalesce(e.demo_scenario_key, 'core-walkthrough') = coalesce(p_demo_scenario_key, 'core-walkthrough');

    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'engineer', engineer,
          'totalJobs', total_jobs,
          'completedJobs', completed_jobs,
          'openJobs', open_jobs
        )
        order by total_jobs desc, engineer asc
      ),
      '[]'::jsonb
    )
    into v_engineer_workload
    from (
      select
        coalesce(nullif(j.assigned_engineer, ''), 'Unassigned') as engineer,
        count(*) as total_jobs,
        count(*) filter (where j.status in ('completed', 'invoiced')) as completed_jobs,
        count(*) filter (where j.status in ('enquiry', 'booked', 'in_progress')) as open_jobs
      from crm.jobs j
      where j.tenant_id = v_tenant_id
        and j.record_deleted_at is null
        and coalesce(j.is_demo, false) = true
        and coalesce(j.demo_scenario_key, 'core-walkthrough') = coalesce(p_demo_scenario_key, 'core-walkthrough')
      group by coalesce(nullif(j.assigned_engineer, ''), 'Unassigned')
    ) workload;
  else
    select
      coalesce(sum(coalesce(i.total, 0)), 0),
      coalesce(sum(coalesce(i.total, 0)) filter (where i.status in ('unpaid', 'overdue')), 0),
      count(*),
      count(*) filter (where i.status = 'paid')
    into v_total_revenue, v_unpaid_revenue, v_invoice_count, v_paid_invoice_count
    from crm.invoices i
    where i.tenant_id = v_tenant_id
      and coalesce(i.is_demo, false) = false;

    select count(*), count(*) filter (where l.status in ('accepted', 'booked', 'completed'))
    into v_lead_count, v_converted_lead_count
    from crm.leads l
    where l.tenant_id = v_tenant_id
      and l.record_deleted_at is null
      and coalesce(l.is_demo, false) = false;

    select count(*), count(*) filter (where j.status in ('completed', 'invoiced'))
    into v_job_count, v_completed_job_count
    from crm.jobs j
    where j.tenant_id = v_tenant_id
      and j.record_deleted_at is null
      and coalesce(j.is_demo, false) = false;

    select coalesce(sum(coalesce(e.amount, 0)), 0)
    into v_total_expenses
    from crm.expenses e
    where e.tenant_id = v_tenant_id
      and coalesce(e.is_demo, false) = false;

    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'engineer', engineer,
          'totalJobs', total_jobs,
          'completedJobs', completed_jobs,
          'openJobs', open_jobs
        )
        order by total_jobs desc, engineer asc
      ),
      '[]'::jsonb
    )
    into v_engineer_workload
    from (
      select
        coalesce(nullif(j.assigned_engineer, ''), 'Unassigned') as engineer,
        count(*) as total_jobs,
        count(*) filter (where j.status in ('completed', 'invoiced')) as completed_jobs,
        count(*) filter (where j.status in ('enquiry', 'booked', 'in_progress')) as open_jobs
      from crm.jobs j
      where j.tenant_id = v_tenant_id
        and j.record_deleted_at is null
        and coalesce(j.is_demo, false) = false
      group by coalesce(nullif(j.assigned_engineer, ''), 'Unassigned')
    ) workload;
  end if;

  return jsonb_build_object(
    'totalRevenue', coalesce(v_total_revenue, 0),
    'unpaidRevenue', coalesce(v_unpaid_revenue, 0),
    'invoiceCount', coalesce(v_invoice_count, 0),
    'paidInvoiceCount', coalesce(v_paid_invoice_count, 0),
    'leadCount', coalesce(v_lead_count, 0),
    'convertedLeadCount', coalesce(v_converted_lead_count, 0),
    'jobCount', coalesce(v_job_count, 0),
    'completedJobCount', coalesce(v_completed_job_count, 0),
    'totalExpenses', coalesce(v_total_expenses, 0),
    'profitEstimate', coalesce(v_total_revenue, 0) - coalesce(v_total_expenses, 0),
    'engineerWorkload', coalesce(v_engineer_workload, '[]'::jsonb)
  );
end;
$$;

grant execute on function crm.reports_summary(text, text) to authenticated;
