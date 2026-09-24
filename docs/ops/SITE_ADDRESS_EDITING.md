# Existing site address editing

Office users (management, admin and sales) can open Customers → customer →
Sites → Edit site to correct an existing site's address, including the primary
site. Customer contact addresses are separate; the customer form links to Sites
to make this distinction clear. Saving a site changes the address displayed on
every job linked to that site, including historical jobs.

`CRM_SITE_EDITING_ENABLED` defaults to enabled. This exposes the existing site
form and tenant-scoped PATCH endpoint without requiring the multi-site migration.
It does not rewrite any records on deployment. The API payload is unchanged;
customer/tenant reassignment and invalid fields remain rejected. When multi-site
is off, any `is_primary` patch (including false or one mixed with address changes)
is rejected before any write.

Creating or deleting sites and switching the primary still require
`CRM_MULTISITE_ENABLED=true` and the existing multi-site migration. Do not turn
that flag on just to correct an address.

Rollback: set `CRM_SITE_EDITING_ENABLED=false` and redeploy. Editing then follows
`CRM_MULTISITE_ENABLED` as it did before this fix. With multi-site off, the editor
is hidden and PATCH requests are blocked. Saved address corrections remain saved;
there is no migration to reverse. Reverting the fix commit also restores the
previous behaviour.

Regression checks cover the real customer page with multi-site off, office and
engineer roles, rollback, form prefilling, tenant-scoped address writes, primary
switch rejection and save failures. Tests use local fixtures and mocked services;
they do not write to the production database or send customer communications.
