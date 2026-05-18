-- Demo Console C-3 · publish CRM tables to Supabase realtime so the
-- live demo pane can subscribe to is_test=true row inserts.
--
-- Why: the Demo Console renders incoming leads/customers/jobs/appointments
-- in real time as each channel fires. The browser hook uses the
-- `supabase_realtime` publication; tables not in the publication produce
-- no events. Without this migration the live pane stays empty even though
-- the rows are landing in Postgres.
--
-- Existing RLS policies on these tables continue to apply to realtime
-- channels — subscribers only see rows their tenant_id allows.
--
-- Idempotent — the DO block skips tables already in the publication, so
-- re-applying is safe.

do $$
declare
  target_tables text[] := array['customers', 'leads', 'jobs', 'appointments'];
  target_table text;
begin
  foreach target_table in array target_tables loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'crm'
         and tablename = target_table
    ) then
      execute format('alter publication supabase_realtime add table crm.%I', target_table);
    end if;
  end loop;
end $$;
