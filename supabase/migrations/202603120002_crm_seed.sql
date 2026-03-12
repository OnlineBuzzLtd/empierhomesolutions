insert into crm.services (slug, name, active, launch_date)
values
  ('boilers', 'Boilers', true, null),
  ('cylinders', 'Cylinders', true, null),
  ('power-flushing', 'Power Flushing', true, null),
  ('plumbing', 'Plumbing Services', true, null),
  ('ashp', 'Air Source Heat Pumps', true, '2026-03-01'),
  ('commercial-boilers', 'Commercial Boilers', true, '2026-06-01'),
  ('air-conditioning', 'Air Conditioning', true, '2026-06-01'),
  ('solar-pv', 'Solar PV', true, '2026-12-01')
on conflict (slug) do update
set
  name = excluded.name,
  active = excluded.active,
  launch_date = excluded.launch_date;

with service_map as (
  select id, slug
  from crm.services
)
insert into crm.job_types (service_id, slug, name, description, active)
values
  ((select id from service_map where slug = 'boilers'), 'boiler-install', 'Boiler Install', 'Domestic boiler installation and replacement.', true),
  ((select id from service_map where slug = 'boilers'), 'boiler-service', 'Boiler Service', 'Annual boiler service and maintenance.', true),
  ((select id from service_map where slug = 'boilers'), 'gas-safety-cert', 'Gas Safety Certificate', 'Domestic gas safety certificate visit.', true),
  ((select id from service_map where slug = 'boilers'), 'boiler-repair', 'Boiler Repair', 'Fault finding and repair work.', true),
  ((select id from service_map where slug = 'cylinders'), 'vented-cylinder', 'Vented Cylinder', 'Vented cylinder installation and repair.', true),
  ((select id from service_map where slug = 'cylinders'), 'unvented-cylinder', 'Unvented Cylinder', 'Unvented cylinder installation and repair.', true),
  ((select id from service_map where slug = 'power-flushing'), 'power-flush', 'Power Flush', 'Domestic heating system power flush.', true),
  ((select id from service_map where slug = 'plumbing'), 'plumbing-general', 'General Plumbing', 'General domestic plumbing works.', true),
  ((select id from service_map where slug = 'ashp'), 'ashp-install', 'ASHP Install', 'Air source heat pump installation.', true),
  ((select id from service_map where slug = 'commercial-boilers'), 'commercial-install', 'Commercial Install', 'Commercial boiler installation.', true),
  ((select id from service_map where slug = 'commercial-boilers'), 'commercial-service', 'Commercial Service', 'Commercial boiler servicing.', true),
  ((select id from service_map where slug = 'air-conditioning'), 'ac-install', 'AC Install', 'Air conditioning installation.', true),
  ((select id from service_map where slug = 'air-conditioning'), 'ac-service', 'AC Service', 'Air conditioning service and maintenance.', true),
  ((select id from service_map where slug = 'solar-pv'), 'solar-install', 'Solar PV Install', 'Solar PV installation and commissioning.', true)
on conflict (service_id, slug) do update
set
  name = excluded.name,
  description = excluded.description,
  active = excluded.active;
