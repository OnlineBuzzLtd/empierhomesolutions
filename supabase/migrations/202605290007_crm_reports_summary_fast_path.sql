-- Reports summary fast path.
-- Validates the caller's active tenant once, then aggregates by tenant directly
-- so large tenants do not pay row-by-row RLS membership checks in reports.

create index if not exists crm_invoices_live_tenant_summary_idx
  on crm.invoices (tenant_id) include (status, total)
  where coalesce(is_demo, false) = false;

create index if not exists crm_jobs_live_tenant_summary_idx
  on crm.jobs (tenant_id, status, assigned_engineer)
  where coalesce(is_demo, false) = false;

create index if not exists crm_expenses_live_tenant_summary_idx
  on crm.expenses (tenant_id) include (amount)
  where coalesce(is_demo, false) = false;

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
      and coalesce(l.is_demo, false) = true
      and coalesce(l.demo_scenario_key, 'core-walkthrough') = coalesce(p_demo_scenario_key, 'core-walkthrough');

    select count(*), count(*) filter (where j.status in ('completed', 'invoiced'))
    into v_job_count, v_completed_job_count
    from crm.jobs j
    where j.tenant_id = v_tenant_id
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
      and coalesce(l.is_demo, false) = false;

    select count(*), count(*) filter (where j.status in ('completed', 'invoiced'))
    into v_job_count, v_completed_job_count
    from crm.jobs j
    where j.tenant_id = v_tenant_id
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
