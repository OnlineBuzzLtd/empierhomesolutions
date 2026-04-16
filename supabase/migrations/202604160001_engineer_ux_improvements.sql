alter table crm.jobs add column if not exists started_at timestamptz;

alter table crm.job_checklists add column if not exists is_mandatory boolean not null default false;
