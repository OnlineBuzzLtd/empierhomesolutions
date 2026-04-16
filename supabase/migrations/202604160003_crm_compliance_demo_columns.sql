alter table crm.job_hazards add column if not exists is_demo boolean not null default false;
alter table crm.job_hazards add column if not exists demo_scenario_key text;

alter table crm.job_checklists add column if not exists is_demo boolean not null default false;
alter table crm.job_checklists add column if not exists demo_scenario_key text;

alter table crm.job_certificates add column if not exists is_demo boolean not null default false;
alter table crm.job_certificates add column if not exists demo_scenario_key text;

alter table crm.purchase_orders add column if not exists is_demo boolean not null default false;
alter table crm.purchase_orders add column if not exists demo_scenario_key text;

alter table crm.supplier_reconciliation add column if not exists is_demo boolean not null default false;
alter table crm.supplier_reconciliation add column if not exists demo_scenario_key text;

create index if not exists crm_job_hazards_demo_idx on crm.job_hazards (is_demo, demo_scenario_key);
create index if not exists crm_job_checklists_demo_idx on crm.job_checklists (is_demo, demo_scenario_key);
create index if not exists crm_job_certificates_demo_idx on crm.job_certificates (is_demo, demo_scenario_key);
create index if not exists crm_purchase_orders_demo_idx on crm.purchase_orders (is_demo, demo_scenario_key);
create index if not exists crm_supplier_reconciliation_demo_idx on crm.supplier_reconciliation (is_demo, demo_scenario_key);
