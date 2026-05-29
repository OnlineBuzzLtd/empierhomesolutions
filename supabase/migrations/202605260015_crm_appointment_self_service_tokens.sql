create table if not exists crm.appointment_self_service_tokens (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references crm.tenants(id) on delete cascade,
  appointment_id uuid not null references crm.appointments(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists crm_appointment_self_service_tokens_lookup_idx
  on crm.appointment_self_service_tokens (tenant_id, appointment_id, expires_at)
  where revoked_at is null;
