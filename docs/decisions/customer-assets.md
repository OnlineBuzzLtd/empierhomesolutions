# Decision: Keep Customer Assets

Date: 2026-05-26

Decision: keep `crm.customer_assets`.

Reason: plumbing qualification and future reminder loops need property and boiler context, including asset type, make, model, warranty dates, and service due dates. This table stays tenant-scoped and remains part of future onboarding for clients that need service reminders or asset-aware qualification.

Scope-trim note: job phases, variations, purchase orders, supplier reconciliation, hazards, and certificates are hidden or stopped first. `customer_assets` is not part of that trim.
