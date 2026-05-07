-- Tenant-scoped reusable bundles of products/lines that can be inserted
-- into a quote as a single composite "package". When inserted, the
-- builder copies items into the quote's line_items JSONB so later edits
-- to a package definition never mutate historic quotes.

create table if not exists crm.packages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default crm.current_user_tenant_id() references crm.tenants(id) on delete cascade,
  name text not null,
  description text,
  default_markup_percent numeric(7,4),
  is_active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists crm.package_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default crm.current_user_tenant_id() references crm.tenants(id) on delete cascade,
  package_id uuid not null references crm.packages(id) on delete cascade,
  product_id uuid references crm.products(id) on delete set null,
  description text not null,
  qty numeric(12,3) not null default 1,
  unit_cost numeric(12,2),
  unit_price numeric(12,2) not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists crm_packages_tenant_active_idx on crm.packages (tenant_id, is_active, name);
create index if not exists crm_package_items_package_sort_idx on crm.package_items (package_id, sort_order);
create index if not exists crm_package_items_tenant_idx on crm.package_items (tenant_id);

create trigger crm_packages_set_updated_at before update on crm.packages for each row execute procedure crm.set_updated_at();
create trigger crm_package_items_set_updated_at before update on crm.package_items for each row execute procedure crm.set_updated_at();

alter table crm.packages enable row level security;
alter table crm.package_items enable row level security;

create policy "crm_read_packages" on crm.packages
for select to authenticated
using (crm.is_tenant_member(tenant_id));

create policy "crm_insert_packages" on crm.packages
for insert to authenticated
with check (crm.is_tenant_member(tenant_id));

create policy "crm_update_packages" on crm.packages
for update to authenticated
using (crm.is_tenant_member(tenant_id))
with check (crm.is_tenant_member(tenant_id));

create policy "crm_delete_packages" on crm.packages
for delete to authenticated
using (crm.is_manager_or_admin(tenant_id));

create policy "crm_read_package_items" on crm.package_items
for select to authenticated
using (crm.is_tenant_member(tenant_id));

create policy "crm_insert_package_items" on crm.package_items
for insert to authenticated
with check (crm.is_tenant_member(tenant_id));

create policy "crm_update_package_items" on crm.package_items
for update to authenticated
using (crm.is_tenant_member(tenant_id))
with check (crm.is_tenant_member(tenant_id));

create policy "crm_delete_package_items" on crm.package_items
for delete to authenticated
using (crm.is_manager_or_admin(tenant_id));
