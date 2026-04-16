-- Job report templates: tenant-scoped default mandatory questions
-- auto-inserted into every new job via trigger

create table if not exists crm.job_report_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references crm.tenants(id) on delete cascade,
  title text not null,
  position int not null default 0,
  is_active boolean not null default true,
  is_demo boolean not null default false,
  demo_scenario_key text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger crm_job_report_templates_set_updated_at
  before update on crm.job_report_templates
  for each row execute procedure crm.set_updated_at();

create index if not exists crm_job_report_templates_tenant_pos_idx
  on crm.job_report_templates (tenant_id, position asc);

create index if not exists crm_job_report_templates_demo_idx
  on crm.job_report_templates (is_demo, demo_scenario_key);

alter table crm.job_report_templates enable row level security;

create policy "crm_read_job_report_templates"
  on crm.job_report_templates for select to authenticated
  using (crm.is_tenant_member(tenant_id));

create policy "crm_insert_job_report_templates"
  on crm.job_report_templates for insert to authenticated
  with check (crm.is_manager_or_admin(tenant_id));

create policy "crm_update_job_report_templates"
  on crm.job_report_templates for update to authenticated
  using (crm.is_manager_or_admin(tenant_id))
  with check (crm.is_manager_or_admin(tenant_id));

create policy "crm_delete_job_report_templates"
  on crm.job_report_templates for delete to authenticated
  using (crm.is_manager_or_admin(tenant_id));

-- ── Auto-insert trigger ─────────────────────────────────────────────────────
-- Fires after every job insert; copies the tenant's active templates as
-- mandatory checklists so every job always has a job report to fill in.

create or replace function crm.auto_insert_job_report_questions()
returns trigger language plpgsql security definer as $$
begin
  insert into crm.job_checklists
    (tenant_id, job_id, title, status, is_mandatory, is_demo, demo_scenario_key)
  select
    new.tenant_id,
    new.id,
    jrt.title,
    'required',
    true,
    new.is_demo,
    new.demo_scenario_key
  from crm.job_report_templates jrt
  where jrt.tenant_id = new.tenant_id
    and jrt.is_active = true
    and jrt.is_demo = new.is_demo
  order by jrt.position asc;
  return new;
end;
$$;

create trigger crm_jobs_auto_insert_report_questions
  after insert on crm.jobs
  for each row execute function crm.auto_insert_job_report_questions();

-- ── Seed default questions for existing tenants ─────────────────────────────

insert into crm.job_report_templates (tenant_id, title, position, is_active, is_demo)
select t.id, q.title, q.position, true, false
from crm.tenants t
cross join (values
  (1, 'What work was carried out on site?'),
  (2, 'Were any parts fitted? If yes, please list them.'),
  (3, 'Is any follow-up work required?'),
  (4, 'Did the customer confirm satisfaction with the work?')
) as q(position, title)
on conflict do nothing;

-- ── Backfill existing live jobs that have no mandatory checklists ────────────
-- For each job with no is_mandatory checklist, insert the tenant defaults.

insert into crm.job_checklists
  (tenant_id, job_id, title, status, is_mandatory, is_demo, demo_scenario_key)
select
  j.tenant_id,
  j.id,
  jrt.title,
  'required',
  true,
  false,
  null
from crm.jobs j
join crm.job_report_templates jrt
  on jrt.tenant_id = j.tenant_id
  and jrt.is_active = true
  and jrt.is_demo = false
where j.is_demo = false
  and not exists (
    select 1
    from crm.job_checklists jc
    where jc.job_id = j.id
      and jc.is_mandatory = true
  )
order by j.created_at asc, jrt.position asc;
