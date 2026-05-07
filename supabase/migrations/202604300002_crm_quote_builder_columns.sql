-- Quote builder additions:
--   * Public-link tokenisation (anon-shareable preview/accept/reject)
--   * Persisted cost / profit / margin totals (derived at write from
--     the same pure rollup function used in the client UI; the DB is
--     the source of truth, the UI display must agree).
--   * Rejection metadata.
--
-- All new columns are nullable so existing rows remain valid without a
-- backfill. line_items JSONB schema stays liberal — extended shape is
-- enforced at the application boundary via the Zod lineItemSchema.

alter table crm.quotes add column if not exists public_token uuid unique;
alter table crm.quotes add column if not exists public_token_expires_at timestamptz;
alter table crm.quotes add column if not exists rejected_at timestamptz;
alter table crm.quotes add column if not exists rejection_reason text;
alter table crm.quotes add column if not exists total_cost numeric(12,2);
alter table crm.quotes add column if not exists total_profit numeric(12,2);
alter table crm.quotes add column if not exists total_margin_percent numeric(7,4);

create index if not exists crm_quotes_public_token_idx
  on crm.quotes (public_token)
  where public_token is not null;

-- Allow 'declined' status (used when a customer rejects via public link).
-- The existing check constraint already permits this value via the
-- quote_versions check; verify quotes' constraint matches.
do $$
declare
  has_constraint boolean;
begin
  select exists (
    select 1 from pg_constraint
    where conname = 'crm_quotes_status_check' and conrelid = 'crm.quotes'::regclass
  ) into has_constraint;

  if has_constraint then
    alter table crm.quotes drop constraint crm_quotes_status_check;
  end if;

  alter table crm.quotes
    add constraint crm_quotes_status_check
    check (status in ('draft', 'sent', 'accepted', 'declined'));
end $$;
