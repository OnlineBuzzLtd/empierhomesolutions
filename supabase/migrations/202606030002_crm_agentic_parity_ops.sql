create table if not exists crm.agent_feedback_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default crm.current_user_tenant_id() references crm.tenants(id) on delete cascade,
  source_type text not null check (source_type in ('manual_relink', 'review_resolution', 'booking_recovery', 'dismissed_ai_outcome', 'operator_note')),
  source_id text,
  root_issue_category text not null check (
    root_issue_category in (
      'wrong_customer',
      'wrong_service',
      'missing_identity',
      'duplicate_booking',
      'failed_tool',
      'unsafe_low_confidence_answer',
      'unknown_intent',
      'other'
    )
  ),
  conversation_id uuid,
  event_id uuid,
  command_id uuid,
  trace_id text,
  feedback jsonb not null default '{}'::jsonb,
  created_by_user_id uuid,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists crm.agent_eval_fixtures (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default crm.current_user_tenant_id() references crm.tenants(id) on delete cascade,
  source_feedback_id uuid references crm.agent_feedback_records(id) on delete set null,
  name text not null,
  input_snapshot jsonb not null default '{}'::jsonb,
  expected_outcome jsonb not null default '{}'::jsonb,
  redaction_version text not null default 'agent-redaction-v1',
  created_by_user_id uuid,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists crm.agent_knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default crm.current_user_tenant_id() references crm.tenants(id) on delete cascade,
  knowledge_type text not null check (
    knowledge_type in (
      'service',
      'price_range',
      'coverage_area',
      'opening_hours',
      'exclusion',
      'payment_policy',
      'cancellation_policy',
      'emergency_policy',
      'faq'
    )
  ),
  title text not null,
  body text not null,
  source_version text not null default 'v1',
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists crm.agent_usage_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default crm.current_user_tenant_id() references crm.tenants(id) on delete cascade,
  workspace_id uuid references crm.workspace_aliases(workspace_id) on delete set null,
  conversation_id uuid,
  trace_id text,
  model text,
  tool_name text,
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  tokens_total integer check (tokens_total is null or tokens_total >= 0),
  cost_estimate numeric(12, 6) check (cost_estimate is null or cost_estimate >= 0),
  status text not null default 'ok' check (status in ('ok', 'timeout', 'fallback', 'error')),
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists crm.agent_resource_budgets (
  tenant_id uuid primary key references crm.tenants(id) on delete cascade,
  monthly_cost_limit numeric(12, 2),
  warning_threshold_percent integer not null default 80 check (warning_threshold_percent between 1 and 100),
  model_policy text not null default 'balanced' check (model_policy in ('quality_first', 'balanced', 'cost_sensitive')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists crm.agent_discovery_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default crm.current_user_tenant_id() references crm.tenants(id) on delete cascade,
  cluster_type text not null check (cluster_type in ('unknown_intent', 'missing_knowledge', 'tool_failure', 'low_confidence', 'review_spike')),
  title text not null,
  status text not null default 'open' check (status in ('open', 'accepted', 'ignored', 'converted_to_ticket')),
  priority_score integer not null default 0 check (priority_score >= 0),
  sample_refs jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger crm_agent_knowledge_sources_set_updated_at
before update on crm.agent_knowledge_sources
for each row execute procedure crm.set_updated_at();

create trigger crm_agent_resource_budgets_set_updated_at
before update on crm.agent_resource_budgets
for each row execute procedure crm.set_updated_at();

create trigger crm_agent_discovery_items_set_updated_at
before update on crm.agent_discovery_items
for each row execute procedure crm.set_updated_at();

create index if not exists crm_agent_feedback_records_tenant_created_idx
  on crm.agent_feedback_records (tenant_id, created_at desc);
create index if not exists crm_agent_feedback_records_tenant_category_idx
  on crm.agent_feedback_records (tenant_id, root_issue_category, created_at desc);
create index if not exists crm_agent_eval_fixtures_tenant_created_idx
  on crm.agent_eval_fixtures (tenant_id, created_at desc);
create index if not exists crm_agent_knowledge_sources_tenant_type_idx
  on crm.agent_knowledge_sources (tenant_id, knowledge_type, active);
create index if not exists crm_agent_usage_events_tenant_occurred_idx
  on crm.agent_usage_events (tenant_id, occurred_at desc);
create index if not exists crm_agent_discovery_items_tenant_status_idx
  on crm.agent_discovery_items (tenant_id, status, priority_score desc);

alter table crm.agent_feedback_records enable row level security;
alter table crm.agent_eval_fixtures enable row level security;
alter table crm.agent_knowledge_sources enable row level security;
alter table crm.agent_usage_events enable row level security;
alter table crm.agent_resource_budgets enable row level security;
alter table crm.agent_discovery_items enable row level security;

create policy "crm_read_agent_feedback_records" on crm.agent_feedback_records
for select to authenticated using (crm.is_manager_or_admin(tenant_id));
create policy "crm_manage_agent_feedback_records" on crm.agent_feedback_records
for all to authenticated using (crm.is_manager_or_admin(tenant_id)) with check (crm.is_manager_or_admin(tenant_id));

create policy "crm_read_agent_eval_fixtures" on crm.agent_eval_fixtures
for select to authenticated using (crm.is_manager_or_admin(tenant_id));
create policy "crm_manage_agent_eval_fixtures" on crm.agent_eval_fixtures
for all to authenticated using (crm.is_manager_or_admin(tenant_id)) with check (crm.is_manager_or_admin(tenant_id));

create policy "crm_read_agent_knowledge_sources" on crm.agent_knowledge_sources
for select to authenticated using (crm.is_tenant_member(tenant_id));
create policy "crm_manage_agent_knowledge_sources" on crm.agent_knowledge_sources
for all to authenticated using (crm.is_manager_or_admin(tenant_id)) with check (crm.is_manager_or_admin(tenant_id));

create policy "crm_read_agent_usage_events" on crm.agent_usage_events
for select to authenticated using (crm.is_manager_or_admin(tenant_id));
create policy "crm_manage_agent_usage_events" on crm.agent_usage_events
for all to authenticated using (crm.is_manager_or_admin(tenant_id)) with check (crm.is_manager_or_admin(tenant_id));

create policy "crm_read_agent_resource_budgets" on crm.agent_resource_budgets
for select to authenticated using (crm.is_manager_or_admin(tenant_id));
create policy "crm_manage_agent_resource_budgets" on crm.agent_resource_budgets
for all to authenticated using (crm.is_manager_or_admin(tenant_id)) with check (crm.is_manager_or_admin(tenant_id));

create policy "crm_read_agent_discovery_items" on crm.agent_discovery_items
for select to authenticated using (crm.is_manager_or_admin(tenant_id));
create policy "crm_manage_agent_discovery_items" on crm.agent_discovery_items
for all to authenticated using (crm.is_manager_or_admin(tenant_id)) with check (crm.is_manager_or_admin(tenant_id));
