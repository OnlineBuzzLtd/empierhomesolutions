-- AI quote drafting + Demo Console commercial trail.
--
-- Additive only. The tenant flag defaults off so existing live tenants keep
-- today's diary-first workflow until quote drafting is explicitly enabled.

alter table crm.tenant_settings
  add column if not exists ai_quote_drafting_enabled boolean not null default false,
  add column if not exists ai_quote_drafting_mode text not null default 'off';

alter table crm.tenant_settings
  drop constraint if exists crm_tenant_settings_ai_quote_drafting_mode_check;

alter table crm.tenant_settings
  add constraint crm_tenant_settings_ai_quote_drafting_mode_check
  check (ai_quote_drafting_mode in (
    'off',
    'draft_after_survey',
    'draft_after_booking_and_survey'
  ));

-- Demo cleanup and realtime visibility need explicit is_test markers on the
-- commercial tables. is_demo already exists on some of these tables for the
-- canned walkthrough; is_test is the live in-person demo cleanup boundary.
alter table crm.quotes
  add column if not exists is_test boolean not null default false;

alter table crm.quote_versions
  add column if not exists is_test boolean not null default false;

alter table crm.quote_acceptances
  add column if not exists is_test boolean not null default false;

alter table crm.invoice_schedules
  add column if not exists is_test boolean not null default false;

alter table crm.invoices
  add column if not exists is_test boolean not null default false;

alter table crm.payments
  add column if not exists is_test boolean not null default false;

alter table crm.job_survey_assessments
  add column if not exists is_test boolean not null default false;

create index if not exists crm_quotes_is_test_partial
  on crm.quotes(is_test)
  where is_test = true;

create index if not exists crm_quote_versions_is_test_partial
  on crm.quote_versions(is_test)
  where is_test = true;

create index if not exists crm_quote_acceptances_is_test_partial
  on crm.quote_acceptances(is_test)
  where is_test = true;

create index if not exists crm_invoice_schedules_is_test_partial
  on crm.invoice_schedules(is_test)
  where is_test = true;

create index if not exists crm_invoices_is_test_partial
  on crm.invoices(is_test)
  where is_test = true;

create index if not exists crm_payments_is_test_partial
  on crm.payments(is_test)
  where is_test = true;

create index if not exists crm_job_survey_assessments_is_test_partial
  on crm.job_survey_assessments(is_test)
  where is_test = true;

do $$
declare
  target_tables text[] := array[
    'job_survey_assessments',
    'quotes',
    'quote_versions',
    'quote_acceptances',
    'invoice_schedules',
    'invoices',
    'payments'
  ];
  target_table text;
begin
  foreach target_table in array target_tables loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'crm'
         and tablename = target_table
    ) then
      execute format('alter publication supabase_realtime add table crm.%I', target_table);
    end if;
  end loop;
end $$;
