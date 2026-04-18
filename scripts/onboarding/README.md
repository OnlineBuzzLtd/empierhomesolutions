# Phase 1: Empire reference migration

One-off runbook to bring Tenant 1 (Empire Home Solutions) to the canonical
per-business topology: one CJ tenant + one Twilio Messaging Service + one
dedicated number + one WhatsApp Sender. Every future business is onboarded
through the automated server-side path (see `ensureTenantTwilioProvisioning`
in `src/modules/crm/lib/twilio-provisioning.ts`); Empire pre-dates that, so
we migrate it by hand using the script next to this README.

## Preconditions

Work on the CustomerJourneys platform has already landed:

- `POST /v1/admin/tenants/:id/messaging-connection`
- `POST /v1/admin/tenants/:id/voice-connection`
- `POST /v1/admin/tenants/:id/whatsapp-sender`

(If those endpoints are not yet live, see `Phase 2a` in the plan — the CJ
repo needs to land them before this script can run end-to-end.)

Twilio side (master account):

- Messaging Service SID created for Empire (SMS-capable UK number assigned to it).
- Voice IncomingPhoneNumber (`+447401248976`) provisioned and pointing at CJ's
  voice webhook.
- WhatsApp Sender registered under the Empire brand (Meta review cleared).

## Environment

Add to your shell (or `.env.local`) before running:

```
CUSTOMERJOURNEYS_ADMIN_API_TOKEN=<bearer-for-CJ-admin>
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
EMPIRE_MESSAGING_SERVICE_SID=MG...
EMPIRE_VOICE_NUMBER_E164=+447401248976
EMPIRE_VOICE_NUMBER_SID=PN...
EMPIRE_WHATSAPP_SENDER_ID=XE...   # optional; skip if WA not yet approved
```

## Running

Preview (no writes):

```
node scripts/onboarding/empire-reference-migration.mjs --dry-run
```

Execute:

```
node scripts/onboarding/empire-reference-migration.mjs
```

The script:

1. Provisions a fresh CJ tenant `empire-home-solutions` (`POST /v1/admin/tenants`).
2. Attaches the Twilio Messaging Service via CJ admin API.
3. Attaches the voice binding.
4. Attaches the WhatsApp Sender (if the env var is set).
5. Calls `/v1/internal/tenants/<new>/test-surface` and prints the readiness
   report. All four channels should come back `ready: true`.
6. `UPDATE`s `crm.customerjourneys_runtime_links` for Tenant 1 to point at
   the new CJ tenant ID.

After the script finishes, reload `/test` in the CRM — the four channel
cards should go green within one poll.

## Retiring the old CJ tenants

Once `/test` is confirmed green and a real voice call produces CRM writes,
delete the legacy tenants on CJ so nothing stray can point at them again:

```
DELETE /v1/admin/tenants/75d76e43-4e5e-4568-8ff2-e2594c9818f9   # dk-plumbing (old)
DELETE /v1/admin/tenants/b469a9fe-546d-4baa-9f87-3487c7c4afc1   # customerjourneys-isolated-production (old)
```

(Or whatever the CJ admin delete verb is — check the CJ admin API docs.)

## Why this is a one-off

Every subsequent business goes through the automated onboarding pipeline
(`ensureTenantTwilioProvisioning` called from
`src/modules/crm/lib/tenants.ts`). This script is only here because Empire
was provisioned before that pipeline existed, and because its Twilio
artifacts were attached to two separate CJ tenants by mistake.

## Smoke test (cross-tenant)

Run once for Empire and once for a freshly onboarded business (pick it with
the tenant selector at the top of `/test`).

For each tenant:

1. Open `/test?tenant=<slug>`. All four channel cards should be `READY`.
   If any channel is `NOT_READY`, fix the readiness issue (usually it's a
   missing WhatsApp Sender approval) before continuing.
2. Click **Arm test (reset log to now)**.
3. **Voice:** dial the displayed voice number from a real phone. Say your
   name + postcode + request. End the call naturally. Within ~10s the live
   log should show `call.start` / transcript / booking events and a
   `CRM WRITES` card with customer + lead + job + booking populated.
4. **SMS:** text the displayed SMS number from a real phone. Go through
   the booking flow. Confirm the same CRM writes appear.
5. **WhatsApp:** open the deep link, message the agent, confirm the
   booking. Confirm the same CRM writes appear.
6. **Webchat:** fill in the opening message and click Start webchat. Send
   a follow-up reply. Confirm the webchat panel shows the agent's replies
   and the CRM WRITES card is populated.

Acceptance: all four channels produce a CRM-writes card populated with
customer + lead + job + booking for both tenants without any manual
Twilio or CJ intervention (modulo the async WhatsApp approval step for
brand-new senders).
