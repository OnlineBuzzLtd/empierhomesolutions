-- CAL-003 · Add is_test flag to crm.appointments.
--
-- Why: the Tier 1 mock-adapter test infrastructure suppresses outbound
-- Twilio but still creates real appointment rows on the production
-- calendar. A real customer call on 2026-05-13 was blocked from booking
-- an emergency callout for an entire week because 54 mock-test rows had
-- squatted on every available slot.
--
-- This column flags rows created by mock-mode test traffic. The
-- check-availability route filters them out so test data never blocks
-- real customer slots. Engineer-facing surfaces (`/diary`, `/jobs`) will
-- ignore the flag by default — these rows are real database entries,
-- just not real bookings.
--
-- Additive + reversible: column defaults to false, no backfill. Rollback
-- with `alter table crm.appointments drop column if exists is_test;`

alter table crm.appointments
  add column if not exists is_test boolean not null default false;

-- Partial index for fast "exclude test data" filtering. Most production
-- queries want NOT is_test, so a partial index on the rare true case
-- keeps the index tiny and the negative filter cheap.
create index if not exists crm_appointments_is_test_partial
  on crm.appointments(is_test)
  where is_test = true;
