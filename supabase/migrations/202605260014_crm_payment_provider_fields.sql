alter table crm.payments
  add column if not exists provider text,
  add column if not exists provider_payment_id text,
  add column if not exists provider_checkout_url text,
  add column if not exists provider_status text,
  add column if not exists provider_metadata jsonb not null default '{}'::jsonb;

create index if not exists crm_payments_provider_payment_idx
  on crm.payments (tenant_id, provider, provider_payment_id)
  where provider_payment_id is not null;

create index if not exists crm_payments_invoice_status_idx
  on crm.payments (tenant_id, invoice_id, status)
  where invoice_id is not null;
