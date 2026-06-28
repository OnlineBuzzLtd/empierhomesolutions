-- Public quote links call security-definer RPCs in the crm schema.
-- Anon needs schema USAGE to resolve those RPCs, but should not inherit
-- broad execute rights on unrelated CRM functions.

grant usage on schema crm to anon;

revoke execute on all functions in schema crm from public;
revoke execute on all functions in schema crm from anon;

grant execute on all functions in schema crm to authenticated, service_role;

grant execute on function crm.quote_by_public_token(uuid) to anon, authenticated, service_role;
grant execute on function crm.accept_quote_by_token(uuid, text, text, text, text, text) to anon, authenticated, service_role;
grant execute on function crm.reject_quote_by_token(uuid, text) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
