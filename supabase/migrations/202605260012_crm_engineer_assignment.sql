alter table crm.user_profiles
  add column if not exists service_skill_tags text[] not null default '{}'::text[],
  add column if not exists postcode_areas text[] not null default '{}'::text[],
  add column if not exists daily_job_capacity integer not null default 8
    check (daily_job_capacity > 0 and daily_job_capacity <= 32);

comment on column crm.user_profiles.service_skill_tags is
  'Lowercase service/job-type tags used by CRM auto-assignment, e.g. boiler-service, emergency-plumbing.';

comment on column crm.user_profiles.postcode_areas is
  'UK outward postcode or area tokens the engineer normally covers, e.g. UB8, UB, HA4.';

comment on column crm.user_profiles.daily_job_capacity is
  'Soft cap used by CRM auto-assignment when choosing the lowest-load matching engineer.';
