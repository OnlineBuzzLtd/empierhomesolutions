-- Client feedback pass: EHS CRM logo and materials-used job report question.

update crm.tenant_branding
set logo_url = '/brands/ehs-logo.png'
where tenant_id = '11111111-1111-4111-8111-111111111111';

insert into crm.job_report_templates (tenant_id, title, position, is_active, is_demo)
select t.id, 'Materials used?', 50, true, false
from crm.tenants t
where not exists (
  select 1
  from crm.job_report_templates jrt
  where jrt.tenant_id = t.id
    and jrt.is_demo = false
    and lower(trim(jrt.title)) = 'materials used?'
);

insert into crm.job_checklists (tenant_id, job_id, title, status, is_mandatory, is_demo, demo_scenario_key)
select j.tenant_id, j.id, 'Materials used?', 'required', true, j.is_demo, j.demo_scenario_key
from crm.jobs j
where not exists (
  select 1
  from crm.job_checklists jc
  where jc.job_id = j.id
    and lower(trim(jc.title)) = 'materials used?'
);
