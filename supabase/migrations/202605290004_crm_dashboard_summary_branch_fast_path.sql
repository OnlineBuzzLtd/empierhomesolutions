-- Avoid generic CASE predicates inside the dashboard summary hot path.

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
      and l.status in ('new', 'contacted', 'follow_up')
      and coalesce(l.is_demo, false) = true
      and coalesce(l.demo_scenario_key, 'core-walkthrough') = coalesce(p_demo_scenario_key, 'core-walkthrough');
  else
    select count(*)
    into v_open_jobs
    from crm.jobs j
    where j.tenant_id = v_tenant_id
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
