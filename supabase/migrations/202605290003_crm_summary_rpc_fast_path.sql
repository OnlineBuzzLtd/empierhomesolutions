-- Fast-path dashboard/report summaries.
-- These functions are tenant-scoped through crm.current_user_tenant_id(), but
-- run as SECURITY DEFINER to avoid per-row RLS membership checks while
-- aggregating large tenant histories.

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

  select count(*)
  into v_open_jobs
  from crm.jobs j
  where j.tenant_id = v_tenant_id
    and j.status in ('enquiry', 'booked', 'in_progress')
    and case
      when p_mode = 'demo' then coalesce(j.is_demo, false) = true
        and coalesce(j.demo_scenario_key, 'core-walkthrough') = coalesce(p_demo_scenario_key, 'core-walkthrough')
      else coalesce(j.is_demo, false) = false
    end;

  select coalesce(sum(coalesce(i.total, 0)), 0)
  into v_unpaid_total
  from crm.invoices i
  where i.tenant_id = v_tenant_id
    and i.status = 'unpaid'
    and case
      when p_mode = 'demo' then coalesce(i.is_demo, false) = true
        and coalesce(i.demo_scenario_key, 'core-walkthrough') = coalesce(p_demo_scenario_key, 'core-walkthrough')
      else coalesce(i.is_demo, false) = false
    end;

  select count(*)
  into v_new_leads
  from crm.leads l
  where l.tenant_id = v_tenant_id
    and l.status in ('new', 'contacted', 'follow_up')
    and case
      when p_mode = 'demo' then coalesce(l.is_demo, false) = true
        and coalesce(l.demo_scenario_key, 'core-walkthrough') = coalesce(p_demo_scenario_key, 'core-walkthrough')
      else coalesce(l.is_demo, false) = false
    end;

  return jsonb_build_object(
    'openJobsCount', coalesce(v_open_jobs, 0),
    'unpaidInvoicesTotal', coalesce(v_unpaid_total, 0),
    'newLeadCount', coalesce(v_new_leads, 0)
  );
end;
$$;

create or replace function crm.reports_summary(
  p_mode text default 'live',
  p_demo_scenario_key text default 'core-walkthrough'
)
returns jsonb
language sql
stable
security definer
set search_path = crm, public
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
    from crm.invoices i
    join tenant_scope t on t.tenant_id = i.tenant_id
    where t.tenant_id is not null
      and case
        when p_mode = 'demo' then coalesce(i.is_demo, false) = true
          and coalesce(i.demo_scenario_key, 'core-walkthrough') = coalesce(p_demo_scenario_key, 'core-walkthrough')
        else coalesce(i.is_demo, false) = false
      end
  ),
  lead_summary as (
    select
      count(*) as lead_count,
      count(*) filter (where l.status in ('accepted', 'booked', 'completed')) as converted_lead_count
    from crm.leads l
    join tenant_scope t on t.tenant_id = l.tenant_id
    where t.tenant_id is not null
      and case
        when p_mode = 'demo' then coalesce(l.is_demo, false) = true
          and coalesce(l.demo_scenario_key, 'core-walkthrough') = coalesce(p_demo_scenario_key, 'core-walkthrough')
        else coalesce(l.is_demo, false) = false
      end
  ),
  job_summary as (
    select
      count(*) as job_count,
      count(*) filter (where j.status in ('completed', 'invoiced')) as completed_job_count
    from crm.jobs j
    join tenant_scope t on t.tenant_id = j.tenant_id
    where t.tenant_id is not null
      and case
        when p_mode = 'demo' then coalesce(j.is_demo, false) = true
          and coalesce(j.demo_scenario_key, 'core-walkthrough') = coalesce(p_demo_scenario_key, 'core-walkthrough')
        else coalesce(j.is_demo, false) = false
      end
  ),
  expense_summary as (
    select coalesce(sum(coalesce(e.amount, 0)), 0) as total_expenses
    from crm.expenses e
    join tenant_scope t on t.tenant_id = e.tenant_id
    where t.tenant_id is not null
      and case
        when p_mode = 'demo' then coalesce(e.is_demo, false) = true
          and coalesce(e.demo_scenario_key, 'core-walkthrough') = coalesce(p_demo_scenario_key, 'core-walkthrough')
        else coalesce(e.is_demo, false) = false
      end
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
      from crm.jobs j
      join tenant_scope t on t.tenant_id = j.tenant_id
      where t.tenant_id is not null
        and case
          when p_mode = 'demo' then coalesce(j.is_demo, false) = true
            and coalesce(j.demo_scenario_key, 'core-walkthrough') = coalesce(p_demo_scenario_key, 'core-walkthrough')
          else coalesce(j.is_demo, false) = false
        end
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

revoke all on function crm.dashboard_summary(text, text) from public;
revoke all on function crm.reports_summary(text, text) from public;

grant execute on function crm.dashboard_summary(text, text) to authenticated;
grant execute on function crm.reports_summary(text, text) to authenticated;
