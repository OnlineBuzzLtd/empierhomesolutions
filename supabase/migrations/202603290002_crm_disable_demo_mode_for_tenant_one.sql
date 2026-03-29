alter table crm.tenant_settings
  add column if not exists demo_mode_enabled boolean not null default true;

insert into crm.tenant_settings (tenant_id, demo_mode_enabled)
values ('11111111-1111-4111-8111-111111111111', false)
on conflict (tenant_id) do update
set demo_mode_enabled = excluded.demo_mode_enabled;
