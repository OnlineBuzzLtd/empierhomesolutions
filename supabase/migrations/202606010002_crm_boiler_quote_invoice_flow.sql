-- Boiler install quoting + invoicing v1.
-- Additive only: preserves the current diary-first CRM workflow while making
-- survey visits, install quote terms, staged invoices, cooling-off consent,
-- and compliance closeout explicit records.

alter table crm.jobs
  add column if not exists visit_classification text not null default 'standard',
  add column if not exists commercial_stage text not null default 'booked';

alter table crm.jobs
  drop constraint if exists crm_jobs_visit_classification_check;

alter table crm.jobs
  add constraint crm_jobs_visit_classification_check
  check (visit_classification in (
    'standard',
    'survey_assessment',
    'install_work',
    'powerflush_work',
    'repair',
    'follow_up'
  ));

alter table crm.jobs
  drop constraint if exists crm_jobs_commercial_stage_check;

alter table crm.jobs
  add constraint crm_jobs_commercial_stage_check
  check (commercial_stage in (
    'booked',
    'survey_booked',
    'survey_done',
    'quote_draft',
    'quote_sent',
    'accepted',
    'deposit_due',
    'deposit_paid',
    'install_ready',
    'final_invoice_due',
    'closed'
  ));

alter table crm.appointments
  add column if not exists visit_classification text not null default 'standard';

alter table crm.appointments
  drop constraint if exists crm_appointments_visit_classification_check;

alter table crm.appointments
  add constraint crm_appointments_visit_classification_check
  check (visit_classification in (
    'standard',
    'survey_assessment',
    'install_work',
    'powerflush_work',
    'repair',
    'follow_up'
  ));

alter table crm.quotes
  add column if not exists install_scope jsonb not null default '{}'::jsonb,
  add column if not exists payment_terms jsonb not null default '{}'::jsonb,
  add column if not exists agent_autonomy jsonb not null default '{}'::jsonb;

alter table crm.quote_versions
  add column if not exists install_scope jsonb not null default '{}'::jsonb,
  add column if not exists payment_terms jsonb not null default '{}'::jsonb,
  add column if not exists agent_autonomy jsonb not null default '{}'::jsonb;

alter table crm.quote_acceptances
  add column if not exists acceptance_channel text,
  add column if not exists evidence_url text,
  add column if not exists evidence_attachment_id uuid;

alter table crm.invoices
  add column if not exists invoice_kind text not null default 'standard',
  add column if not exists invoice_schedule_id uuid references crm.invoice_schedules(id) on delete set null,
  add column if not exists balance_of_quote_id uuid references crm.quotes(id) on delete set null;

alter table crm.invoices
  drop constraint if exists crm_invoices_invoice_kind_check;

alter table crm.invoices
  add constraint crm_invoices_invoice_kind_check
  check (invoice_kind in ('standard', 'deposit', 'pro_forma', 'stage', 'final'));

create index if not exists crm_jobs_visit_classification_idx
  on crm.jobs (tenant_id, visit_classification, scheduled_date desc);

create index if not exists crm_appointments_visit_classification_idx
  on crm.appointments (tenant_id, visit_classification, starts_at desc);

create index if not exists crm_invoices_kind_job_idx
  on crm.invoices (tenant_id, job_id, invoice_kind, status);

create table if not exists crm.job_survey_assessments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default crm.current_user_tenant_id() references crm.tenants(id) on delete cascade,
  job_id uuid not null unique references crm.jobs(id) on delete cascade,
  boiler_type text,
  boiler_model text,
  flue_route text,
  gas_pipe_notes text,
  condensate_notes text,
  water_pressure_notes text,
  radiator_notes text,
  controls_notes text,
  access_notes text,
  parts_notes text,
  risk_notes text,
  engineer_notes text,
  status text not null default 'draft',
  completed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint crm_job_survey_assessments_status_check check (status in ('draft', 'completed'))
);

create table if not exists crm.job_cooling_off_consents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default crm.current_user_tenant_id() references crm.tenants(id) on delete cascade,
  job_id uuid not null unique references crm.jobs(id) on delete cascade,
  applies boolean not null default false,
  contract_channel text,
  expires_at timestamptz,
  early_start_consent_at timestamptz,
  consent_method text,
  evidence_url text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists crm.job_compliance_closeouts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default crm.current_user_tenant_id() references crm.tenants(id) on delete cascade,
  job_id uuid not null unique references crm.jobs(id) on delete cascade,
  commissioning_complete boolean not null default false,
  controls_handover_complete boolean not null default false,
  building_regs_notification_due_at timestamptz,
  building_regs_notified_at timestamptz,
  gas_safe_reference text,
  certificate_received_at timestamptz,
  certificate_sent_at timestamptz,
  evidence_url text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger crm_job_survey_assessments_set_updated_at
  before update on crm.job_survey_assessments
  for each row execute procedure crm.set_updated_at();

create trigger crm_job_cooling_off_consents_set_updated_at
  before update on crm.job_cooling_off_consents
  for each row execute procedure crm.set_updated_at();

create trigger crm_job_compliance_closeouts_set_updated_at
  before update on crm.job_compliance_closeouts
  for each row execute procedure crm.set_updated_at();

create index if not exists crm_job_survey_assessments_job_idx
  on crm.job_survey_assessments (tenant_id, job_id);

create index if not exists crm_job_cooling_off_consents_job_idx
  on crm.job_cooling_off_consents (tenant_id, job_id);

create index if not exists crm_job_compliance_closeouts_job_idx
  on crm.job_compliance_closeouts (tenant_id, job_id);

alter table crm.job_survey_assessments enable row level security;
alter table crm.job_cooling_off_consents enable row level security;
alter table crm.job_compliance_closeouts enable row level security;

create policy "crm_read_job_survey_assessments" on crm.job_survey_assessments
for select to authenticated using (crm.is_tenant_member(tenant_id));

create policy "crm_insert_job_survey_assessments" on crm.job_survey_assessments
for insert to authenticated with check (crm.is_tenant_member(tenant_id));

create policy "crm_update_job_survey_assessments" on crm.job_survey_assessments
for update to authenticated using (crm.is_tenant_member(tenant_id)) with check (crm.is_tenant_member(tenant_id));

create policy "crm_delete_job_survey_assessments" on crm.job_survey_assessments
for delete to authenticated using (crm.is_manager_or_admin(tenant_id));

create policy "crm_read_job_cooling_off_consents" on crm.job_cooling_off_consents
for select to authenticated using (crm.is_tenant_member(tenant_id));

create policy "crm_insert_job_cooling_off_consents" on crm.job_cooling_off_consents
for insert to authenticated with check (crm.is_tenant_member(tenant_id));

create policy "crm_update_job_cooling_off_consents" on crm.job_cooling_off_consents
for update to authenticated using (crm.is_tenant_member(tenant_id)) with check (crm.is_tenant_member(tenant_id));

create policy "crm_delete_job_cooling_off_consents" on crm.job_cooling_off_consents
for delete to authenticated using (crm.is_manager_or_admin(tenant_id));

create policy "crm_read_job_compliance_closeouts" on crm.job_compliance_closeouts
for select to authenticated using (crm.is_tenant_member(tenant_id));

create policy "crm_insert_job_compliance_closeouts" on crm.job_compliance_closeouts
for insert to authenticated with check (crm.is_tenant_member(tenant_id));

create policy "crm_update_job_compliance_closeouts" on crm.job_compliance_closeouts
for update to authenticated using (crm.is_tenant_member(tenant_id)) with check (crm.is_tenant_member(tenant_id));

create policy "crm_delete_job_compliance_closeouts" on crm.job_compliance_closeouts
for delete to authenticated using (crm.is_manager_or_admin(tenant_id));
