-- Public (anon) access to a tokenised quote view.
--
-- Customers receive a URL like /q/<uuid>. The Next.js public routes call
-- these security-definer RPCs; anon never reads crm.quotes directly
-- (no anon grants exist on crm.quotes / line_items, so RLS already
-- blocks direct table access — these RPCs are the only authorised
-- path).
--
-- The read RPC returns a sanitised projection: no unit_cost,
-- no markup_percent, no total_cost, no total_profit, no
-- total_margin_percent, no tenant_id. line_items are stripped of cost
-- fields per row before being returned.

create or replace function crm.quote_by_public_token(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, crm
as $$
declare
  result jsonb;
  sanitised_items jsonb;
begin
  if p_token is null then
    return null;
  end if;

  select
    coalesce(
      jsonb_agg(
        case
          when (item->>'kind') = 'section_header' then
            jsonb_build_object(
              'description', item->>'description',
              'qty', 0,
              'unit_price', 0,
              'kind', item->>'kind',
              'section_id', item->>'section_id'
            )
          else
            jsonb_build_object(
              'description', item->>'description',
              'qty', coalesce((item->>'qty')::numeric, 0),
              'unit_price', coalesce((item->>'unit_price')::numeric, 0),
              'kind', coalesce(item->>'kind', 'line'),
              'package_role', item->>'package_role',
              'section_id', item->>'section_id'
            )
        end
        order by ord
      ),
      '[]'::jsonb
    )
  into sanitised_items
  from crm.quotes q,
       jsonb_array_elements(coalesce(q.line_items, '[]'::jsonb)) with ordinality as t(item, ord)
  where q.public_token = p_token
    and (q.public_token_expires_at is null or q.public_token_expires_at > now())
    and q.status in ('sent', 'accepted', 'declined');

  select jsonb_build_object(
    'id', q.id,
    'quote_number', q.quote_number,
    'document_type', q.document_type,
    'line_items', coalesce(sanitised_items, '[]'::jsonb),
    'subtotal', q.subtotal,
    'vat_rate', q.vat_rate,
    'total', q.total,
    'status', q.status,
    'valid_until', q.valid_until,
    'customer_name', coalesce(c.full_name, trim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, ''))),
    'tenant_name', t.name,
    'invoice_schedules', coalesce(
      (
        select jsonb_agg(jsonb_build_object(
          'label', s.label,
          'payment_type', s.payment_type,
          'percentage', s.percentage,
          'fixed_amount', s.fixed_amount,
          'due_offset_days', s.due_offset_days
        ) order by s.created_at asc)
        from crm.invoice_schedules s
        where s.quote_id = q.id
      ),
      '[]'::jsonb
    )
  )
  into result
  from crm.quotes q
  left join crm.customers c on c.id = q.customer_id
  left join crm.tenants t on t.id = q.tenant_id
  where q.public_token = p_token
    and (q.public_token_expires_at is null or q.public_token_expires_at > now())
    and q.status in ('sent', 'accepted', 'declined');

  return result;
end;
$$;

revoke all on function crm.quote_by_public_token(uuid) from public;
grant execute on function crm.quote_by_public_token(uuid) to anon, authenticated;

create or replace function crm.accept_quote_by_token(
  p_token uuid,
  p_name text,
  p_email text,
  p_notes text,
  p_ip text,
  p_user_agent text
)
returns jsonb
language plpgsql
security definer
set search_path = public, crm
as $$
declare
  v_quote crm.quotes%rowtype;
  v_acceptance_id uuid;
  v_method text;
begin
  if p_token is null or coalesce(trim(p_name), '') = '' then
    raise exception 'invalid_arguments';
  end if;

  select * into v_quote
  from crm.quotes
  where public_token = p_token
    and (public_token_expires_at is null or public_token_expires_at > now())
    and status = 'sent'
  for update;

  if not found then
    raise exception 'quote_not_found_or_expired';
  end if;

  v_method := 'public_link_typed_name';

  insert into crm.quote_acceptances (
    tenant_id, quote_id, accepted_by_name, accepted_by_email, acceptance_method, notes, accepted_at
  )
  values (
    v_quote.tenant_id, v_quote.id, p_name,
    nullif(coalesce(p_email, ''), ''),
    v_method,
    nullif(coalesce(
      coalesce(p_notes, '') ||
      case when coalesce(p_ip, '') = '' then '' else E'\nIP: ' || p_ip end ||
      case when coalesce(p_user_agent, '') = '' then '' else E'\nUA: ' || p_user_agent end,
      ''), ''),
    now()
  )
  on conflict (quote_id) do update
    set accepted_by_name = excluded.accepted_by_name,
        accepted_by_email = excluded.accepted_by_email,
        acceptance_method = excluded.acceptance_method,
        notes = excluded.notes,
        accepted_at = excluded.accepted_at
  returning id into v_acceptance_id;

  update crm.quotes
  set status = 'accepted',
      current_version_number = current_version_number + 1
  where id = v_quote.id;

  return jsonb_build_object('quote_id', v_quote.id, 'acceptance_id', v_acceptance_id);
end;
$$;

revoke all on function crm.accept_quote_by_token(uuid, text, text, text, text, text) from public;
grant execute on function crm.accept_quote_by_token(uuid, text, text, text, text, text) to anon, authenticated;

create or replace function crm.reject_quote_by_token(
  p_token uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, crm
as $$
declare
  v_quote crm.quotes%rowtype;
begin
  if p_token is null then
    raise exception 'invalid_arguments';
  end if;

  select * into v_quote
  from crm.quotes
  where public_token = p_token
    and (public_token_expires_at is null or public_token_expires_at > now())
    and status = 'sent'
  for update;

  if not found then
    raise exception 'quote_not_found_or_expired';
  end if;

  update crm.quotes
  set status = 'declined',
      rejected_at = now(),
      rejection_reason = nullif(coalesce(p_reason, ''), ''),
      current_version_number = current_version_number + 1
  where id = v_quote.id;

  return jsonb_build_object('quote_id', v_quote.id);
end;
$$;

revoke all on function crm.reject_quote_by_token(uuid, text) from public;
grant execute on function crm.reject_quote_by_token(uuid, text) to anon, authenticated;
