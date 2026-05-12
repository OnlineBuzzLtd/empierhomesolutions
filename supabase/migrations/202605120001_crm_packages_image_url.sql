-- PKG-003 · Add optional image URL to crm.packages.
--
-- Additive, backwards compatible: column defaults to null. Existing rows
-- keep working. RLS is inherited from the parent table — no new policies.
-- Rollback: alter table crm.packages drop column if exists image_url;

alter table crm.packages
  add column if not exists image_url text;
