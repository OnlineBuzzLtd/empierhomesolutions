# PRD — Quote-builder package card + margin polish

**Created**: 2026-05-12
**Author**: shaz@onlinebuzz.co.uk (via review pass)
**Reference**: trade-portal screenshot ("PACKAGE — Vaillant Eco-Tec Plus 435", Cost / Margin / Price / Subtotal / VAT / Total card + Profit & Cost block)
**Status legend**: 🔴 not started · 🟡 in progress · 🟢 done · ⚪ blocked
**Severity**: `P0` blocks revenue / quoting · `P1` important within ~2 weeks · `P2` cleanup / nice-to-have
**Effort**: `XS` <1h · `S` half day · `M` 1–2 days · `L` 3–5 days · `XL` >1 week

---

## Context — what already exists (do not rebuild)

Both **packages** and **margin** are already shipped in the CRM and are tenant-scoped via RLS for every tenant. Do not duplicate this work. New tickets must extend, not replace, the following:

- **Schema** — [supabase/migrations/202604300001_crm_packages.sql](../supabase/migrations/202604300001_crm_packages.sql): `crm.packages` (name, description, `default_markup_percent`, is_active, tenant_id) + `crm.package_items` (description, qty, unit_cost, unit_price, sort_order, product_id). RLS policies: `crm.is_tenant_member(tenant_id)` for read/write, `crm.is_manager_or_admin(tenant_id)` for delete.
- **Math** — [src/modules/crm/lib/quote-rollup.ts](../src/modules/crm/lib/quote-rollup.ts): `computeLineRollup` and `computeQuoteRollup` are the **single source of truth** shared by client display and server persistence. Returns `total_cost`, `total_profit`, `total_margin_percent`, `total_markup_percent` (nullable when cost is missing — surfaced as "—" in UI, never `0`). **No ticket below may introduce a parallel margin calculator.**
- **Snapshot semantics** — [src/modules/crm/lib/packages.ts](../src/modules/crm/lib/packages.ts) `expandPackageToLineItems` copies items into `quotes.line_items` JSONB at insert time. Editing a package later must continue to leave historic quotes untouched. **Do not break this invariant.**
- **Existing UI** — [src/app/(crm)/settings/packages/page.tsx](../src/app/(crm)/settings/packages/page.tsx), [PackageManagerForm.tsx](../src/modules/crm/components/forms/PackageManagerForm.tsx), [InsertPackageDialog.tsx](../src/modules/crm/components/forms/InsertPackageDialog.tsx), [LineItemsEditorV2.tsx](../src/modules/crm/components/forms/LineItemsEditorV2.tsx), [QuoteRollupPanel.tsx](../src/modules/crm/components/forms/QuoteRollupPanel.tsx).

**Invariants any ticket must preserve.**
- A package-rollup line never contributes to subtotal — components do (see `isPriced` in `quote-rollup.ts`). Adding fields must not change this.
- All package data is filtered by `tenant_id` and protected by RLS. New columns inherit the same policies.
- Margin/profit math lives in `quote-rollup.ts`. UI reads it; UI never re-derives it.

---

## Tickets

### 🔴 PKG-001 · Add `/settings/packages` to the Settings index
**Severity**: P1 · **Effort**: XS · **Depends on**: none

**Problem.** [src/app/(crm)/settings/packages/page.tsx](../src/app/(crm)/settings/packages/page.tsx) exists and works, but [src/app/(crm)/settings/page.tsx](../src/app/(crm)/settings/page.tsx) does not link to it. A tenant admin has to know the URL to manage packages — silent discoverability bug since the feature shipped.

**Scope.**
- Add a card / link to the Settings index pointing at `/settings/packages`, titled "Quote-builder packages", with a one-line description.
- No new components — use the existing `SectionCard` pattern already used on that page.

**Acceptance criteria.**
- Navigating to `/settings` shows a "Quote-builder packages" entry visible to any user who passes `requireSettingsAccess()`.
- Clicking it lands on `/settings/packages` and renders `PackageManagerForm`.
- Tenants with no packages still see the entry (it's a management surface, not a data surface).

**Test plan.**
1. Sign in as a tenant admin (any tenant). Visit `/settings`. Confirm new entry renders.
2. Click through, confirm packages list loads (empty state acceptable).
3. Sign in as a non-admin role that lacks settings access — confirm `/settings` still works and the new entry follows the same gating as the rest of the page (no permission leak).

**Rollback.** Revert the single edit to `src/app/(crm)/settings/page.tsx`. No data impact.

---

### 🔴 PKG-002 · Render package rollup as a card in the quote builder (read-mode parity with trade portals)
**Severity**: P1 · **Effort**: S · **Depends on**: none

**Problem.** When a package is inserted into a quote, [LineItemsEditorV2.tsx:86-106](../src/modules/crm/components/forms/LineItemsEditorV2.tsx#L86-L106) renders a one-line amber banner: "Cost X · Price Y · Margin Z". The reference trade portal shows a boxed card with a header, optional image, "Show more" description, a left/right grid (Cost / Margin on left, Price / Subtotal / VAT / Total on right), and components rendered as nested children. This is purely a presentation change.

**Scope.**
- New component: `PackageRollupCard` in `src/modules/crm/components/forms/`. Renders package header + Cost / Margin / Price / Qty / Subtotal / VAT / Total computed from the **already-attached component rows** via `computeLineRollup` + the quote's VAT rate.
- Update [LineItemsEditorV2.tsx](../src/modules/crm/components/forms/LineItemsEditorV2.tsx) to render `PackageRollupCard` in place of the current amber banner when `kind === "package_rollup"`.
- Component rows continue to render below as today (indented by `package_role === "component"`).
- No schema change. No new math. **Re-use `computeLineRollup` / `computeQuoteRollup`** — do not write a per-package summer in the component.

**Acceptance criteria.**
- Inserting a package shows the new card with the same numbers `QuoteRollupPanel` would compute for the same lines.
- Editing a component qty updates the card's Cost / Margin / Subtotal / Total in real time (single source of truth: same hook chain that powers `QuoteRollupPanel`).
- Removing all components removes the rollup card (already handled — verify regression-free).
- When `unit_cost` is missing on any component, the card shows "—" for Cost and Margin, never `0` or `0.00%`. Matches `QuoteRollupPanel` behaviour.
- Quote subtotal/total (in `QuoteRollupPanel`) is unchanged after this ticket — invariant: package-rollup rows still don't double-count.

**Test plan.**
1. Unit test the new component with three fixtures: cost present on all, cost missing on one, cost missing on all. Snapshot or assert on rendered strings — values must match `computeLineRollup` outputs.
2. Vitest the existing `quote-rollup.test.ts` continues to pass unchanged.
3. Manual: create a quote with one package + one bare line; confirm `QuoteRollupPanel` totals are identical pre- and post-merge for the same input.

**Rollback.** Revert the editor swap. The component file can stay (unused).

---

### 🔴 PKG-003 · Add optional image to packages
**Severity**: P2 · **Effort**: S · **Depends on**: PKG-002

**Problem.** Trade portal shows a thumbnail in the package card (the screenshot has a placeholder). `crm.packages` has no image column. Without it the new `PackageRollupCard` has no slot to fill.

**Scope.**
- Migration (expand step — backwards compatible): `alter table crm.packages add column if not exists image_url text null;`. No backfill. Inherits existing RLS.
- Types: extend `Package` in [src/modules/crm/types.ts](../src/modules/crm/types.ts) with `image_url: string | null`.
- API: extend `packageSchema` in [src/modules/crm/lib/validation.ts](../src/modules/crm/lib/validation.ts) with optional `image_url`. Propagate through `POST` and `PUT` in [src/app/api/crm/packages/route.ts](../src/app/api/crm/packages/route.ts) + [src/app/api/crm/packages/[id]/route.ts](../src/app/api/crm/packages/[id]/route.ts).
- UI: `PackageManagerForm` — single URL input (no upload pipeline this ticket; explicit out-of-scope below). `PackageRollupCard` renders an `<img>` if `image_url` is set, otherwise the existing placeholder icon.

**Out of scope.** Image upload, Supabase Storage bucket, resizing, CDN. Tenants paste a hosted URL for now. Upload is a separate ticket if/when needed.

**Acceptance criteria.**
- Saving a package with a URL persists it; saving without one stores `null`.
- Existing packages continue to render with no image (no NPE, no broken `<img>`).
- RLS verified: a tenant cannot read another tenant's `image_url` (covered by the existing `crm_read_packages` policy — no new policy needed).
- Schema migration is reversible: `alter table crm.packages drop column image_url` with no data loss for the contract (column was additive).

**Test plan.**
1. Migration runs cleanly locally + in CI.
2. Insert a package with `image_url`, read it back via API. Assert URL round-trips.
3. Insert with no image, read it back. Assert `null`.
4. RLS test: cross-tenant select returns empty (re-use the patterns in existing package RLS tests if any; otherwise add one).

**Rollback.** Drop the column. UI gracefully handles missing field (defaults to `null`). API schema accepts both shapes.

---

### 🔴 PKG-004 · Group line items by section in the quote builder
**Severity**: P2 · **Effort**: M · **Depends on**: none

**Problem.** The trade-portal screenshot shows a section heading ("Unnamed Section") visually wrapping its packages. Today, `section_header` rows exist as line items ([LineItemsEditorV2.tsx:75-83](../src/modules/crm/components/forms/LineItemsEditorV2.tsx#L75-L83)) but there's no visual container — readers can't tell which items belong to which section.

**Scope.**
- In `LineItemsEditorV2`, walk the flat `line_items` array and chunk into sections at each `kind === "section_header"`. Render each chunk inside a bordered container.
- Items not preceded by any section render in an implicit "Unnamed Section" (matches the screenshot — do not invent an `Unnamed Section` data row; this is purely visual).
- No schema change. `section_id` already exists on items inserted via `expandPackageToLineItems` ([packages.ts:60](../src/modules/crm/lib/packages.ts#L60)); use header rows as the grouping signal in the editor (consistent with how serialised data already orders rows).

**Acceptance criteria.**
- A quote with `[header A, line, line, header B, line]` renders two visual sections; section A contains its two lines, section B its one.
- A quote with `[line, header A, line]` renders an "Unnamed Section" containing the first line and section A containing the second.
- Reordering rows (existing up/down controls) does not break grouping — sections re-chunk on every render from the current array.
- `computeQuoteRollup` output is byte-identical pre- and post-change for the same fixture (invariant: visual change only).

**Test plan.**
1. Snapshot the editor with the three fixtures above.
2. Move a row across a section boundary; assert the chunk it lands in updates.
3. `quote-rollup.test.ts` is unchanged.

**Rollback.** Single-file revert of `LineItemsEditorV2.tsx`. No schema, no API.

---

### 🔴 PKG-005 · Apply `default_markup_percent` to auto-price package components from cost
**Severity**: P1 · **Effort**: S · **Depends on**: none

**Problem.** `crm.packages.default_markup_percent` is captured by [PackageManagerForm.tsx:200-206](../src/modules/crm/components/forms/PackageManagerForm.tsx#L200-L206) and persisted, but **nothing reads it**. Tenants enter a markup % expecting it to drive prices; today they still have to type unit_price manually. The field is a lie of omission.

**Scope.**
- In `PackageManagerForm`, when `default_markup_percent` is non-null and a component row's `unit_cost` is set, auto-populate `unit_price = round2(unit_cost * (1 + markup/100))`.
- Auto-fill triggers on: (a) entering/changing the markup %, (b) entering/changing the cost, (c) applying a product. **Never overwrite a price the user typed manually after the auto-fill** — track a per-row `price_manually_edited` flag in component state (not persisted).
- Add a small "Auto-priced from markup" hint next to auto-filled prices. Clearing the markup leaves existing prices untouched.
- No schema change. No new math primitive — just `price = cost * (1 + markup/100)` inline.

**Decision to flag for review.** Should the markup also apply at **insert time** when a package is dropped into a quote (i.e. recompute prices from current cost × markup)? Default proposal: **no** — preserve snapshot semantics (see [packages.ts:1-4](../src/modules/crm/lib/packages.ts#L1-L4)). Markup acts only as a price-entry assist inside the package editor. Confirm before implementing.

**Acceptance criteria.**
- Setting markup % + cost auto-fills price across all rows that haven't been manually edited.
- Manually editing a price after auto-fill: the row keeps the manual value even if cost or markup later changes (sticky), but typing into Cost again on that row still recomputes (one-shot reset of the manual flag) **— UX behaviour to confirm in review**.
- Clearing markup to empty does not clear existing prices (non-destructive).
- Saved package round-trips unchanged for tenants who never touch the markup field (backwards compatible).

**Test plan.**
1. Component test: set markup 20, cost 100 on row A → price becomes 120. Edit price to 130 on row A. Change cost to 150 → price stays 130 (manual sticky). Re-decide per the open question above.
2. Save + reload — values persist, markup reapplies on next edit session if cost changes.
3. Insert a package into a quote — assert prices that flow into the quote match what's stored on the package_items row (snapshot invariant).

**Rollback.** Revert the form change. Persisted `default_markup_percent` values are harmless — they're already ignored today.

---

### 🔴 PKG-006 · Optional per-package VAT line on the rollup card
**Severity**: P2 · **Effort**: S · **Depends on**: PKG-002

**Problem.** The trade portal shows VAT inside each package card ("Standard 20% VAT (£780.00)"). The CRM applies VAT once at the quote level via `QuoteRollupPanel`. Some users prefer per-package transparency. Customer-visible only — internal math is unaffected.

**Scope.**
- Add a `showVat?: boolean` prop to `PackageRollupCard` (from PKG-002), defaulting to `false`.
- A tenant-level setting `tenant_settings.show_per_package_vat boolean default false` controls it. Inherits existing RLS on `tenant_settings`.
- VAT is **derived**, not stored on package: `vat = round2(package_subtotal * vatRate)` using the quote's VAT rate. No new persisted field on packages.
- `computeQuoteRollup` is untouched — invariant: quote total continues to use the **quote-level** VAT calculation. Per-package VAT is a display rollup of the same money.

**Acceptance criteria.**
- With setting off (default), card renders as in PKG-002 (no VAT row).
- With setting on, card shows VAT and Total = Subtotal + VAT.
- Sum of per-package VAT (across packages on a quote) equals quote-level VAT to the nearest penny for any fixture (rounding invariant).
- Setting flip is reversible with no data migration.

**Test plan.**
1. Fixture: two packages, one priced £3,900, one priced £100. With VAT 20%, per-package totals are £4,680 + £120 = £4,800. Quote total (computed at quote level, then formatted) is £4,800. Assert match.
2. Edge: package with cost-missing components — VAT still computes off subtotal correctly.
3. Toggle the setting off → card hides VAT row, math unchanged.

**Rollback.** Toggle setting to `false` (or revert the column default). Card silently hides the row.

---

## Cross-cutting non-functional requirements

- **Observability.** No new structured logs needed for purely UI tickets (PKG-001, PKG-002, PKG-004, PKG-006). PKG-003 adds an API surface — log at the existing decision point in the route handler (`packages.create` / `packages.update`) using the codebase's current pattern. PKG-005 is a client-side assist — no server logs.
- **Cost.** None. No new third-party calls. No additional DB columns of meaningful size (one text URL + one boolean).
- **Security.** PKG-003 stores user-supplied URLs — sanitise on render (`<img src>` only, no `<iframe>`, no protocol-relative URLs without explicit allowlist). PKG-006 sets a boolean — no input risk.
- **Feature flags.** PKG-006 is gated by `tenant_settings.show_per_package_vat` — that *is* the flag. The other UI tickets are low-risk and can ship without a flag, but if you'd rather flag PKG-002 during rollout, gate on `tenant_settings` or an env var rather than a hardcoded list.
- **Backwards compatibility.** Every schema change is additive with a default. No `quotes.line_items` JSONB shape change. No breaking API change. Snapshot semantics are preserved across all tickets.
- **Tests.** Each ticket carries its own assertions above. The shared invariant — `computeQuoteRollup` output is byte-identical for the same input pre/post each ticket — must be asserted by a fixture-level test that runs in CI.

## Definition of done (whole PRD)

The PRD is done when:
1. All six tickets are merged or explicitly deferred (with the deferral recorded here).
2. The trade-portal screenshot can be reproduced for any tenant inside the CRM quote builder, modulo the image-upload limitation called out in PKG-003.
3. `computeQuoteRollup` remains the only place margin math lives.
4. No regression in `quote-rollup.test.ts` or any package-related test.
5. `/settings/packages` is reachable by clicking, not by URL typing.

## Open questions for review

1. **PKG-005 stickiness.** Should manual price edits stay sticky across markup/cost changes, or should "Cost" edits reset the row's manual flag? Default proposal: sticky except when cost is re-entered.
2. **PKG-005 insert-time recompute.** Confirm that markup is a price-entry assist only and **must not** recompute prices when a package is dropped into a quote (preserves snapshot semantics).
3. **PKG-006 default.** Per-package VAT off by default for all tenants, or on for new tenants only? Default proposal: off everywhere, opt-in via settings.
