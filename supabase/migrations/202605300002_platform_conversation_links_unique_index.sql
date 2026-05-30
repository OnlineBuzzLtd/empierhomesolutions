-- Production drift fix: early environments created crm.platform_conversation_links
-- before the table-level unique constraint on (tenant_id, conversation_id)
-- was present. The platform command executor relies on that conflict target
-- when linking AI conversations to enquiries, jobs, and appointments.

create unique index if not exists crm_platform_conversation_links_tenant_conversation_uidx
  on crm.platform_conversation_links (tenant_id, conversation_id);
