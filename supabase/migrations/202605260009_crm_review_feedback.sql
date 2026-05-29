alter table crm.tenant_settings
  add column if not exists review_google_place_id text,
  add column if not exists review_trustpilot_url text,
  add column if not exists review_facebook_url text,
  add column if not exists review_primary_platform text not null default 'none',
  add column if not exists review_requests_enabled boolean not null default false;

alter table crm.tenant_settings
  drop constraint if exists crm_tenant_settings_review_primary_platform_check;

alter table crm.tenant_settings
  add constraint crm_tenant_settings_review_primary_platform_check
  check (review_primary_platform in ('none', 'google', 'trustpilot', 'facebook'));

create table if not exists crm.feedback_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references crm.tenants(id) on delete cascade,
  customer_id uuid references crm.customers(id) on delete set null,
  job_id uuid references crm.jobs(id) on delete set null,
  channel text not null default 'mixed' check (channel in ('sms', 'email', 'mixed')),
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists crm.feedback_responses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references crm.tenants(id) on delete cascade,
  request_id uuid not null unique references crm.feedback_requests(id) on delete cascade,
  customer_id uuid references crm.customers(id) on delete set null,
  job_id uuid references crm.jobs(id) on delete set null,
  score integer not null check (score between 1 and 5),
  comment text,
  redirect_url text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists crm_feedback_requests_job_idx
  on crm.feedback_requests (tenant_id, job_id, created_at desc);

create index if not exists crm_feedback_responses_score_idx
  on crm.feedback_responses (tenant_id, score, created_at desc);

alter table crm.feedback_requests enable row level security;
alter table crm.feedback_responses enable row level security;

drop policy if exists "crm_read_feedback_requests" on crm.feedback_requests;
drop policy if exists "crm_manage_feedback_requests" on crm.feedback_requests;
drop policy if exists "crm_read_feedback_responses" on crm.feedback_responses;
drop policy if exists "crm_manage_feedback_responses" on crm.feedback_responses;

create policy "crm_read_feedback_requests" on crm.feedback_requests
  for select to authenticated
  using (tenant_id = crm.current_user_tenant_id());

create policy "crm_manage_feedback_requests" on crm.feedback_requests
  for all to authenticated
  using (tenant_id = crm.current_user_tenant_id())
  with check (tenant_id = crm.current_user_tenant_id());

create policy "crm_read_feedback_responses" on crm.feedback_responses
  for select to authenticated
  using (tenant_id = crm.current_user_tenant_id());

create policy "crm_manage_feedback_responses" on crm.feedback_responses
  for all to authenticated
  using (tenant_id = crm.current_user_tenant_id())
  with check (tenant_id = crm.current_user_tenant_id());

insert into crm.notification_templates (tenant_id, key, channel, locale, subject, body, variables, active)
values
  (
    null,
    'review_request_email',
    'email',
    'en-GB',
    'How did we do?',
    '<p>Hi {{customer_name}},</p><p>Thanks for choosing us. Could you rate the job here?</p><p><a href="{{feedback_link}}">Leave feedback</a></p>',
    '["customer_name","feedback_link"]'::jsonb,
    true
  )
on conflict (key, channel, locale) where tenant_id is null do update
set subject = excluded.subject,
    body = excluded.body,
    variables = excluded.variables,
    active = excluded.active;
