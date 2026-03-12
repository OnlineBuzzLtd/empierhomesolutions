grant usage on schema crm to authenticated, service_role;

grant all on all tables in schema crm to authenticated, service_role;
grant all on all routines in schema crm to authenticated, service_role;
grant all on all sequences in schema crm to authenticated, service_role;

alter default privileges for role postgres in schema crm grant all on tables to authenticated, service_role;
alter default privileges for role postgres in schema crm grant all on routines to authenticated, service_role;
alter default privileges for role postgres in schema crm grant all on sequences to authenticated, service_role;

alter role authenticator set pgrst.db_schemas = 'public,storage,graphql_public,crm';
notify pgrst, 'reload config';
