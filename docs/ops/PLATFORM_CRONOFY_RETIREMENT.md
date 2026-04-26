# Cronofy write-path retirement checklist (Phase 2.5)

_Phase 2 of the enterprise multi-tenant hardening plan retires the
Cronofy write adapter for tenants that have switched to the native
calendar. Cronofy stays available for _free/busy import only_ when a
tenant explicitly opts in via `metadata.freeBusyImportConnectionId`._

## Why

With Ship 5, every native-provider tenant reads/writes its booking
availability from `public.bookings`, `public.working_hours`,
`public.time_off`, and `public.holidays` in the
customerjourneys-platform-api Supabase project. The Cronofy adapter is
still in the codebase for migration reasons, but no longer needs to be
on the write path for native tenants — two-way syncing on writes leaves
"phantom" holds on Cronofy if the native system is the source of truth.

## Verification checklist (run in platform-api Supabase)

1. **List tenants still writing to Cronofy:**

   ```sql
   SELECT t.id, t.slug, r.id AS resource_id, r.provider_key
   FROM public.tenants t
   JOIN public.booking_resources r ON r.tenant_id = t.id
   WHERE r.provider_key = 'cronofy'
     AND COALESCE(t.metadata->>'calendarMode', 'native') = 'native';
   ```

2. **Flip the affected resources to the native adapter:**

   ```sql
   UPDATE public.booking_resources
   SET provider_key = 'native'
   WHERE id IN (...);
   ```

3. **Preserve opt-in free/busy import**. Tenants that want to keep
   reading a Cronofy calendar for availability hints must have an
   explicit `metadata.freeBusyImportConnectionId` pointing at the
   Cronofy `integration_connection.id`. This is read by
   `services/workers/.../reconcile-calendar-connections.ts` and is
   unaffected by the write-path retirement.

4. **Audit bookings created after the flip:**

   ```sql
   SELECT id, tenant_id, metadata->'externalCalendar'->>'providerKey' AS provider
   FROM public.bookings
   WHERE created_at >= now() - interval '24 hours'
     AND metadata->'externalCalendar'->>'providerKey' = 'cronofy';
   ```

   After the flip this query must return zero rows for native tenants.

## Rollback

Set `provider_key` back to `'cronofy'` on the affected resources; the
factory in `packages/integrations/src/calendar/factory.ts` will rebuild
the Cronofy adapter on the next write.
