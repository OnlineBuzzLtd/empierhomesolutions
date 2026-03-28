# CRM SaaS + Fergus Launch PRD

**Product:** Empire CRM to Multi-Tenant SaaS CRM  
**Prepared For:** Internal product and engineering planning  
**Date:** March 27, 2026  
**Status:** Master implementation PRD

## Summary

This PRD replaces the earlier "launch-gap only" framing with a two-stage product plan:

1. Convert the current single-business CRM into a shared-app, shared-database multi-tenant SaaS.
2. Preserve Empire Home Solutions as tenant one during that migration.
3. Use the same tenant-safe CRM as the product new businesses sign up to.
4. Only after tenancy is in place, upgrade the CRM with the launch-critical Fergus-style operational features needed for UK heating and plumbing firms with 1-50 engineers.

"Duplicate the CRM" does **not** mean maintaining multiple codebases or spinning up a separate app per customer. It means productizing the current CRM into a reusable SaaS platform with tenant-scoped data, configuration, branding, access control, numbering, and onboarding.

## Product Goal

Build a tenant-safe field-service CRM SaaS that:

- keeps Empire Home Solutions live as the first customer
- allows new businesses to onboard into their own isolated CRM workspace
- supports UK heating and plumbing operations end to end
- closes the launch-critical operational gaps versus Fergus
- avoids rewriting Fergus-gap features later because they were built on a single-tenant foundation

## Current State

The current CRM already provides meaningful operational coverage:

- leads, customers, jobs, calendar, quotes, invoices, payments, expenses, notes, attachments
- staff roles, reporting, services, job types, custom fields, required document rules
- PDF generation for quotes and invoices
- demo mode and seeded CRM data

The current system is still fundamentally single-tenant:

- CRM data lives in one shared `crm` schema without tenant partitioning
- most tables do not carry `tenant_id`
- row-level security assumes "authenticated CRM user" rather than tenant membership
- sequences are global rather than tenant-scoped
- the CRM shell and metadata are hardcoded to Empire branding
- user profile records are treated as global CRM staff rather than tenant memberships

Because of that, tenancy must be implemented before any deeper Fergus-parity workflow work.

## Architecture Decision

The target architecture is:

- one shared SaaS app codebase
- one shared database
- tenant-scoped data isolation enforced in schema design, API resolution, storage paths, and RLS

Empire Home Solutions remains active as tenant one. All existing CRM records are migrated into that tenant before new customer onboarding is opened.

## Phase 1: Tenant Extraction and SaaS Base

### Required Outcome

Phase 1 is complete only when:

- Empire Home Solutions remains fully intact as an existing tenant
- a new business can be created as a separate CRM tenant on the same product
- no CRM user can read or mutate another tenant's records
- branding, numbering, document identity, and settings are tenant-owned
- new tenant onboarding can create a usable default CRM workspace

### Core Product Changes

#### 1. Tenant domain model

Introduce `crm.tenants` as the top-level business/workspace record.

Minimum fields:

- `id`
- `slug`
- `name`
- `status`
- `created_at`
- `updated_at`

Status must support:

- `active`
- `suspended`
- `trial`
- `archived`

#### 2. Tenant membership model

Introduce `crm.tenant_memberships` so access is tenant-bound rather than globally bound to `auth.users`.

Minimum fields:

- `id`
- `tenant_id`
- `user_id`
- `role`
- `membership_status`
- `is_owner`
- `created_at`
- `updated_at`

Rules:

- a user can belong to multiple tenants in future
- v1 session behavior can assume one active tenant at a time
- authorization decisions must use membership plus tenant scope, not user identity alone

#### 3. Tenant settings and branding

Introduce:

- `crm.tenant_settings`
- `crm.tenant_branding`

These records must own:

- business name
- logo
- primary contact details
- registered address
- VAT registration number
- Gas Safe number
- invoice and quote footers
- certificate headers
- default payment terms
- brand colors where needed for PDF/UI identity

Hardcoded Empire naming must be removed from the CRM shell and metadata and replaced with runtime tenant branding.

#### 4. Tenant-scoped CRM data

Add `tenant_id` to every CRM-owned table and every new CRM table going forward.

This includes, at minimum:

- `user_profiles`
- `services`
- `job_types`
- `customers`
- `leads`
- `customer_assets`
- `jobs`
- `notes`
- `appointments`
- `quotes`
- `invoices`
- `payments`
- `expenses`
- `attachments`
- `custom_field_definitions`
- `custom_field_values`
- `required_document_rules`
- `suppliers`
- `products`
- `quote_templates`
- `user_certifications`
- `product_addons`
- `ai_conversations`
- `ai_messages`
- `ai_actions`
- `ai_crm_impacts`
- `number_sequences`

Rules:

- `tenant_id` is required for all live records
- foreign keys must remain tenant-consistent
- all list and detail queries must resolve the active tenant before loading data
- all mutation routes must validate the target record belongs to the active tenant

#### 5. Auth and session resolution

Refactor auth/session behavior so every CRM request resolves:

- authenticated user
- active tenant
- user's membership and role inside that tenant

The CRM should not load tenant-owned records until tenant context is resolved.

V1 behavior:

- first membership becomes the default active tenant
- active tenant can be stored in session, cookie, or server-resolved preference
- tenant switching UI can be deferred if users are expected to belong to one tenant at first

#### 6. Tenant-safe RLS

RLS must be rewritten from broad authenticated-user access to tenant-scoped access.

Principles:

- read policies require active membership in the row's tenant
- write policies require active membership in the row's tenant plus role checks where needed
- manager/admin privileges apply only inside the active tenant
- no policy should allow a user to access records from another tenant even if table names are shared

#### 7. Tenant-scoped numbering

Sequences for quotes, invoices, certificates, and purchase orders must be tenant-scoped.

Requirements:

- numbering uniqueness is enforced within a tenant
- numbering can repeat across tenants if desired
- sequence generators accept `tenant_id` as part of the key
- migrated Empire records preserve existing numbers

#### 8. Tenant-prefixed storage

All storage paths must be tenant-prefixed.

Path pattern:

- `crm-uploads/{tenant_id}/{entity_type}/{entity_id}/...`

Requirements:

- signed URLs must only expose files for the active tenant
- upload handlers must write into the active tenant path automatically
- legacy Empire files must be migrated or remapped into tenant one paths

#### 9. Tenant onboarding

Add onboarding flow to create a fresh CRM workspace for a new business.

V1 onboarding can be admin-assisted, but the workflow must support later self-serve signup.

Onboarding steps:

1. Create tenant.
2. Create or link first owner/admin user.
3. Create tenant membership.
4. Seed default services, job types, templates, settings, required document rules, and numbering records.
5. Create initial branding/business profile.

#### 10. Demo mode isolation

Demo mode must be tenant-aware.

Rules:

- demo data is always scoped to a tenant
- demo records never bleed across tenants
- demo-only users must remain constrained to their tenant's demo workspace

### Empire Migration Requirements

Empire Home Solutions must be preserved as tenant one.

Migration requirements:

- create tenant record for Empire
- backfill `tenant_id` onto all current Empire CRM records
- migrate existing staff into tenant membership records
- migrate current branding and business identity into tenant branding/settings tables
- preserve current quote and invoice numbers
- preserve current document and attachment links

Migration is complete only when existing Empire users can log in and see the same operational CRM data, now isolated under tenant one.

### Public and Interface Changes to Lock

The following concepts become required product interfaces:

- `tenant`
- `tenant membership`
- `active tenant`
- tenant-scoped branding/settings
- tenant-aware numbering
- tenant-prefixed file storage

Every CRM API route must:

- resolve active tenant
- enforce `tenant_id`
- reject cross-tenant record access

## Phase 2: Fergus Launch-Critical Feature Gaps

Phase 2 starts only after the tenant-safe base is complete.

The goal is not full Fergus parity. The goal is the minimum launch-critical operational feature set required for a UK heating and plumbing firm with 1-50 engineers.

### Epic 1: Job + Site Structure

Current gap:

- jobs are tied directly to a customer with limited site/contact structure
- one free-text `assigned_engineer` field is not enough for delivery workflows

Required additions:

- `crm.sites`
- `crm.site_contacts`
- job-level site selection
- billing contact vs site contact separation
- work-order upload during job creation or planning
- `crm.job_assignees` for multi-operative assignment

Minimum behavior:

- a customer can have multiple sites
- a job points to one site
- a job can have one or more assigned operatives
- office can capture access notes, parking notes, and site-specific operational notes

### Epic 2: Quote and Estimate Workflow

Current gap:

- quotes exist as single records with no estimate distinction, revision control, publish lifecycle, or acceptance tracking

Required additions:

- quote type: `estimate` or `quote`
- `crm.quote_versions`
- publish/send states
- branded customer-facing composition controls
- `crm.quote_acceptances`

Minimum behavior:

- estimator can create an estimate, revise it, and convert or publish as a formal quote
- prior versions remain visible
- acceptance is captured against the correct version
- status flow supports draft, published, sent, accepted, declined, superseded

### Epic 3: Job Delivery Control

Current gap:

- no structured delivery phasing
- no formal mechanism for approved changes after the original quote

Required additions:

- `crm.job_phases`
- `crm.job_variations`

Minimum behavior:

- office can define phases for install-style work
- engineer or office can raise variations
- variation must support approval state before commercial impact is applied
- phases can later drive billing and operational tracking

### Epic 4: Compliance and Safety

Current gap:

- required document rules exist, but hazards, checklists, certificates, and safety workflows are not structured operational records

Required additions:

- `crm.job_hazards`
- hazard-free declaration
- SWMS and data-sheet attachment support
- `crm.job_checklists`
- `crm.job_certificates`

Minimum behavior:

- hazards can be logged and mitigated
- job can be marked hazard-free where appropriate
- required checklists and certificates are tied to service/job type
- job completion can be blocked when required compliance items are incomplete

### Epic 5: Materials and Supplier Control

Current gap:

- suppliers and products exist, but operational procurement and supplier cost control do not

Required additions:

- `crm.purchase_orders`
- `crm.supplier_reconciliation`

Minimum behavior:

- office can issue purchase orders against jobs or phases
- supplier invoice and credit notes can be reconciled back to the job
- committed cost visibility is available inside the job/commercial workflow

### Epic 6: Invoicing Workflow

Current gap:

- invoicing is currently a simpler single-invoice flow with payment logging

Required additions:

- `crm.invoice_schedules`
- deposit, stage, and final invoice flows
- invoice approval/send states

Minimum behavior:

- accounts can create deposit, phase-linked, and final invoices
- invoice generation can derive from quote value and/or phase state
- payment tracking remains linked to the appropriate invoice schedule and job context

## Important Model Changes

The implementation must introduce or revise these entities:

- `crm.tenants`
- `crm.tenant_memberships`
- `crm.tenant_settings`
- `crm.tenant_branding`
- `crm.user_profiles` revised to be tenant-scoped or split into global identity plus tenant membership profile
- `tenant_id` on all existing CRM tables
- `crm.sites`
- `crm.site_contacts`
- `crm.job_assignees`
- `crm.job_phases`
- `crm.job_variations`
- `crm.quote_versions`
- `crm.quote_acceptances`
- `crm.job_hazards`
- `crm.job_checklists`
- `crm.job_certificates`
- `crm.purchase_orders`
- `crm.supplier_reconciliation`
- `crm.invoice_schedules`

## Assumptions That Must Be Removed

The product must no longer rely on these single-tenant or under-modeled assumptions:

- global CRM schema behavior with no tenant partition
- `assigned_engineer` as a single free-text field
- generic attachments as a substitute for structured compliance workflows
- a single-record quote lifecycle with no revision or publish flow
- a single-invoice flow with only mark-paid handling
- hardcoded Empire CRM naming and branding in layout, metadata, or document identity

## Delivery Sequence

This order is non-negotiable.

### Step 1: Add tenancy model and tenant-aware auth/RLS

Deliverables:

- tenant tables
- membership model
- active tenant resolution
- tenant-aware RLS
- tenant-aware API enforcement

### Step 2: Migrate all current Empire CRM data into tenant one

Deliverables:

- Empire tenant created
- all existing records backfilled with `tenant_id`
- existing users mapped into memberships
- Empire remains functional after migration

### Step 3: Move branding, settings, documents, and sequences to tenant-owned configuration

Deliverables:

- tenant branding and business profile
- tenant-owned document identity
- tenant-scoped numbering
- tenant-prefixed file storage

### Step 4: Add tenant creation and onboarding for new businesses

Deliverables:

- admin-assisted new tenant creation
- first owner/admin user setup
- default CRM seed data for a fresh tenant

### Step 5: Validate tenant isolation

Deliverables:

- RLS verification across all CRM tables
- route and API isolation checks
- numbering isolation checks
- storage isolation checks
- demo mode isolation checks

### Step 6: Implement Fergus launch-critical workflows

Deliverables:

- site/contact structure
- quote/estimate workflow
- phases and variations
- hazards/checklists/certificates
- purchase orders and reconciliation
- stage/deposit/final invoicing

## Test Plan

### Multi-Tenant Acceptance

- Existing Empire users log in and only see Empire data after migration.
- A newly created business gets a fresh CRM with seeded defaults and no Empire records.
- Quote and invoice numbers can repeat across tenants if needed, but never collide within a tenant.
- File uploads, PDFs, and settings resolve to the active tenant only.
- RLS blocks cross-tenant reads and writes for every CRM table and API route.
- Demo mode remains isolated within the active tenant.

### Fergus-Gap Acceptance

- Office creates a job where customer, site, and site contact differ.
- Operations assigns multiple engineers and tracks job phases.
- Estimator creates an estimate, revises it into a quote, publishes it, and records customer acceptance.
- Engineer raises a variation and office converts it into approved billable value.
- Engineer cannot complete a job until required hazards, checklists, and certificates are satisfied.
- Accounts raises deposit, stage, and final invoices tied to quote value and/or phases.
- Office issues supplier purchase orders and reconciles supplier invoices or credits against the job.

## Defaults and Assumptions

- Architecture target is one shared SaaS codebase with one shared database and tenant-scoped isolation.
- Empire Home Solutions is preserved as tenant one, not rebuilt as a separate system.
- The public landing-page site can remain Empire-specific for now; this PRD covers CRM SaaS productization first.
- New customer signup can be admin-assisted first, but the schema and flows must support self-serve onboarding later.
- Tenancy is phase one. Fergus-style launch-critical parity is phase two.
- AI, advanced add-ons, broad integrations, and non-essential extras remain secondary unless they are required by tenancy or by the Phase 2 launch workflows.

## Out of Scope for This PRD

These items are explicitly not part of the required launch sequence unless they become necessary during implementation:

- separate deployment per customer
- separate database per customer
- public website multi-tenant re-platforming
- enterprise-grade branch hierarchies
- deep accounting integrations
- customer portals beyond quote acceptance and document delivery
- marketplace add-ons unrelated to tenancy or Fergus launch workflows

## Success Definition

This PRD succeeds when the CRM can operate as a tenant-safe SaaS with Empire preserved as tenant one, new businesses can onboard into isolated workspaces, and the product roadmap then closes the launch-critical Fergus gaps on top of that safe foundation rather than rewriting them later.
