-- Phase 2.2 of the enterprise multi-tenant hardening plan.
-- Adds a platform-booking linkage to crm.appointments so bookings emitted by
-- the customerjourneys-platform-api outbox can be upserted idempotently.
--
-- Columns:
--   source       — where the appointment originated. Defaults to `crm` so
--                  existing rows (all created in-CRM) are unchanged. Platform
--                  bookings land with `source='platform'`.
--   external_id  — the platform-api booking id. NULL for CRM-native rows.
--                  Unique per (tenant_id, source, external_id) so replays of
--                  the same booking are idempotent and cross-tenant
--                  collisions are impossible.

alter table crm.appointments
  add column if not exists source text not null default 'crm',
  add column if not exists external_id text;

create unique index if not exists crm_appointments_platform_external_id_idx
  on crm.appointments (tenant_id, source, external_id)
  where external_id is not null;

-- Backfill guard: any rows inserted before this migration have
-- source='crm' which matches the new default. The partial index above
-- keeps the uniqueness guarantee from colliding with NULL external_ids.

comment on column crm.appointments.source is
  'Origin of the appointment row. "crm" for manually-created appointments, "platform" for bookings synced from customerjourneys-platform-api.';
comment on column crm.appointments.external_id is
  'Foreign key into public.bookings.id in the platform-api Supabase project. Only populated when source != "crm".';
