-- Per-tenant Twilio provisioning state.
-- Records the Twilio artifacts (Messaging Service, voice number, WhatsApp Sender)
-- provisioned for each CRM tenant, plus the sync status so the CJ runtime surface
-- readiness check can be cross-checked against what this repo believes is attached.

create table if not exists crm.tenant_twilio_state (
  tenant_id uuid primary key references crm.tenants(id) on delete cascade,
  messaging_service_sid text,
  voice_number_sid text,
  voice_number_e164 text,
  whatsapp_sender_id text,
  whatsapp_status text not null default 'not_started'
    check (whatsapp_status in ('not_started', 'pending_review', 'approved', 'rejected', 'manual')),
  last_synced_at timestamptz,
  last_error text,
  provisioning_log jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger crm_tenant_twilio_state_set_updated_at
  before update on crm.tenant_twilio_state
  for each row execute procedure crm.set_updated_at();

alter table crm.tenant_twilio_state enable row level security;

-- Managers/admins of a tenant can read and manage their own Twilio provisioning state.
create policy "crm_read_tenant_twilio_state" on crm.tenant_twilio_state
for select to authenticated
using (crm.is_tenant_member(tenant_id));

create policy "crm_manage_tenant_twilio_state" on crm.tenant_twilio_state
for all to authenticated
using (crm.is_manager_or_admin(tenant_id))
with check (crm.is_manager_or_admin(tenant_id));
