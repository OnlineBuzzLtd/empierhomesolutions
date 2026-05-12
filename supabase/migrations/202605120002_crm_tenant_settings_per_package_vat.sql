-- PKG-006 · Per-package VAT display toggle.
--
-- Off by default for every tenant — purely a presentational choice in the
-- quote builder. Math is untouched: quote-level VAT continues to be the
-- source of truth; per-package VAT is a derived display of the same money.
--
-- Additive + reversible: `drop column if exists show_per_package_vat`.

alter table crm.tenant_settings
  add column if not exists show_per_package_vat boolean not null default false;
