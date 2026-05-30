-- Production drift fix: scheduleNotification uses PostgREST upsert with
-- on_conflict=tenant_id,idempotency_key. PostgREST cannot target the older
-- partial index, so booking processing fails before appointments/jobs are
-- created. A normal unique index still allows multiple NULL idempotency keys.

create unique index if not exists crm_scheduled_notifications_tenant_idempotency_uidx
  on crm.scheduled_notifications (tenant_id, idempotency_key);
