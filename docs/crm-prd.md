# CRM — Product Requirements Document

**Client:** Empire Home Solutions
**Prepared By:** Shaz Iqbal — Online Buzz Marketing Ltd
**Date:** February 2026
**Fixed Price:** £750 (normally £1,500)
**Estimated Timeline:** 2–3 Weeks

This PRD defines the **MVP delivery** and the **future-ready architecture** required so the CRM can grow into a broader in-house operating system without a rebuild. Not every discovery item is expected in the initial fixed-price build; however, the data model and admin tooling must leave room for expansion.

---

## 0. Product Goal & Operating Model

The CRM should become Empire Home Solutions' internal source of truth for day-to-day operations across management, admin, sales, engineers, accounts, leads, customers, jobs, quotes, invoices, documents, and reporting.

### Product Goal

- Provide a single in-house system for operational activity between staff and customers
- Support multiple services, multiple job types, and expanding service lines over time
- Make ownership visible: who is doing what, for which customer/job, and by when
- Reduce process drift by enforcing required fields, required documents, and stage rules
- Keep the first release practical while ensuring future services/modules can be added without re-platforming

### Internal Roles

The CRM must support role-based access for:

- Management
- Admin
- Sales
- Engineer
- Accounts

Role permissions do not need to be enterprise-grade RBAC in v1, but the schema and UI must support role-specific access and future tightening of permissions.

### Service Coverage

The system must support multiple services and allow more to be added later.

- Existing services
  - Boilers: installs, services, gas safety certificates, repairs
  - Cylinders: vented and unvented
  - Power flushing
  - Plumbing services
- Launching March 2026
  - Air Source Heat Pumps (ASHP)
- Launching Summer 2026
  - Commercial boilers
  - Air conditioning
- Launching Winter 2026/27
  - Solar PV

Each service must support separate job types, pricing logic, document templates, checklists, certificates, required fields, and required attachments/documents.

---

## 1. Isolation Strategy

The CRM must be built as a fully isolated module inside the existing Next.js monorepo. It shares **zero** UI components, routes, or business logic with the public-facing landing pages.

### Core Principle: Route Group Isolation

```
src/app/
├── (lp)/               ← existing public LP — untouched
├── (crm)/              ← new CRM — fully isolated
│   ├── layout.tsx      ← CRM shell (auth guard, sidebar nav)
│   ├── login/
│   ├── leads/
│   ├── dashboard/
│   ├── customers/
│   ├── jobs/
│   ├── calendar/
│   ├── quotes/
│   ├── invoices/
│   ├── staff/
│   ├── reports/
│   └── settings/
```

Using a Next.js route group `(crm)` means:
- No URL prefix collision with `/lp/...` routes
- Separate layout tree — CRM layout never renders on public pages
- CRM can be behind auth middleware without affecting public routes

### Module Isolation

All CRM-specific code lives under `src/modules/crm/`. Nothing inside this directory is imported by any LP or public module.

```
src/modules/
├── lp/                 ← existing LP modules — untouched
├── crm/                ← new CRM modules — isolated
│   ├── components/
│   ├── hooks/
│   ├── lib/
│   └── types.ts
```

### Database Isolation

Supabase schemas use a dedicated `crm` Postgres schema (not `public`) for all CRM tables. This prevents naming conflicts and allows future role-based access control per schema.

### Middleware Isolation

Auth middleware uses a path matcher scoped to `(crm)` routes only. Public LP routes are never touched.

```ts
// middleware.ts
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/leads/:path*',
    '/customers/:path*',
    '/jobs/:path*',
    '/calendar/:path*',
    '/quotes/:path*',
    '/invoices/:path*',
    '/reports/:path*',
    '/staff/:path*',
    '/settings/:path*',
  ],
}
```

---

## 2. Technology Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | Next.js 14 App Router (existing) | No new framework — reuses existing repo |
| Styling | Tailwind CSS (existing) | CRM-specific design tokens scoped to `(crm)` layout |
| Backend | Next.js API Routes | `/app/api/crm/` prefix for all CRM endpoints |
| Database | Supabase (PostgreSQL) | `crm` schema — separate from any future public data |
| Auth | Supabase Auth | Email + password; session cookies via `@supabase/ssr` |
| File Storage | Supabase Storage | `crm-uploads` bucket — photos, receipts, PDFs |
| ORM | Supabase JS Client v2 | Typed queries with auto-generated DB types |
| Hosting | Vercel (existing) | No new hosting — deploys alongside LP site |
| Automation | Next.js cron / scheduled jobs | Reminders, expiry alerts, pipeline follow-ups |
| PDF Generation | `@react-pdf/renderer` | Server-side quote/invoice PDF generation |

---

## 3. Database Schema

All tables in the `crm` Postgres schema.

### `crm.users`
Managed by Supabase Auth. Initial setup may start with two seeded accounts, but the CRM must support additional internal users without schema changes.

### `crm.customers`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| full_name | text | required |
| phone | text | |
| email | text | |
| address_line1 | text | |
| address_line2 | text | |
| city | text | |
| postcode | text | |
| notes | text | general notes field |
| archived | boolean | soft delete |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `crm.jobs`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| customer_id | uuid FK → customers | |
| title | text | |
| description | text | |
| scheduled_date | date | |
| scheduled_time | time | |
| status | enum | `enquiry \| booked \| in_progress \| completed \| invoiced` |
| assigned_engineer | text | name string for now |
| created_by | uuid FK → auth.users | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `crm.notes`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| entity_type | text | `customer` or `job` |
| entity_id | uuid | FK to relevant table |
| body | text | note content |
| created_by | uuid FK → auth.users | |
| created_at | timestamptz | |

### `crm.quotes`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| job_id | uuid FK → jobs | |
| customer_id | uuid FK → customers | |
| quote_number | text | auto-generated `Q-YYYY-NNNN` |
| line_items | jsonb | `[{ description, qty, unit_price }]` |
| subtotal | numeric | |
| vat_rate | numeric | default 0.20 |
| total | numeric | |
| status | enum | `draft \| sent \| accepted \| declined` |
| valid_until | date | |
| created_at | timestamptz | |

### `crm.invoices`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| quote_id | uuid FK → quotes nullable | converted from quote |
| job_id | uuid FK → jobs | |
| customer_id | uuid FK → customers | |
| invoice_number | text | auto-generated `INV-YYYY-NNNN` |
| line_items | jsonb | same structure as quotes |
| subtotal | numeric | |
| vat_rate | numeric | |
| total | numeric | |
| status | enum | `unpaid \| paid \| overdue \| void` |
| due_date | date | |
| paid_at | timestamptz | nullable |
| created_at | timestamptz | |

### `crm.expenses`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| job_id | uuid FK → jobs nullable | |
| description | text | |
| amount | numeric | |
| category | text | `materials \| travel \| subcontractor \| other` |
| receipt_url | text | Supabase Storage path |
| created_by | uuid FK → auth.users | |
| created_at | timestamptz | |

### `crm.attachments`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| entity_type | text | `job \| customer \| invoice \| quote` |
| entity_id | uuid | |
| file_name | text | |
| file_url | text | Supabase Storage path |
| file_type | text | `image \| pdf \| receipt` |
| created_by | uuid FK → auth.users | |
| created_at | timestamptz | |

### `crm.user_profiles`
Stores internal staff profile data linked to Supabase Auth users.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK → auth.users | |
| role | enum | `management \| admin \| sales \| engineer \| accounts` |
| full_name | text | |
| phone | text | |
| email | text | |
| emergency_contact | text | optional |
| agreed_hours | text | |
| pay_type | text | `salary \| day_rate \| commission \| mixed` |
| pay_notes | text | stores agreed day rates / salary / overtime summary |
| contract_file_url | text | attachment or storage path |
| active | boolean | soft deactivate |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `crm.user_certifications`
Tracks staff certifications, IDs, qualifications, and expiry reminders.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_profile_id | uuid FK → user_profiles | |
| title | text | |
| category | text | `qualification \| id \| compliance \| training` |
| issuer | text | |
| issue_date | date | |
| expiry_date | date | |
| reminder_days_before | int | default 30 |
| file_url | text | storage path |
| notes | text | |
| created_at | timestamptz | |

### `crm.services`
Master list of business services.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| slug | text unique | e.g. `boilers`, `ashp`, `ac` |
| name | text | |
| active | boolean | |
| launch_date | date | optional |
| created_at | timestamptz | |

### `crm.job_types`
Configurable job categories scoped to a service.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| service_id | uuid FK → services | |
| slug | text | |
| name | text | |
| description | text | |
| active | boolean | |
| created_at | timestamptz | |

### `crm.leads`
Lead pipeline before a job becomes active work.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| customer_id | uuid FK → customers nullable | created once known |
| service_id | uuid FK → services nullable | |
| job_type_id | uuid FK → job_types nullable | |
| status | enum | `new \| contacted \| follow_up \| survey_booked \| quoted \| accepted \| booked \| completed \| lost` |
| lost_reason | text | nullable |
| source | text | Google, Meta, referral, leaflet, platform etc. |
| assigned_to | uuid FK → auth.users nullable | sales/admin owner |
| next_action_at | timestamptz | nullable |
| notes | text | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `crm.customer_assets`
Tracks installed systems/equipment for a customer/property.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| customer_id | uuid FK → customers | |
| service_id | uuid FK → services nullable | |
| asset_type | text | `combi \| system \| heat_only \| ashp \| ac \| commercial \| solar` |
| make | text | |
| model | text | |
| serial_number | text | |
| install_date | date | |
| service_due_date | date | |
| warranty_end_date | date | |
| cylinder_type | text | nullable |
| notes | text | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `crm.appointments`
Scheduling table for calls, follow-ups, surveys, bookings, reminders, and other calendar items.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| customer_id | uuid FK → customers nullable | |
| lead_id | uuid FK → leads nullable | |
| job_id | uuid FK → jobs nullable | |
| assigned_to | uuid FK → auth.users nullable | |
| type | text | `call \| follow_up \| survey \| booking \| meeting \| reminder` |
| title | text | |
| starts_at | timestamptz | |
| ends_at | timestamptz | |
| status | text | `scheduled \| completed \| cancelled` |
| reminder_offset_minutes | int | nullable |
| recurrence_rule | text | nullable for annual services / warranty reminders |
| created_at | timestamptz | |

### `crm.payments`
Tracks payment requests and receipts separately from invoice status.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| invoice_id | uuid FK → invoices nullable | |
| quote_id | uuid FK → quotes nullable | deposit before invoice if needed |
| customer_id | uuid FK → customers | |
| payment_type | text | `deposit \| stage \| final \| finance` |
| amount | numeric | |
| status | text | `requested \| received \| failed \| refunded` |
| requested_at | timestamptz | |
| received_at | timestamptz | nullable |
| reference | text | bank ref / provider ref |
| notes | text | |
| created_at | timestamptz | |

### `crm.products`
Materials, labour items, and package components used in quotes/jobs.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| service_id | uuid FK → services nullable | |
| supplier_id | uuid FK → suppliers nullable | |
| category | text | |
| name | text | |
| sku | text | nullable |
| unit_cost | numeric | |
| markup_percent | numeric | nullable |
| sell_price | numeric | |
| vat_category | text | `vat_exempt \| standard_20 \| reverse_charge` |
| active | boolean | |
| updated_at | timestamptz | |

### `crm.suppliers`
Contact and pricing source data for suppliers and partners.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| name | text | |
| category | text | `materials \| manufacturer \| referral \| compliance \| software \| other` |
| contact_name | text | |
| email | text | |
| phone | text | |
| pricing_last_updated_at | timestamptz | nullable |
| notes | text | |
| created_at | timestamptz | |

### `crm.quote_templates`
Saved quote structures and pricing templates per service/job type.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| service_id | uuid FK → services nullable | |
| job_type_id | uuid FK → job_types nullable | |
| name | text | |
| description | text | |
| line_items | jsonb | includes cost, markup, sell price, VAT category |
| optional_extras | jsonb | selectable customer options |
| payment_terms | jsonb | deposit / completion / finance |
| active | boolean | |
| created_at | timestamptz | |

### `crm.document_templates`
Template catalogue for quotes, invoices, certificates, compliance forms, and branded documents.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| service_id | uuid FK → services nullable | |
| job_type_id | uuid FK → job_types nullable | |
| category | text | `quote \| invoice \| certificate \| compliance \| checklist` |
| name | text | |
| template_key | text | code reference or renderer key |
| active | boolean | |
| created_at | timestamptz | |

### `crm.custom_field_definitions`
Manager-configurable dropdowns and custom fields to future-proof the CRM.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| entity_type | text | `lead \| customer \| asset \| job \| quote \| invoice` |
| service_id | uuid FK → services nullable | |
| job_type_id | uuid FK → job_types nullable | |
| field_key | text unique | |
| label | text | |
| field_type | text | `text \| textarea \| number \| select \| multiselect \| date \| boolean \| file` |
| options | jsonb | dropdown values |
| required | boolean | |
| active | boolean | |
| sort_order | int | |
| created_at | timestamptz | |

### `crm.custom_field_values`
Stores values entered against manager-configured fields.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| field_definition_id | uuid FK → custom_field_definitions | |
| entity_type | text | mirrors field entity type |
| entity_id | uuid | record being extended |
| value_json | jsonb | flexible storage for selected value(s) |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `crm.required_document_rules`
Defines attachments/documents/checklists required before a record can progress.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| entity_type | text | `lead \| job \| asset` |
| service_id | uuid FK → services nullable | |
| job_type_id | uuid FK → job_types nullable | |
| pipeline_stage | text | nullable |
| document_type | text | |
| required | boolean | |
| due_within_days | int | nullable |
| active | boolean | |
| created_at | timestamptz | |

---

## 4. Module Structure

```
src/modules/crm/
├── types.ts                   ← all CRM TypeScript types
├── lib/
│   ├── supabase-server.ts     ← server-side Supabase client
│   ├── supabase-browser.ts    ← browser Supabase client
│   ├── invoiceNumber.ts       ← INV-YYYY-NNNN generator
│   ├── quoteNumber.ts         ← Q-YYYY-NNNN generator
│   └── formatCurrency.ts      ← GBP formatting util
├── hooks/
│   ├── useLeads.ts
│   ├── useCustomers.ts
│   ├── useJobs.ts
│   ├── useAppointments.ts
│   ├── useNotes.ts
│   └── useAttachments.ts
└── components/
    ├── layout/
    │   ├── CrmShell.tsx        ← sidebar + topbar shell
    │   ├── Sidebar.tsx
    │   └── TopBar.tsx
    ├── customers/
    │   ├── CustomerList.tsx
    │   ├── CustomerCard.tsx
    │   ├── CustomerForm.tsx
    │   └── CustomerDetail.tsx
    ├── jobs/
    │   ├── JobList.tsx
    │   ├── JobCard.tsx
    │   ├── JobForm.tsx
    │   ├── JobDetail.tsx
    │   ├── JobStatusBadge.tsx
    │   └── JobCalendar.tsx
    ├── leads/
    │   ├── LeadList.tsx
    │   ├── LeadForm.tsx
    │   └── LeadPipelineBoard.tsx
    ├── quotes/
    │   ├── QuoteBuilder.tsx
    │   ├── QuoteLineItems.tsx
    │   └── QuotePdf.tsx
    ├── invoices/
    │   ├── InvoiceList.tsx
    │   ├── InvoiceDetail.tsx
    │   └── InvoicePdf.tsx
    ├── notes/
    │   ├── NoteList.tsx
    │   └── NoteForm.tsx
    ├── attachments/
    │   ├── AttachmentUploader.tsx
    │   ├── PhotoGallery.tsx
    │   └── FileList.tsx
    ├── scheduling/
    │   ├── AppointmentForm.tsx
    │   ├── CalendarView.tsx
    │   └── ReminderRules.tsx
    ├── expenses/
    │   ├── ExpenseList.tsx
    │   └── ExpenseForm.tsx
    ├── staff/
    │   ├── StaffList.tsx
    │   ├── StaffProfile.tsx
    │   └── CertificationList.tsx
    ├── settings/
    │   ├── ServiceSettings.tsx
    │   ├── JobTypeSettings.tsx
    │   ├── CustomFieldBuilder.tsx
    │   └── RequiredDocumentRules.tsx
    ├── catalog/
    │   ├── ProductList.tsx
    │   ├── SupplierList.tsx
    │   └── QuoteTemplateList.tsx
    ├── reports/
        ├── RevenueReport.tsx
        ├── ConversionReport.tsx
        └── EngineerKpiReport.tsx
    └── dashboard/
        ├── TodaysJobs.tsx
        ├── OpenJobsCount.tsx
        └── RecentCustomers.tsx
```

---

## 5. Route Structure

All routes under `src/app/(crm)/`. The `(crm)` group prefix does not appear in URLs.

| URL | Page | Description |
|---|---|---|
| `/login` | Login page | Supabase Auth email + password |
| `/dashboard` | Dashboard | Today's jobs, stats, recent customers |
| `/leads` | Lead pipeline | New leads, follow-ups, surveys, quoted, lost reasons |
| `/customers` | Customer list | Search, filter, paginate |
| `/customers/new` | New customer | Create form |
| `/customers/[id]` | Customer detail | Info, job history, notes, attachments |
| `/customers/[id]/edit` | Edit customer | Edit form |
| `/jobs` | Job list | Filter by status, date |
| `/jobs/new` | New job | Create form, link to customer |
| `/jobs/[id]` | Job detail | Status, notes, expenses, photos, quote/invoice |
| `/jobs/[id]/edit` | Edit job | Edit form |
| `/calendar` | Calendar / scheduling | Calls, surveys, bookings, reminders, meetings |
| `/quotes/[id]` | Quote detail | Line items, PDF preview/download |
| `/invoices` | Invoice list | Filter by status |
| `/invoices/[id]` | Invoice detail | Line items, payment status, PDF |
| `/staff` | Staff directory | Profiles, roles, certifications, expiry tracking |
| `/reports` | Reporting | Revenue, conversion, job, service, engineer KPIs |
| `/settings` | Settings | User management, services, job types, templates, required fields/docs |

---

## 6. API Routes

All under `src/app/api/crm/`. Never shared with LP API routes.

| Method | Endpoint | Action |
|---|---|---|
| POST | `/api/crm/customers` | Create customer |
| PATCH | `/api/crm/customers/[id]` | Update customer |
| DELETE | `/api/crm/customers/[id]` | Archive customer |
| POST | `/api/crm/leads` | Create lead |
| PATCH | `/api/crm/leads/[id]` | Update lead / stage / ownership |
| POST | `/api/crm/jobs` | Create job |
| PATCH | `/api/crm/jobs/[id]` | Update job / status change |
| POST | `/api/crm/notes` | Add note |
| POST | `/api/crm/appointments` | Create appointment / reminder / survey |
| PATCH | `/api/crm/appointments/[id]` | Update or complete calendar item |
| POST | `/api/crm/quotes` | Create quote |
| POST | `/api/crm/quotes/[id]/convert` | Convert quote → invoice |
| POST | `/api/crm/invoices/[id]/mark-paid` | Mark invoice paid |
| GET | `/api/crm/invoices/[id]/pdf` | Generate + stream PDF |
| GET | `/api/crm/quotes/[id]/pdf` | Generate + stream PDF |
| POST | `/api/crm/expenses` | Log expense |
| POST | `/api/crm/payments` | Request / record payment |
| POST | `/api/crm/attachments/upload` | Upload file to Supabase Storage |
| DELETE | `/api/crm/attachments/[id]` | Delete file |
| POST | `/api/crm/assets` | Create customer asset |
| PATCH | `/api/crm/assets/[id]` | Update asset/service dates/warranty |
| POST | `/api/crm/settings/services` | Create or update services/job types |
| POST | `/api/crm/settings/custom-fields` | Create configurable fields/dropdowns |
| POST | `/api/crm/settings/document-rules` | Create required-document rules |
| GET | `/api/crm/reports/summary` | KPI summary by service/date/status |

---

## 7. Authentication & Security

- **Supabase Auth** — email + password only, no OAuth
- **Role-based access model** for management, admin, sales, engineer, and accounts
- **Accounts are provisioned internally** by management/developer; no self-registration
- **Initial setup may seed two accounts**, but the CRM must support additional users and role changes
- **`@supabase/ssr`** — session stored in HTTP-only cookies, works in App Router server components
- **Middleware** path matcher protects all CRM routes — unauthenticated users redirect to `/login`
- **Row-Level Security (RLS)** enabled on all `crm.*` tables — authenticated users only
- **Auto sign-out** after 8 hours of inactivity (Supabase JWT expiry)
- **Storage bucket** `crm-uploads` set to private — files served via signed URLs only
- **Manager-only settings screens** control service catalog, job types, dropdowns, required fields, and required document rules

---

## 8. Atomic Build Checklist

### Phase 1 — Foundation (Days 1–2)

- [ ] Create `feat/crm-foundation` branch from `feat/paid-lp-foundation`
- [ ] Install dependencies: `@supabase/supabase-js`, `@supabase/ssr`, `@react-pdf/renderer`, `date-fns`
- [ ] Add Supabase env vars to `.env.example`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Create `src/modules/crm/lib/supabase-server.ts` (server client via cookies)
- [ ] Create `src/modules/crm/lib/supabase-browser.ts` (browser client singleton)
- [ ] Write Supabase migration SQL for all `crm.*` tables including services, job types, leads, appointments, assets, user profiles, custom fields, and required document rules
- [ ] Enable RLS on all CRM tables with authenticated-user policies
- [ ] Create `crm-uploads` Supabase Storage bucket (private)
- [ ] Create `src/modules/crm/types.ts` with all TypeScript types matching DB schema
- [ ] Add `middleware.ts` with CRM path matcher and session check
- [ ] Create `src/app/(crm)/login/page.tsx` — email + password form
- [ ] Create `src/app/(crm)/layout.tsx` — auth guard + CRM shell render
- [ ] Create `src/modules/crm/components/layout/CrmShell.tsx` — sidebar + topbar
- [ ] Create `src/modules/crm/components/layout/Sidebar.tsx` — nav links
- [ ] Seed service catalog and initial job type categories for boilers, cylinders, power flushing, plumbing, ASHP, commercial boilers, AC, and solar
- [ ] Create role mapping for management/admin/sales/engineer/accounts
- [ ] Create manager settings foundation for dropdowns, required fields, and required document rules
- [ ] Verify `/login` renders independently — no LP layout interference
- [ ] Verify `/dashboard` redirects to `/login` when unauthenticated

### Phase 2 — Leads, Customers & Jobs (Days 3–6)

- [ ] Create `src/app/(crm)/leads/page.tsx` — lead pipeline with stage filters
- [ ] Create `crm.leads` workflow: new lead → follow-up → survey booked → quoted → accepted/lost
- [ ] Add lead source tracking, ownership, next action date, and lost reasons
- [ ] Create `src/app/(crm)/customers/page.tsx` — list with search + filter
- [ ] Create `src/app/(crm)/customers/new/page.tsx` — create form
- [ ] Create `src/app/(crm)/customers/[id]/page.tsx` — detail view
- [ ] Create `src/app/(crm)/customers/[id]/edit/page.tsx` — edit form
- [ ] Build `CustomerList.tsx`, `CustomerCard.tsx`, `CustomerForm.tsx`, `CustomerDetail.tsx`
- [ ] Add customer profiling fields: property type, occupancy type, source, linked referrals, linked files
- [ ] Add customer asset panel with make/model/serial/service due/warranty data
- [ ] API routes: POST/PATCH/DELETE `/api/crm/customers`
- [ ] Create `src/app/(crm)/jobs/page.tsx` — list with status filter + date filter
- [ ] Create `src/app/(crm)/jobs/new/page.tsx` — create form with customer picker
- [ ] Create `src/app/(crm)/jobs/[id]/page.tsx` — detail view
- [ ] Create `src/app/(crm)/jobs/[id]/edit/page.tsx` — edit form
- [ ] Build `JobList.tsx`, `JobForm.tsx`, `JobDetail.tsx`, `JobStatusBadge.tsx`
- [ ] Build `JobCalendar.tsx` — weekly/day view of booked jobs, surveys, follow-ups, and reminders
- [ ] Add service + job type selection to jobs
- [ ] Enforce required fields/documents/checklists before selected stage transitions
- [ ] API routes: POST/PATCH `/api/crm/jobs`
- [ ] Build `NoteList.tsx` + `NoteForm.tsx` — shared for customers and jobs
- [ ] API route: POST `/api/crm/notes`

### Phase 3 — Dashboard, Scheduling & Tasks (Day 7)

- [ ] Create `src/app/(crm)/dashboard/page.tsx`
- [ ] Build `TodaysJobs.tsx` — jobs with `scheduled_date = today`
- [ ] Build `OpenJobsCount.tsx` — count of `enquiry | booked | in_progress`
- [ ] Build `RecentCustomers.tsx` — last 5 added
- [ ] Create `src/app/(crm)/calendar/page.tsx`
- [ ] Build appointment/task scheduling for calls, follow-ups, surveys, bookings, meetings, and reminders
- [ ] Support recurring reminders for annual services and warranty expiry prompts
- [ ] Add engineer allocation / availability view

### Phase 4 — Quotes, Invoices & Templates (Days 8–10)

- [ ] Create `src/app/(crm)/quotes/[id]/page.tsx`
- [ ] Build `QuoteBuilder.tsx` — dynamic line items with subtotal/VAT/total calc
- [ ] Build `QuotePdf.tsx` — `@react-pdf/renderer` template with business branding
- [ ] Add quote templates per service/job type with optional extras and visible/internal pricing split
- [ ] Support VAT categories and staged payment terms in quote builder
- [ ] API routes: POST `/api/crm/quotes`, GET `/api/crm/quotes/[id]/pdf`
- [ ] POST `/api/crm/quotes/[id]/convert` — clone quote to invoice, set status
- [ ] Create `src/app/(crm)/invoices/page.tsx` — list with payment status filter
- [ ] Create `src/app/(crm)/invoices/[id]/page.tsx`
- [ ] Build `InvoicePdf.tsx` — same template style as quote PDF
- [ ] Build `invoiceNumber.ts` + `quoteNumber.ts` generators (`INV-2026-0001` format)
- [ ] API routes: POST mark-paid, GET PDF stream
- [ ] Add deposit / staged / final payment records linked to invoices and quotes

### Phase 5 — Files, Assets, Payments & Expenses (Days 11–13)

- [ ] Build `AttachmentUploader.tsx` — drag-and-drop + mobile camera capture
- [ ] Build `PhotoGallery.tsx` — image grid with lightbox
- [ ] Build `FileList.tsx` — PDF/receipt list with download links
- [ ] API route: POST `/api/crm/attachments/upload` → Supabase Storage signed URL
- [ ] API route: DELETE `/api/crm/attachments/[id]`
- [ ] Support customer, asset, quote, invoice, and job documents including certificates/compliance files
- [ ] Add digital signature capture for customer sign-off as a future-ready attachment type
- [ ] Build `ExpenseForm.tsx` — amount, category, description, receipt upload
- [ ] Build `ExpenseList.tsx` — per-job expense log with total
- [ ] API route: POST `/api/crm/expenses`
- [ ] Build `crm.payments` UI for requested vs received amounts and references

### Phase 6 — Staff, Catalog, Reporting & Admin Config (Days 14–15)

- [ ] Create `src/app/(crm)/staff/page.tsx` — staff list with role filters
- [ ] Add staff profile fields for contracts, pay notes, hours, certificates, IDs, and reminders
- [ ] Create `src/app/(crm)/reports/page.tsx`
- [ ] Build reporting summaries for revenue, expenses, profit, conversion, and engineer KPIs
- [ ] Create basic catalog management for products/materials, suppliers, and quote templates
- [ ] Build manager settings screens for services, job types, custom fields, and required documents

### Phase 7 — Polish, QA & Deploy (Days 16–17)

- [ ] Responsive design pass — test on iPhone SE, Pixel 7, iPad
- [ ] Verify sticky-bar from LP does not render on CRM routes
- [ ] Verify GTM/GA4 from LP layout does not fire on CRM routes
- [ ] Check all RLS policies — no data leaks between users
- [ ] Check all Supabase Storage signed URL expiry (1 hour default → extend if needed)
- [ ] Test PDF generation for quote and invoice with sample data
- [ ] Test file upload on mobile (camera capture)
- [ ] Create initial user accounts in Supabase Auth dashboard and verify role permissions
- [ ] Deploy to Vercel production
- [ ] Smoke test all routes on production URL
- [ ] Handover: credentials, Supabase project access, Vercel project access

---

## 9. Scope Boundaries

### MVP In Scope

- Core CRM foundation inside `src/app/(crm)` and `src/modules/crm`
- Role-based internal auth and protected CRM routes
- Lead, customer, job, note, attachment, quote, invoice, expense, payment, and appointment management
- Service catalog and job type structure
- Customer assets and related documents
- Manager-configurable dropdowns / custom fields / required-document rules
- Dashboard and summary reporting
- PDF generation for quotes and invoices

### Future-Ready Requirements Captured In This PRD

These requirements must be represented in the schema and architecture even if the first release ships with a lighter UI:

- Staff profiling, certifications, contracts, and expiry reminders
- Product/materials/suppliers catalog
- Quote templates, document templates, branded certificates, and compliance forms
- Service-specific checklists and progression rules
- Recurring reminders for servicing, warranty expiry, and follow-up actions
- Revenue, conversion, engineer, service, and marketing reporting foundations

### Explicitly Deferred / Phase 2+

- Customer self-service portal
- Two-way email inbox sync inside CRM
- Two-way SMS / WhatsApp messaging inside CRM
- Live payment processing (Stripe, direct debit setup, payment links)
- Accounting platform integrations (Xero / QuickBooks)
- Barcode scanning
- Automated certificate generation for every service type
- Affiliate / referral commission automation
- Full marketing platform cost ingestion and attribution reconciliation
- Google Calendar / iCal sync
- Advanced workflow automation beyond reminder/task rules

### Out of Scope
- Multi-company or multi-branch support
- Any feature not explicitly listed above

All out-of-scope requests will be quoted separately before any work begins.

---

## 10. Environment Variables Required

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Already exists from LP build
NEXT_PUBLIC_SITE_URL=
```

---

## 11. Constraints & Non-Negotiables

| Constraint | Reason |
|---|---|
| All CRM code under `src/modules/crm/` and `src/app/(crm)/` | Zero interference with LP codebase |
| All CRM API routes under `src/app/api/crm/` | Namespace separation |
| All DB tables in `crm` Postgres schema | Prevent naming conflicts |
| No LP components imported into CRM | Maintain isolation |
| No CRM components imported into LP | Maintain isolation |
| Supabase Storage bucket private | No public file URLs |
| RLS enabled on all CRM tables | Security baseline |
| Middleware path matcher scoped to CRM routes only | LP performance unaffected |

---

## 12. Payment Terms

| Milestone | Amount |
|---|---|
| Project start (deposit) | £450 (60%) |
| Delivery / go-live | £300 (40%) |

Alternatively: 100% upfront preferred.

Full IP and source code transfers to client upon final payment.

---

## 13. Delivery Checklist (Handover)

- [ ] All features listed in Section 8 complete and QA'd
- [ ] Initial internal user accounts created and tested with role permissions
- [ ] Production deployment live on Vercel
- [ ] Supabase project access transferred / shared with client
- [ ] Vercel project access shared with client
- [ ] `.env.example` updated with all required CRM keys
- [ ] Brief walkthrough video recorded (Loom) covering core workflows
