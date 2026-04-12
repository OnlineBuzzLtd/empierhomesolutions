# CRM Test Guide — Manager & Engineer Walkthrough

**URL:** http://localhost:3000  
**Tenant 1 (Empire Home Solutions)** — demo data, read-only fields  
**Tenant 2 (Plumbersrus.ai)** — full seed data, all fields editable

---

## Credentials

| Role | Email | Password |
|---|---|---|
| **Manager (T1)** | `crm-demo-manager@empirehomesolutions.local` | `Replace-Me-In-Production-2026!` |
| **Engineer (T1)** | `crm-demo-engineer@empirehomesolutions.local` | `Replace-Me-In-Production-2026!` |
| **Owner (T2)** | `owner@plumbersrus.ai` | `PlumbersRus-Demo-2026!` |
| **Ops Manager (T2)** | `ops.manager@plumbersrus.ai` | `PlumbersRus-Demo-2026!` |
| **Engineer (T2)** | `jack.mason@plumbersrus.ai` | `PlumbersRus-Demo-2026!` |

> Use Tenant 2 credentials if you want to create, edit, or delete records. Tenant 1 is locked to demo-read-only mode.

---

## Live Channel Tester

Use this when you want to test the agent booking flow from the CRM UI.

**URL:** `/ai-hub/live`

What it does:
- shows the linked runtime status for `Web`, `SMS`, `WhatsApp`, and `Phone`
- gives you a lightweight webchat surface inside CRM
- shows live CRM-linked booking results on the right

### Local fixture mode

If you run Playwright or set `CRM_E2E_PLATFORM_FIXTURES=1`, the page works without a live external runtime:
- the runtime panel shows fixture-ready channel numbers
- the webchat form creates a local fixture conversation
- sending a postcode or confirmation message books a fixture appointment and updates the CRM results panel

### Real linked runtime mode

To use the real CustomerJourneys runtime instead of fixtures, set these CRM env vars:
- `CUSTOMERJOURNEYS_PLATFORM_API_BASE_URL`
- `CUSTOMERJOURNEYS_INTERNAL_API_TOKEN`
- `CUSTOMERJOURNEYS_ADMIN_API_TOKEN`

And set these runtime env vars in `customerjourneys-site`:
- `CRM_PLATFORM_EVENTS_URL`
- `CRM_PLATFORM_SHARED_SECRET`

Then open `/ai-hub/live` as a `management` or `admin` user in tenant 1.

---

## Part 1 — Manager Walkthrough

The manager has full access: Dashboard, Leads, Customers, Jobs, Calendar, AI Hub, Quotes, Invoices, Staff, Reports, Settings.

Log in as the Manager, then follow steps in order.

---

### Step 1 — Dashboard
**Go to:** `/dashboard`

What to check:
- KPI cards load (Open Jobs, Today's Jobs, Unpaid Invoices, Open Leads)
- Recent Customers list is visible
- Active Jobs section shows assigned jobs
- AI Hub preview section shows metrics

---

### Step 2 — Leads
**Go to:** `/leads`

What to check:
- Lead pipeline list loads
- Click a lead to open its detail panel
- Check the status dropdown shows all stages: new → contacted → follow_up → survey_booked → quoted → accepted → booked → completed → lost
- Click **Add Lead** and verify the form opens with fields: status, source, service, job type, owner, next action, notes
- *(T2 only)* Fill in a test lead and save — confirm it appears in the list

---

### Step 3 — Customers
**Go to:** `/customers`

What to check:
- Customer list loads with name, phone, postcode, job count
- Click a customer — verify their full profile opens: address, property type, linked assets, total jobs
- Click **Add Customer** — verify form has: name, phone, email, address, property type, lead source, notes, site information
- *(T2 only)* Create a test customer and confirm it saves

---

### Step 4 — Jobs
**Go to:** `/jobs`

What to check:
- Job list loads with status, customer name, engineer, date
- Click a job to open it — verify you see: customer details, site info, engineer assignment, status, description, linked quote/invoice
- Check status options: enquiry → booked → in_progress → completed → invoiced
- Click **Add Job** — verify form has: customer, title, site/contact, service, job type, status, date, engineer assignment, description
- *(T2 only)* Create a test job, assign it to an engineer, save and confirm it appears

---

### Step 5 — Calendar
**Go to:** `/calendar`

What to check:
- Upcoming schedule list loads
- Filters work: type (call, survey, booking, meeting, reminder), status (scheduled, completed, cancelled), staff name
- Click a calendar item to view its details
- Click **Add Calendar Item** — verify form has: type, title, customer link, lead link, assigned to, status, recurrence, date/time, reminder minutes
- *(T2 only)* Create a test appointment and confirm it appears in the schedule

---

### Step 6 — Quotes
**Go to:** `/quotes`

What to check:
- Quote list loads with quote number, customer, job, version, status, total
- Click a quote to open it — verify you see: line items, optional extras, VAT, total, validity date, acceptance status
- Click **Create Quote** — verify template options appear (Blank, Combi Boiler Replacement)
- Verify the product catalog loads when adding line items
- Check VAT options: 20%, VAT Exempt, Reverse Charge
- *(T2 only)* Create a test quote from a blank template with one line item

---

### Step 7 — Invoices
**Go to:** `/invoices`

What to check:
- Invoice list loads with summary totals (Unpaid vs Paid)
- Click an invoice — verify you see: customer, job, due date, status, line items, payment method fields
- Verify status options: unpaid, paid, overdue, void
- Check the Invoice & Pipeline Summary section calculates correctly
- *(T2 only)* Create a test invoice linked to an existing job

---

### Step 8 — Staff
**Go to:** `/staff`

What to check:
- Staff list loads with name, role, status, email, agreed hours
- Click a staff member — verify profile shows: role, pay type, pay notes, emergency contact
- Check Certifications section: each staff member's certs show title, category, issuer, issue/expiry date
- Verify expiry reminders are visible
- *(T2 only)* Add a test certification to an engineer and confirm it saves

---

### Step 9 — Reports
**Go to:** `/reports`

What to check:
- Revenue figure matches the sum of raised invoices
- Unpaid figure matches unpaid invoices
- Profit Est. deducts expenses correctly
- Lead Conversion ratio is correct
- Completed Jobs ratio is correct
- Engineer Workload table shows each engineer's open vs completed jobs
- Invoice & Pipeline Summary totals are accurate

---

### Step 10 — Settings
**Go to:** `/settings`

What to check:

| Section | What to verify |
|---|---|
| **Workspace Profile** | Business name, CRM display name, phone, email, VAT number, Gas Safe number load correctly |
| **User Roles** | All staff appear with their role; role dropdown works |
| **Services** | Existing services listed; Add Service form has name, slug, description, active toggle |
| **Job Types** | Job types listed per service; Add Job Type form works |
| **Custom Fields** | Field list loads; Add Custom Field form has entity type, label, key, field type, service/job type filter, required toggle |
| **Required Document Rules** | Rules listed; form has entity type, tags, stage/status trigger, due days, service filter |
| **Suppliers** | Suppliers listed; Add Supplier form has name, category, contact details, notes |
| **Products** | Product catalog listed; Add Product form has name, category, unit cost, sell price, markup %, SKU, service/supplier linking |
| **Quote Templates** | Templates listed with line items and payment terms; Add Template form works |

---

### Step 11 — AI Hub
**Go to:** `/ai-hub`

What to check:
- Page loads with the ADD-ON banner and pricing
- KPI metrics display: missed calls recovered, bookings captured, leads qualified, average response time
- Three demo scenario buttons are clickable: Urgent Job Booking (WhatsApp), Quote Qualification (Web Chat), Missed Call Recovery
- Each scenario shows a conversation thread, AI Actions Timeline, and CRM Impact section
- Watch Demo, See ROI, and Upgrade buttons are present

---

## Part 2 — Engineer Walkthrough

The engineer has a simplified view: **Dashboard (My Day), Jobs, Calendar** only. No access to leads, quotes, invoices, reports, or settings.

Log in as the Engineer.

---

### Step 1 — Field Dashboard (My Day)
**Go to:** `/dashboard`

What to check:
- "My Day" heading and Field Dashboard label appear (not the manager's KPI view)
- Next assigned job card loads with: customer name, address, phone, service, status, scheduled time
- Quick nav bar at bottom: Dashboard, Today, Jobs, Call
- **Call** button shows the customer's phone number and is a `tel:` link
- **Open Directions** button is present on the job card
- **Start Job** and **Mark Complete** buttons are visible
- **Add Photo** and **Add Note** buttons are present

---

### Step 2 — Jobs (Engineer view)
**Go to:** `/jobs`

What to check:
- Job list only shows jobs assigned to this engineer (not all company jobs)
- Click a job — verify engineer can see: customer address, contact number, site notes, job description, documents/certificates
- Verify engineer CANNOT see: quotes, invoices, other engineers' jobs
- Check status action buttons are available (Start Job, Mark Complete)

---

### Step 3 — Calendar (Engineer view)
**Go to:** `/calendar`

What to check:
- Only this engineer's appointments are shown by default
- Staff filter defaults to this engineer
- Appointment details (date, time, customer, address) are visible
- Can view appointment detail on click

---

### Step 4 — Confirm restricted access
Try navigating directly to routes the engineer should not see:

| URL | Expected result |
|---|---|
| `/leads` | Redirect to dashboard or access denied |
| `/customers` | Redirect or access denied |
| `/quotes` | Redirect or access denied |
| `/invoices` | Redirect or access denied |
| `/staff` | Redirect or access denied |
| `/reports` | Redirect or access denied |
| `/settings` | Redirect or access denied |

---

## Part 3 — Workspace Switching (Multi-Tenant)

If a user has membership in more than one workspace:

1. Log in as a user who belongs to multiple tenants
2. Look for the workspace switcher in the top-left of the nav (tenant name + dropdown)
3. Click it — a list of available workspaces should appear
4. Select a different workspace — verify the page reloads scoped to the new tenant
5. Confirm all data (customers, jobs, staff, quotes) belongs only to the newly selected tenant
6. Switch back and confirm original tenant data returns

---

## Quick Reference — What Each Role Can Do

| Feature | Engineer | Sales/Accounts | Management/Admin |
|---|---|---|---|
| My Day dashboard | ✅ | — | — |
| KPI dashboard | — | ✅ | ✅ |
| Leads | — | ✅ | ✅ |
| Customers | — | ✅ | ✅ |
| Jobs (own only) | ✅ | — | — |
| Jobs (all) | — | ✅ | ✅ |
| Calendar (own) | ✅ | ✅ | ✅ |
| Quotes | — | ✅ | ✅ |
| Invoices | — | ✅ | ✅ |
| Staff | — | — | ✅ |
| Reports | — | — | ✅ |
| Settings | — | — | ✅ |
| AI Hub | — | ✅ | ✅ |
