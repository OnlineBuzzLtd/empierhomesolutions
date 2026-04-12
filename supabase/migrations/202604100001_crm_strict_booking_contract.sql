alter table crm.customers
  add column if not exists first_name text,
  add column if not exists last_name text;

update crm.customers
set first_name = coalesce(first_name, nullif(split_part(trim(full_name), ' ', 1), '')),
    last_name = coalesce(
      last_name,
      nullif(trim(substring(trim(full_name) from length(split_part(trim(full_name), ' ', 1)) + 1)), '')
    )
where full_name is not null;

alter table crm.sites
  add column if not exists vulnerable_occupant_flag boolean not null default false;

alter table crm.leads
  add column if not exists problem_description text,
  add column if not exists affected_area text,
  add column if not exists urgency_level text,
  add column if not exists preferred_date_text text,
  add column if not exists preferred_time_window text;

alter table crm.jobs
  add column if not exists problem_description text,
  add column if not exists affected_area text,
  add column if not exists urgency_level text,
  add column if not exists preferred_date_text text,
  add column if not exists preferred_time_window text;

alter table crm.appointments
  add column if not exists confirmation_email_sent_at timestamptz,
  add column if not exists confirmation_sms_sent_at timestamptz,
  add column if not exists notification_status text,
  add column if not exists notification_failure_reason text;
