-- Apply before enabling CRM_MULTISITE_ENABLED. No addresses are rewritten.
-- Fail rather than silently pick a winner if existing data has two primaries.
begin;

create unique index crm_sites_one_primary_per_customer
  on crm.sites (tenant_id, customer_id) where is_primary;

create or replace function crm.switch_primary_site()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (select 1 from crm.customers c where c.id = new.customer_id and c.tenant_id = new.tenant_id) then
    raise exception 'Customer does not belong to this workspace.' using errcode = '42501';
  end if;
  if new.is_primary then
    update crm.sites set is_primary = false
      where tenant_id = new.tenant_id and customer_id = new.customer_id
        and id <> new.id and is_primary;
  end if;
  return new;
end;
$$;

create trigger crm_sites_switch_primary
  before insert or update of is_primary, customer_id, tenant_id on crm.sites
  for each row execute function crm.switch_primary_site();

-- A locked parent row prevents concurrent FK inserts from acquiring a site
-- reference between this check and deletion. RLS continues to apply.
create or replace function crm.delete_unused_site(p_site_id uuid, p_tenant_id uuid)
returns crm.sites
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target crm.sites;
begin
  if not crm.is_manager_or_admin(p_tenant_id) then
    raise exception 'Site deletion requires a manager.' using errcode = '42501';
  end if;
  select * into target from crm.sites
    where id = p_site_id and tenant_id = p_tenant_id for update;
  if not found then return null; end if;
  if exists (select 1 from crm.jobs where site_id = target.id)
    or exists (select 1 from crm.site_contacts where site_id = target.id) then
    raise exception 'Site is in use.' using errcode = '23503';
  end if;
  delete from crm.sites where id = target.id and tenant_id = p_tenant_id;
  return target;
end;
$$;

revoke all on function crm.switch_primary_site() from public;
revoke all on function crm.delete_unused_site(uuid, uuid) from public;
grant execute on function crm.delete_unused_site(uuid, uuid) to authenticated;

commit;
