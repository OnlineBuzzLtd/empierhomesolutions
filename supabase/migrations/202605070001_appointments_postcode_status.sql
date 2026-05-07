-- EHS-V-001: surface postcode_status on appointments so engineers know
-- whether the address needs verifying on arrival.
--
-- Background: voice-channel bookings now make postcode soft-optional
-- (CJ-V-001 in customerjourneys-site / platform-repository.ts) because
-- UK postcodes are unreliable to capture over ASR. When the runtime
-- publishes BookingConfirmed without a postcode, we want the appointment
-- to carry a flag so the dispatcher / engineer knows to confirm the
-- address by phone before arrival.
--
-- Values:
--   'captured'           — postcode was provided on the booking, no
--                          action needed.
--   'needs_verification' — booking came in without a postcode (typically
--                          a voice booking where the agent skipped
--                          postcode capture). Engineer should confirm
--                          before driving.
--   NULL                 — non-applicable / pre-migration row.
--
-- Adding as a free-text column (rather than an enum) so we don't have
-- to coordinate enum changes if we add more states later
-- (e.g. 'invalid_format', 'manually_corrected').

alter table crm.appointments
  add column if not exists postcode_status text;

comment on column crm.appointments.postcode_status is
  'Set to ''captured'' when the booking arrived with a postcode, ''needs_verification'' when a voice booking confirmed without one (postcode unreliable over ASR), or NULL when not applicable. Drives a UI badge on the engineer diary so dispatchers can confirm the address before dispatch.';
