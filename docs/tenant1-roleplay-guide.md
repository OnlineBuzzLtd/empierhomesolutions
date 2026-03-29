# Tenant 1 Roleplay Guide

Use this guide when showing buyers how the live CRM feels in a realistic heating and plumbing business.

## Live URL

- `https://empire-home-solutions.vercel.app/login`

## Logins

Core production users:

- Admin: `admin@empirehomesolutions.local` / `Empire-Admin-2026!`
- Engineer: `engineer@empirehomesolutions.local` / `Empire-Engineer-2026!`

Additional seeded staff:

- Ops: `ops@empirehomesolutions.local` / `Empire-Staff-2026!`
- Sales: `sales@empirehomesolutions.local` / `Empire-Staff-2026!`
- Accounts: `accounts@empirehomesolutions.local` / `Empire-Staff-2026!`
- Engineer: `luke.bennett@empirehomesolutions.local` / `Empire-Staff-2026!`
- Engineer: `amina.rahman@empirehomesolutions.local` / `Empire-Staff-2026!`

## What Is Seeded

Tenant 1 has been reset to live-looking production data for the next 14 days:

- 20 customers
- 10 leads
- 16 jobs
- 16 appointments
- 11 quotes
- 3 invoices
- 1 payment
- notes, photos/files, customer assets, job phases, variations, hazards, checklists, certificates, purchase orders, and supplier reconciliation

The old tenant-1 demo records and old roleplay jobs were removed before this seed was loaded.

## Best Journeys To Demo

### 1. Same-day repair job

Use:

- Customer: `Hannah Mercer`
- Job: `No hot water and pressure loss diagnostic`

Why it works:

- in-progress job
- engineer notes and photos
- urgent repair context
- good for showing how office and engineer share one record

### 2. Service plus upsell

Use:

- Customer: `Peter Wills`
- Job: `Annual boiler service and smart thermostat survey`

Why it works:

- routine visit
- easy to explain
- good for showing notes, assets, follow-on quoting, and customer history

### 3. Completed small plumbing repair

Use:

- Customer: `Chloe Abrams`
- Job: `Stopcock replacement and kitchen leak trace`

Why it works:

- completed same-day repair
- accepted quote history
- expense logged
- simple completed-job story

### 4. Boiler install workflow

Use:

- Customer: `Farah Khan`
- Job: `Vaillant combi swap and flue relocation`

Why it works:

- install-style booking
- multi-step job delivery
- quote-to-job story
- ideal for showing a bigger-value workflow

### 5. Landlord compliance

Use:

- Customer: `Daniel Brooks`
- Job: `Landlord gas safety certificate and boiler service`

Why it works:

- landlord scenario
- compliance-focused
- certificate/checklist discussion is easy here

### 6. Commercial survey

Use:

- Customer: `Harper Estates`
- Lead: commercial survey booked

Why it works:

- shows the CRM is not only domestic
- good for talking through surveys, quoting, and managed-property work

### 7. Open sales pipeline

Use the leads page for:

- `Sarah Wood`
- `Imran Qureshi`
- `Reece Talbot`
- `Harper Estates`

Why it works:

- mix of new, contacted, follow-up, and survey-booked leads
- shows different enquiry quality and next-action handling

## Suggested Demo Flow

1. Log in as admin.
2. Open `Leads` and show fresh pipeline activity.
3. Open `Customers` and show sites, contacts, notes, and files.
4. Open `Jobs` and pick `Hannah Mercer` or `Farah Khan`.
5. Sign in as an engineer in a second browser or incognito window.
6. Add a note or attachment on the same job.
7. Go back to admin and show the update appearing on the same record.
8. Open `Calendar` to show the next 14 days of live work.
9. Open a quote/invoice journey for one of the install or completed jobs.

## If You Need To Rebuild Tenant 1

Run:

```bash
node scripts/tenant1-production-scenarios-seed.mjs
```

What it does:

- wipes tenant-1 operational CRM data
- keeps tenant 1 and live staff accounts
- rebuilds realistic production scenarios for buyer roleplay

Only run this if you intentionally want to replace the current tenant-1 live scenario set.
