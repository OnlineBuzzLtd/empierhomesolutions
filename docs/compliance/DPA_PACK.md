# Data Processing Agreement (DPA) pack

This directory is the evidence pack Customer Journeys sends to enterprise
customers as part of procurement. It is intentionally a template — treat
every `{{…}}` placeholder as a contract variable and version it per
customer.

## 1. Record of processing activities (RoPA)

| Field                 | Value                                                     |
| --------------------- | --------------------------------------------------------- |
| Controller            | {{customer legal name}}                                   |
| Processor             | Customer Journeys Ltd (customerjourneys.ai)               |
| Purpose               | Multi-tenant CRM + voice-agent booking platform           |
| Data subjects         | Customer's end-customers, engineers, operators            |
| Categories of data    | Name, email, phone, address, call recordings, transcripts |
| Retention (active)    | Lifetime of tenant + 30 days soft-delete window           |
| Retention (audit)     | 7 years (UK HMRC requirement) for quotes / invoices only  |
| International xfers   | UK / EU (Supabase eu-west-2); USA (Vercel) — SCCs in place|

## 2. Sub-processors

| Sub-processor        | Function                          | Region        | DPA                                                    |
| -------------------- | --------------------------------- | ------------- | ------------------------------------------------------ |
| Supabase Inc.        | Database + object storage         | UK (eu-west-2)| https://supabase.com/legal/dpa                        |
| Vercel Inc.          | Front-end hosting                 | USA (global)  | https://vercel.com/legal/dpa                          |
| Google Cloud         | Backend Cloud Run + BigQuery sink | europe-west2  | https://cloud.google.com/terms/data-processing-terms  |
| Twilio Inc.          | SMS / voice PSTN                  | USA (global)  | https://www.twilio.com/legal/data-protection-addendum |
| ElevenLabs           | Voice synthesis                   | USA           | https://elevenlabs.io/dpa                             |
| Resend               | Transactional email               | USA (EU sub)  | https://resend.com/legal/dpa                          |
| Cloudflare           | WAF + Turnstile                   | UK (global)   | https://www.cloudflare.com/cloudflare-customer-dpa/   |
| Sentry               | Error telemetry                   | EU region     | https://sentry.io/trust/dpa/                          |

## 3. Technical and organisational measures (TOMs)

- Encryption in transit: TLS 1.2+ enforced. HSTS `max-age=63072000; includeSubDomains; preload`.
- Encryption at rest: AES-256 (Supabase, Vercel blob storage, GCS).
- Access control: Supabase RLS (`crm.is_tenant_member`, `crm.is_manager_or_admin`).
  Platform-admin actions gated by `PLATFORM_ADMIN_EMAILS` allowlist and
  service-token RBAC.
- Incident response: see `docs/compliance/INCIDENT_RESPONSE.md`. 72-hour
  breach notification to the controller.
- Backups: Supabase daily PITR; recovery target 30 days.
- Audit: `crm.tenant_lifecycle_events` plus Cloud Logging → BigQuery sink
  give a tamper-evident audit log for 400+ days.

## 4. Data-subject request (DSR) handling

- **Access (Art. 15)** / **Portability (Art. 20)**: call
  `GET /api/crm/admin/tenants/:id/export` (see
  `docs/ops/TENANT_LIFECYCLE.md`). Delivered as NDJSON within 30 days.
- **Rectification (Art. 16)**: tenant admins edit in-app; audit trail in
  `crm.ai_crm_impacts` + `crm.notes`.
- **Erasure (Art. 17)**: `DELETE /api/crm/admin/tenants/:id` soft-deletes;
  cascaded reaper runs after 30 days.

## 5. Annual / quarterly cadences

- **Quarterly**: dependency audit (GitHub Actions workflow
  `.github/workflows/security-audit.yml`), secrets rotation
  (`scripts/ops/rotate-production-secrets.mjs`).
- **Annual**: third-party penetration test. Commission in Q1, completed
  before Q2 board review. Certificate retained in this folder as
  `PEN_TEST_{{yyyy}}.pdf`.
- **Continuous**: CodeQL + Gitleaks on every push; Dependabot enabled.

## 6. Contract variables

- `{{governing_law}}` — usually England & Wales.
- `{{effective_date}}` — customer signature date.
- `{{customer_contact}}` — DPO or privacy contact for the controller.
- `{{customer_hosting_region_preference}}` — EU / UK / US.
