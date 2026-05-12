-- Drop the legacy single-arg crm.next_sequence(text).
--
-- The multitenancy foundation migration (202603270001) added a superseding
-- two-arg version `crm.next_sequence(text, uuid default current_user_tenant_id())`
-- but never dropped the older single-arg form. PostgREST cannot decide
-- between the two when called with a single argument and returns:
--   "Could not choose the best candidate function between..."
-- which surfaced from the Quote Create form on /quotes.
--
-- The two-arg version's default makes the call-site signature identical,
-- so removing the single-arg form is non-breaking — and the single-arg
-- form has no in-DB callers (no triggers / views / functions reference it)
-- and only one application caller (nextCrmSequence in src/modules/crm/lib/api.ts)
-- which already supplies only p_sequence_key.
--
-- Rollback: re-create the function from
-- supabase/migrations/202603120001_crm_foundation.sql lines 272-288.

drop function if exists crm.next_sequence(text);
