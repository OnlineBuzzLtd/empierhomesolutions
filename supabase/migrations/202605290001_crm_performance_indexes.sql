-- Tenantized CRM performance indexes.
-- Additive only: these support hot list/detail/calendar access patterns without
-- changing RLS, table contracts, or existing data.

create index if not exists crm_leads_tenant_status_created_idx
  on crm.leads (tenant_id, status, created_at desc);

create index if not exists crm_leads_tenant_created_idx
  on crm.leads (tenant_id, created_at desc);

create index if not exists crm_customers_tenant_archived_created_idx
  on crm.customers (tenant_id, archived, created_at desc);

create index if not exists crm_jobs_tenant_status_created_idx
  on crm.jobs (tenant_id, status, created_at desc);

create index if not exists crm_jobs_tenant_scheduled_idx
  on crm.jobs (tenant_id, scheduled_date desc, scheduled_time asc);

create index if not exists crm_appointments_tenant_starts_status_idx
  on crm.appointments (tenant_id, starts_at, status);

create index if not exists crm_quotes_tenant_status_created_idx
  on crm.quotes (tenant_id, status, created_at desc);

create index if not exists crm_invoices_tenant_status_created_idx
  on crm.invoices (tenant_id, status, created_at desc);

create index if not exists crm_notes_tenant_entity_created_idx
  on crm.notes (tenant_id, entity_type, entity_id, created_at desc);

create index if not exists crm_attachments_tenant_entity_created_idx
  on crm.attachments (tenant_id, entity_type, entity_id, created_at desc);

create index if not exists crm_job_assignees_tenant_job_idx
  on crm.job_assignees (tenant_id, job_id);

create index if not exists crm_job_assignees_tenant_user_idx
  on crm.job_assignees (tenant_id, user_profile_id);

create index if not exists crm_customer_assets_tenant_service_due_idx
  on crm.customer_assets (tenant_id, service_due_date)
  where service_due_date is not null;

create index if not exists crm_customer_assets_tenant_warranty_end_idx
  on crm.customer_assets (tenant_id, warranty_end_date)
  where warranty_end_date is not null;

create or replace function crm.matches_crm_mode(
  p_is_demo boolean,
  p_demo_scenario_key text,
  p_mode text,
  p_requested_scenario_key text
)
returns boolean
language sql
stable
as $$
  select case
    when p_mode = 'demo' then coalesce(p_is_demo, false) = true
      and coalesce(p_demo_scenario_key, 'core-walkthrough') = coalesce(p_requested_scenario_key, 'core-walkthrough')
    else coalesce(p_is_demo, false) = false
  end;
$$;

create or replace function crm.dashboard_summary(
  p_mode text default 'live',
  p_demo_scenario_key text default 'core-walkthrough'
)
returns jsonb
language sql
stable
as $$
  with tenant_scope as (
    select crm.current_user_tenant_id() as tenant_id
  )
  select jsonb_build_object(
    'openJobsCount', coalesce((
      select count(*)
      from crm.jobs j, tenant_scope t
      where j.tenant_id = t.tenant_id
        and j.status in ('enquiry', 'booked', 'in_progress')
        and crm.matches_crm_mode(j.is_demo, j.demo_scenario_key, p_mode, p_demo_scenario_key)
    ), 0),
    'unpaidInvoicesTotal', coalesce((
      select sum(coalesce(i.total, 0))
      from crm.invoices i, tenant_scope t
      where i.tenant_id = t.tenant_id
        and i.status = 'unpaid'
        and crm.matches_crm_mode(i.is_demo, i.demo_scenario_key, p_mode, p_demo_scenario_key)
    ), 0),
    'newLeadCount', coalesce((
      select count(*)
      from crm.leads l, tenant_scope t
      where l.tenant_id = t.tenant_id
        and l.status in ('new', 'contacted', 'follow_up')
        and crm.matches_crm_mode(l.is_demo, l.demo_scenario_key, p_mode, p_demo_scenario_key)
    ), 0)
  );
$$;

create or replace function crm.reports_summary(
  p_mode text default 'live',
  p_demo_scenario_key text default 'core-walkthrough'
)
returns jsonb
language sql
stable
as $$
  with tenant_scope as (
    select crm.current_user_tenant_id() as tenant_id
  ),
  invoice_summary as (
    select
      coalesce(sum(coalesce(i.total, 0)), 0) as total_revenue,
      coalesce(sum(coalesce(i.total, 0)) filter (where i.status in ('unpaid', 'overdue')), 0) as unpaid_revenue,
      count(*) as invoice_count,
      count(*) filter (where i.status = 'paid') as paid_invoice_count
    from crm.invoices i, tenant_scope t
    where i.tenant_id = t.tenant_id
      and crm.matches_crm_mode(i.is_demo, i.demo_scenario_key, p_mode, p_demo_scenario_key)
  ),
  lead_summary as (
    select
      count(*) as lead_count,
      count(*) filter (where l.status in ('accepted', 'booked', 'completed')) as converted_lead_count
    from crm.leads l, tenant_scope t
    where l.tenant_id = t.tenant_id
      and crm.matches_crm_mode(l.is_demo, l.demo_scenario_key, p_mode, p_demo_scenario_key)
  ),
  job_summary as (
    select
      count(*) as job_count,
      count(*) filter (where j.status in ('completed', 'invoiced')) as completed_job_count
    from crm.jobs j, tenant_scope t
    where j.tenant_id = t.tenant_id
      and crm.matches_crm_mode(j.is_demo, j.demo_scenario_key, p_mode, p_demo_scenario_key)
  ),
  expense_summary as (
    select coalesce(sum(coalesce(e.amount, 0)), 0) as total_expenses
    from crm.expenses e, tenant_scope t
    where e.tenant_id = t.tenant_id
      and crm.matches_crm_mode(e.is_demo, e.demo_scenario_key, p_mode, p_demo_scenario_key)
  ),
  engineer_summary as (
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
    ) as engineer_workload
    from (
      select
        coalesce(nullif(j.assigned_engineer, ''), 'Unassigned') as engineer,
        count(*) as total_jobs,
        count(*) filter (where j.status in ('completed', 'invoiced')) as completed_jobs,
        count(*) filter (where j.status in ('enquiry', 'booked', 'in_progress')) as open_jobs
      from crm.jobs j, tenant_scope t
      where j.tenant_id = t.tenant_id
        and crm.matches_crm_mode(j.is_demo, j.demo_scenario_key, p_mode, p_demo_scenario_key)
      group by coalesce(nullif(j.assigned_engineer, ''), 'Unassigned')
    ) workload
  )
  select jsonb_build_object(
    'totalRevenue', invoice_summary.total_revenue,
    'unpaidRevenue', invoice_summary.unpaid_revenue,
    'invoiceCount', invoice_summary.invoice_count,
    'paidInvoiceCount', invoice_summary.paid_invoice_count,
    'leadCount', lead_summary.lead_count,
    'convertedLeadCount', lead_summary.converted_lead_count,
    'jobCount', job_summary.job_count,
    'completedJobCount', job_summary.completed_job_count,
    'totalExpenses', expense_summary.total_expenses,
    'profitEstimate', invoice_summary.total_revenue - expense_summary.total_expenses,
    'engineerWorkload', engineer_summary.engineer_workload
  )
  from invoice_summary, lead_summary, job_summary, expense_summary, engineer_summary;
$$;

revoke all on function crm.matches_crm_mode(boolean, text, text, text) from public;
revoke all on function crm.dashboard_summary(text, text) from public;
revoke all on function crm.reports_summary(text, text) from public;

grant execute on function crm.matches_crm_mode(boolean, text, text, text) to authenticated;
grant execute on function crm.dashboard_summary(text, text) to authenticated;
grant execute on function crm.reports_summary(text, text) to authenticated;
