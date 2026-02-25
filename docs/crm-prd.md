# CRM — Product Requirements Document

**Client:** Empire Home Solutions
**Prepared By:** Shaz Iqbal — Online Buzz Marketing Ltd
**Date:** February 2026
**Fixed Price:** £750 (normally £1,500)
**Estimated Timeline:** 2–3 Weeks

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
│   ├── dashboard/
│   ├── customers/
│   ├── jobs/
│   ├── quotes/
│   ├── invoices/
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
  matcher: ['/dashboard/:path*', '/customers/:path*', '/jobs/:path*',
            '/quotes/:path*', '/invoices/:path*', '/settings/:path*'],
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
| PDF Generation | `@react-pdf/renderer` | Server-side quote/invoice PDF generation |

---

## 3. Database Schema

All tables in the `crm` Postgres schema.

### `crm.users`
Managed by Supabase Auth. Two records max (team members).

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
│   ├── useCustomers.ts
│   ├── useJobs.ts
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
    ├── expenses/
    │   ├── ExpenseList.tsx
    │   └── ExpenseForm.tsx
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
| `/customers` | Customer list | Search, filter, paginate |
| `/customers/new` | New customer | Create form |
| `/customers/[id]` | Customer detail | Info, job history, notes, attachments |
| `/customers/[id]/edit` | Edit customer | Edit form |
| `/jobs` | Job list | Filter by status, date |
| `/jobs/new` | New job | Create form, link to customer |
| `/jobs/[id]` | Job detail | Status, notes, expenses, photos, quote/invoice |
| `/jobs/[id]/edit` | Edit job | Edit form |
| `/quotes/[id]` | Quote detail | Line items, PDF preview/download |
| `/invoices` | Invoice list | Filter by status |
| `/invoices/[id]` | Invoice detail | Line items, payment status, PDF |
| `/settings` | Settings | User management, business details |

---

## 6. API Routes

All under `src/app/api/crm/`. Never shared with LP API routes.

| Method | Endpoint | Action |
|---|---|---|
| POST | `/api/crm/customers` | Create customer |
| PATCH | `/api/crm/customers/[id]` | Update customer |
| DELETE | `/api/crm/customers/[id]` | Archive customer |
| POST | `/api/crm/jobs` | Create job |
| PATCH | `/api/crm/jobs/[id]` | Update job / status change |
| POST | `/api/crm/notes` | Add note |
| POST | `/api/crm/quotes` | Create quote |
| POST | `/api/crm/quotes/[id]/convert` | Convert quote → invoice |
| POST | `/api/crm/invoices/[id]/mark-paid` | Mark invoice paid |
| GET | `/api/crm/invoices/[id]/pdf` | Generate + stream PDF |
| GET | `/api/crm/quotes/[id]/pdf` | Generate + stream PDF |
| POST | `/api/crm/expenses` | Log expense |
| POST | `/api/crm/attachments/upload` | Upload file to Supabase Storage |
| DELETE | `/api/crm/attachments/[id]` | Delete file |

---

## 7. Authentication & Security

- **Supabase Auth** — email + password only, no OAuth
- **Two accounts** created by developer at setup, no self-registration
- **`@supabase/ssr`** — session stored in HTTP-only cookies, works in App Router server components
- **Middleware** path matcher protects all CRM routes — unauthenticated users redirect to `/login`
- **Row-Level Security (RLS)** enabled on all `crm.*` tables — authenticated users only
- **Auto sign-out** after 8 hours of inactivity (Supabase JWT expiry)
- **Storage bucket** `crm-uploads` set to private — files served via signed URLs only

---

## 8. Atomic Build Checklist

### Phase 1 — Foundation (Days 1–2)

- [ ] Create `feat/crm-foundation` branch from `feat/paid-lp-foundation`
- [ ] Install dependencies: `@supabase/supabase-js`, `@supabase/ssr`, `@react-pdf/renderer`, `date-fns`
- [ ] Add Supabase env vars to `.env.example`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Create `src/modules/crm/lib/supabase-server.ts` (server client via cookies)
- [ ] Create `src/modules/crm/lib/supabase-browser.ts` (browser client singleton)
- [ ] Write Supabase migration SQL for all `crm.*` tables
- [ ] Enable RLS on all CRM tables with authenticated-user policies
- [ ] Create `crm-uploads` Supabase Storage bucket (private)
- [ ] Create `src/modules/crm/types.ts` with all TypeScript types matching DB schema
- [ ] Add `middleware.ts` with CRM path matcher and session check
- [ ] Create `src/app/(crm)/login/page.tsx` — email + password form
- [ ] Create `src/app/(crm)/layout.tsx` — auth guard + CRM shell render
- [ ] Create `src/modules/crm/components/layout/CrmShell.tsx` — sidebar + topbar
- [ ] Create `src/modules/crm/components/layout/Sidebar.tsx` — nav links
- [ ] Verify `/login` renders independently — no LP layout interference
- [ ] Verify `/dashboard` redirects to `/login` when unauthenticated

### Phase 2 — Customers & Jobs (Days 3–6)

- [ ] Create `src/app/(crm)/customers/page.tsx` — list with search + filter
- [ ] Create `src/app/(crm)/customers/new/page.tsx` — create form
- [ ] Create `src/app/(crm)/customers/[id]/page.tsx` — detail view
- [ ] Create `src/app/(crm)/customers/[id]/edit/page.tsx` — edit form
- [ ] Build `CustomerList.tsx`, `CustomerCard.tsx`, `CustomerForm.tsx`, `CustomerDetail.tsx`
- [ ] API routes: POST/PATCH/DELETE `/api/crm/customers`
- [ ] Create `src/app/(crm)/jobs/page.tsx` — list with status filter + date filter
- [ ] Create `src/app/(crm)/jobs/new/page.tsx` — create form with customer picker
- [ ] Create `src/app/(crm)/jobs/[id]/page.tsx` — detail view
- [ ] Create `src/app/(crm)/jobs/[id]/edit/page.tsx` — edit form
- [ ] Build `JobList.tsx`, `JobForm.tsx`, `JobDetail.tsx`, `JobStatusBadge.tsx`
- [ ] Build `JobCalendar.tsx` — simple weekly view of booked jobs
- [ ] API routes: POST/PATCH `/api/crm/jobs`
- [ ] Build `NoteList.tsx` + `NoteForm.tsx` — shared for customers and jobs
- [ ] API route: POST `/api/crm/notes`

### Phase 3 — Dashboard (Day 7)

- [ ] Create `src/app/(crm)/dashboard/page.tsx`
- [ ] Build `TodaysJobs.tsx` — jobs with `scheduled_date = today`
- [ ] Build `OpenJobsCount.tsx` — count of `enquiry | booked | in_progress`
- [ ] Build `RecentCustomers.tsx` — last 5 added

### Phase 4 — Quotes & Invoices (Days 8–10)

- [ ] Create `src/app/(crm)/quotes/[id]/page.tsx`
- [ ] Build `QuoteBuilder.tsx` — dynamic line items with subtotal/VAT/total calc
- [ ] Build `QuotePdf.tsx` — `@react-pdf/renderer` template with business branding
- [ ] API routes: POST `/api/crm/quotes`, GET `/api/crm/quotes/[id]/pdf`
- [ ] POST `/api/crm/quotes/[id]/convert` — clone quote to invoice, set status
- [ ] Create `src/app/(crm)/invoices/page.tsx` — list with payment status filter
- [ ] Create `src/app/(crm)/invoices/[id]/page.tsx`
- [ ] Build `InvoicePdf.tsx` — same template style as quote PDF
- [ ] Build `invoiceNumber.ts` + `quoteNumber.ts` generators (`INV-2026-0001` format)
- [ ] API routes: POST mark-paid, GET PDF stream

### Phase 5 — Files, Photos & Expenses (Days 11–13)

- [ ] Build `AttachmentUploader.tsx` — drag-and-drop + mobile camera capture
- [ ] Build `PhotoGallery.tsx` — image grid with lightbox
- [ ] Build `FileList.tsx` — PDF/receipt list with download links
- [ ] API route: POST `/api/crm/attachments/upload` → Supabase Storage signed URL
- [ ] API route: DELETE `/api/crm/attachments/[id]`
- [ ] Build `ExpenseForm.tsx` — amount, category, description, receipt upload
- [ ] Build `ExpenseList.tsx` — per-job expense log with total
- [ ] API route: POST `/api/crm/expenses`

### Phase 6 — Polish, QA & Deploy (Days 14–15)

- [ ] Responsive design pass — test on iPhone SE, Pixel 7, iPad
- [ ] Verify sticky-bar from LP does not render on CRM routes
- [ ] Verify GTM/GA4 from LP layout does not fire on CRM routes
- [ ] Check all RLS policies — no data leaks between users
- [ ] Check all Supabase Storage signed URL expiry (1 hour default → extend if needed)
- [ ] Test PDF generation for quote and invoice with sample data
- [ ] Test file upload on mobile (camera capture)
- [ ] Create two user accounts in Supabase Auth dashboard
- [ ] Deploy to Vercel production
- [ ] Smoke test all routes on production URL
- [ ] Handover: credentials, Supabase project access, Vercel project access

---

## 9. Scope Boundaries

### In Scope
Everything listed in Sections 3 and 4 of the SoW plus the additional deliverables.

### Out of Scope
- Customer-facing portal or public URLs
- SMS or email sending
- Payment processing (Stripe etc.)
- Xero / QuickBooks integration
- Multi-company or multi-branch support
- Calendar sync (Google Calendar, iCal)
- Automated reminders or notifications
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
- [ ] Two user accounts created and tested
- [ ] Production deployment live on Vercel
- [ ] Supabase project access transferred / shared with client
- [ ] Vercel project access shared with client
- [ ] `.env.example` updated with all required CRM keys
- [ ] Brief walkthrough video recorded (Loom) covering core workflows
