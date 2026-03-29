alter table crm.leads
  add column if not exists intake_source text,
  add column if not exists submission_fingerprint text,
  add column if not exists submission_count integer not null default 1,
  add column if not exists first_submitted_at timestamptz,
  add column if not exists last_submitted_at timestamptz,
  add column if not exists possible_duplicate_customer_id uuid references crm.customers(id) on delete set null,
  add column if not exists matched_customer_confidence text,
  add column if not exists customer_match_result text,
  add column if not exists dedupe_result text;

update crm.leads
set intake_source = coalesce(intake_source, 'manual'),
    first_submitted_at = coalesce(first_submitted_at, created_at),
    last_submitted_at = coalesce(last_submitted_at, created_at),
    submission_count = coalesce(submission_count, 1),
    dedupe_result = coalesce(dedupe_result, 'created')
where intake_source is null
   or first_submitted_at is null
   or last_submitted_at is null
   or submission_count is null
   or dedupe_result is null;

create index if not exists crm_leads_submission_fingerprint_idx
  on crm.leads (tenant_id, submission_fingerprint, last_submitted_at desc);

create index if not exists crm_leads_possible_duplicate_customer_idx
  on crm.leads (possible_duplicate_customer_id);
