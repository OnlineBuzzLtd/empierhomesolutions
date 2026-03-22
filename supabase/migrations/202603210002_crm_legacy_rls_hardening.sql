create or replace function crm.is_active_user()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from crm.user_profiles
    where user_id = auth.uid()
      and active = true
  );
$$;

drop policy if exists "crm_authenticated_customers" on crm.customers;
drop policy if exists "crm_authenticated_leads" on crm.leads;
drop policy if exists "crm_authenticated_assets" on crm.customer_assets;
drop policy if exists "crm_authenticated_jobs" on crm.jobs;
drop policy if exists "crm_authenticated_notes" on crm.notes;
drop policy if exists "crm_authenticated_appointments" on crm.appointments;
drop policy if exists "crm_authenticated_quotes" on crm.quotes;
drop policy if exists "crm_authenticated_invoices" on crm.invoices;
drop policy if exists "crm_authenticated_payments" on crm.payments;
drop policy if exists "crm_authenticated_expenses" on crm.expenses;
drop policy if exists "crm_authenticated_attachments" on crm.attachments;
drop policy if exists "crm_authenticated_custom_field_values" on crm.custom_field_values;

create policy "crm_read_customers" on crm.customers
for select to authenticated
using (crm.is_active_user());

create policy "crm_insert_customers" on crm.customers
for insert to authenticated
with check (crm.is_active_user() and archived = false);

create policy "crm_update_customers" on crm.customers
for update to authenticated
using (crm.is_active_user())
with check (crm.is_active_user() and (archived = false or crm.is_manager_or_admin()));

create policy "crm_delete_customers" on crm.customers
for delete to authenticated
using (crm.is_manager_or_admin());

create policy "crm_read_leads" on crm.leads
for select to authenticated
using (crm.is_active_user());

create policy "crm_insert_leads" on crm.leads
for insert to authenticated
with check (crm.is_active_user());

create policy "crm_update_leads" on crm.leads
for update to authenticated
using (crm.is_active_user())
with check (crm.is_active_user());

create policy "crm_delete_leads" on crm.leads
for delete to authenticated
using (crm.is_manager_or_admin());

create policy "crm_read_customer_assets" on crm.customer_assets
for select to authenticated
using (crm.is_active_user());

create policy "crm_insert_customer_assets" on crm.customer_assets
for insert to authenticated
with check (crm.is_active_user());

create policy "crm_update_customer_assets" on crm.customer_assets
for update to authenticated
using (crm.is_active_user())
with check (crm.is_active_user());

create policy "crm_delete_customer_assets" on crm.customer_assets
for delete to authenticated
using (crm.is_manager_or_admin());

create policy "crm_read_jobs" on crm.jobs
for select to authenticated
using (crm.is_active_user());

create policy "crm_insert_jobs" on crm.jobs
for insert to authenticated
with check (crm.is_active_user());

create policy "crm_update_jobs" on crm.jobs
for update to authenticated
using (crm.is_active_user())
with check (crm.is_active_user());

create policy "crm_delete_jobs" on crm.jobs
for delete to authenticated
using (crm.is_manager_or_admin());

create policy "crm_read_notes" on crm.notes
for select to authenticated
using (crm.is_active_user());

create policy "crm_insert_notes" on crm.notes
for insert to authenticated
with check (crm.is_active_user());

create policy "crm_update_notes" on crm.notes
for update to authenticated
using (crm.is_active_user())
with check (crm.is_active_user());

create policy "crm_delete_notes" on crm.notes
for delete to authenticated
using (crm.is_manager_or_admin());

create policy "crm_read_appointments" on crm.appointments
for select to authenticated
using (crm.is_active_user());

create policy "crm_insert_appointments" on crm.appointments
for insert to authenticated
with check (crm.is_active_user());

create policy "crm_update_appointments" on crm.appointments
for update to authenticated
using (crm.is_active_user())
with check (crm.is_active_user());

create policy "crm_delete_appointments" on crm.appointments
for delete to authenticated
using (crm.is_manager_or_admin());

create policy "crm_read_quotes" on crm.quotes
for select to authenticated
using (crm.is_active_user());

create policy "crm_insert_quotes" on crm.quotes
for insert to authenticated
with check (crm.is_active_user());

create policy "crm_update_quotes" on crm.quotes
for update to authenticated
using (crm.is_active_user())
with check (crm.is_active_user());

create policy "crm_delete_quotes" on crm.quotes
for delete to authenticated
using (crm.is_manager_or_admin());

create policy "crm_read_invoices" on crm.invoices
for select to authenticated
using (crm.is_active_user());

create policy "crm_insert_invoices" on crm.invoices
for insert to authenticated
with check (crm.is_active_user());

create policy "crm_update_invoices" on crm.invoices
for update to authenticated
using (crm.is_active_user())
with check (crm.is_active_user());

create policy "crm_delete_invoices" on crm.invoices
for delete to authenticated
using (crm.is_manager_or_admin());

create policy "crm_read_payments" on crm.payments
for select to authenticated
using (crm.is_active_user());

create policy "crm_insert_payments" on crm.payments
for insert to authenticated
with check (crm.is_active_user());

create policy "crm_update_payments" on crm.payments
for update to authenticated
using (crm.is_active_user())
with check (crm.is_active_user());

create policy "crm_delete_payments" on crm.payments
for delete to authenticated
using (crm.is_manager_or_admin());

create policy "crm_read_expenses" on crm.expenses
for select to authenticated
using (crm.is_active_user());

create policy "crm_insert_expenses" on crm.expenses
for insert to authenticated
with check (crm.is_active_user());

create policy "crm_update_expenses" on crm.expenses
for update to authenticated
using (crm.is_active_user())
with check (crm.is_active_user());

create policy "crm_delete_expenses" on crm.expenses
for delete to authenticated
using (crm.is_manager_or_admin());

create policy "crm_read_attachments" on crm.attachments
for select to authenticated
using (crm.is_active_user());

create policy "crm_insert_attachments" on crm.attachments
for insert to authenticated
with check (crm.is_active_user());

create policy "crm_update_attachments" on crm.attachments
for update to authenticated
using (crm.is_active_user())
with check (crm.is_active_user());

create policy "crm_delete_attachments" on crm.attachments
for delete to authenticated
using (crm.is_manager_or_admin());

create policy "crm_read_custom_field_values" on crm.custom_field_values
for select to authenticated
using (crm.is_active_user());

create policy "crm_insert_custom_field_values" on crm.custom_field_values
for insert to authenticated
with check (crm.is_active_user());

create policy "crm_update_custom_field_values" on crm.custom_field_values
for update to authenticated
using (crm.is_active_user())
with check (crm.is_active_user());

create policy "crm_delete_custom_field_values" on crm.custom_field_values
for delete to authenticated
using (crm.is_manager_or_admin());
