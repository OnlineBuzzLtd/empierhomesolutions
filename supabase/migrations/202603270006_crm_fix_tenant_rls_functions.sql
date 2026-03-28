create or replace function crm.current_user_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = crm, auth, public
as $$
  select tenant_id
  from crm.tenant_memberships
  where user_id = auth.uid()
    and active = true
  order by is_owner desc, created_at asc
  limit 1
$$;

create or replace function crm.is_tenant_member(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = crm, auth, public
as $$
  select exists (
    select 1
    from crm.tenant_memberships
    where tenant_id = p_tenant_id
      and user_id = auth.uid()
      and active = true
  )
$$;

create or replace function crm.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = crm, auth, public
as $$
  select exists (
    select 1
    from crm.tenant_memberships
    where user_id = auth.uid()
      and active = true
  )
$$;

create or replace function crm.is_manager_or_admin(p_tenant_id uuid default crm.current_user_tenant_id())
returns boolean
language sql
stable
security definer
set search_path = crm, auth, public
as $$
  select exists (
    select 1
    from crm.tenant_memberships
    where tenant_id = p_tenant_id
      and user_id = auth.uid()
      and role in ('management', 'admin')
      and active = true
  )
$$;
