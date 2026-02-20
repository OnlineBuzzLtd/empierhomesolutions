# Paid LP Foundation Task List

## Client Feedback Lock-Ins (Feb 19, 2026)

- [ ] Position business as `Heating and Gas Engineers` with specialties in boiler installation and domestic power flushing.
- [ ] Keep paid LP execution focus on `boiler-repair` and `boiler-installation` for this phase.
- [ ] Include `24/7 emergency call out` messaging in hero/trust/contact modules.
- [ ] Use contact details consistently:
  - [ ] Landline: `01895 725 151` (primary call CTA)
  - [ ] Mobile: `07340 020 938` (WhatsApp-ready)
  - [ ] Email: `info@empirehomesolutions.co.uk`
  - [ ] Keep `Book Now` CTA and contact form visible.
- [ ] Update area coverage copy to: `West London, Greater London, Buckinghamshire, Hertfordshire, Berkshire, Surrey`.
- [ ] Remove standalone `London` wording where it duplicates or conflicts with approved area list.
- [ ] Guarantee wording must be `Up to 10 years` (not fixed 10 years).
- [ ] Installation pricing guidance should show `£1,995 - £5,000` (not `£2,000+`).
- [ ] Finance messaging should confirm options over `3, 5, 8, and 10 years`.
- [ ] Do not publish interest rates/APR on LP pages; present rates at quote appointment only.

## High-Level Scope

- [ ] Initialize Next.js 14 (App Router, TypeScript), ESLint, Prettier, and env schema (Zod).
- [ ] Create `/apps/web` structure with modules: `landing`, `tracking`, `forms`, `content`, `ui`.
- [ ] Implement route groups: `/lp/[service]/[location]`, `/finance`, `/about-trust`.
- [ ] Build CMS-like JSON content model per page: hero, trust, pricing, FAQs, proof, CTAs.
- [ ] Add dynamic text replacement from URL params (`service`, `location`, `keyword`).
- [ ] Build LP shell with no top nav and sticky mobile call bar.
- [ ] Build Hero module with headline, subline, CTA buttons, call number, and response-time badge.
- [ ] Build Trust strip module with Gas Safe number, rating, finance, guarantee, and logos.
- [ ] Build Pricing module with diagnostic fee and repair/install ranges.
- [ ] Build Fault-intent list module for repair-specific issues.
- [ ] Build Local proof cards module with postcode, job type, and review snippet.
- [ ] Build Service radius/postcode coverage module.
- [ ] Build FAQ accordion module focused on objections.
- [ ] Build 4-field form with validation, anti-spam, and webhook submission.
- [ ] Integrate click-to-call events (`cta_call_click`, `sticky_call_click`).
- [ ] Track form events (`form_start`, `form_submit`, `form_success`, `form_error`).
- [ ] Capture UTM/GCLID/MSCLKID and landing URL in hidden fields.
- [ ] Add approved contact block (landline, mobile/WhatsApp, email) plus `Book Now` CTA.
- [ ] Add `24/7 emergency call out` proof point in Hero/Trust sections.
- [ ] Lock guarantee copy to `Up to 10 years` for install messaging.
- [ ] Lock installation pricing guidance to `£1,995 - £5,000`.
- [ ] Lock finance term messaging to `3, 5, 8, 10 years`; exclude APR/rate details from LP copy.
- [ ] Update coverage copy to approved regions only: West London, Greater London, Buckinghamshire, Hertfordshire, Berkshire, Surrey.
- [ ] Implement call-tracking number swap by source/medium/campaign.
- [ ] Build thank-you state, conversion event, and server-side Conversion API endpoint.
- [ ] Add page-speed hardening (image optimization, font preload, script deferral, caching).
- [ ] Generate dedicated LP variants: repair/install/finance by location.
- [ ] Add A/B test flags (headline, CTA copy, trust-order) via config.
- [ ] Create QA checklist for mobile CTA, form completion, events, and call links.
- [ ] Create deployment pipeline with preview/prod separation and rollback strategy.
- [ ] Add reporting dashboard spec for CVR, CPL, call answer rate by keyword/location.

## Atomic Build Checklist (Cursor-Ready)

1. [ ] Create a new branch named `feat/paid-lp-foundation` from `main`.
2. [ ] Add `apps/web` if missing; if present, confirm Next.js App Router + TypeScript.
3. [ ] Create `apps/web/.env.example` with keys: `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_GTM_ID`, `NEXT_PUBLIC_GA4_ID`, `NEXT_PUBLIC_CALL_NUMBER`, `FORM_WEBHOOK_URL`, `CONVERSION_API_SECRET`.
4. [ ] Install dependencies: `zod`, `react-hook-form`, `@hookform/resolvers`, `clsx`, `tailwind-merge`, `lucide-react`.
5. [ ] Create `apps/web/src/lib/env.ts` and validate env with Zod; throw startup error for missing required vars.
6. [ ] Create `apps/web/src/lib/cn.ts` utility for class merging (`clsx` + `tailwind-merge`).
7. [ ] Create route folder `apps/web/src/app/(lp)/lp/[service]/[location]/page.tsx`.
8. [ ] Create route folder `apps/web/src/app/(lp)/finance/page.tsx`.
9. [ ] Create route folder `apps/web/src/app/(lp)/about-trust/page.tsx`.
10. [ ] Create `apps/web/src/app/(lp)/layout.tsx` with no top navigation and no outbound links except CTA actions.
11. [ ] In `(lp)/layout.tsx`, add sticky mobile call bar fixed to bottom with tel link from env var.
12. [ ] Create `apps/web/src/modules/lp/types.ts` defining strict types for Hero, TrustStrip, Pricing, FaultList, ProofCards, Coverage, FAQ, and CTA.
13. [ ] Create `apps/web/src/modules/lp/content/schema.ts` using Zod matching `types.ts`.
14. [ ] Create `apps/web/src/modules/lp/content/defaults.ts` with default boiler-repair copy placeholders.
15. [ ] Create `apps/web/src/modules/lp/content/locations/` directory.
16. [ ] Add `apps/web/src/modules/lp/content/locations/uxbridge.boiler-repair.json`.
17. [ ] Add `apps/web/src/modules/lp/content/locations/uxbridge.boiler-installation.json`.
18. [ ] Add `apps/web/src/modules/lp/content/locations/hayes.boiler-repair.json`.
19. [ ] Create loader `apps/web/src/modules/lp/content/loadContent.ts` that maps `[service]/[location]` to JSON and validates with Zod.
20. [ ] Return `notFound()` if content file is missing or invalid.
21. [ ] Create `HeroSection.tsx` in `apps/web/src/modules/lp/components/`.
22. [ ] In Hero, render H1, subline, primary CTA (`Call Now`), secondary CTA (`Book Now` or `Get Fixed Quote`), call number, and response-time badge.
23. [ ] Make Hero primary CTA use `tel:` link and fire tracking event `cta_call_click`.
24. [ ] Create `TrustStrip.tsx` component under `src/modules/lp/components/`.
25. [ ] Add props: `gasSafeNumber`, `ratingValue`, `ratingCount`, `financeAvailable`, `guaranteeText`, `brandLogos`.
26. [ ] Render Gas Safe number as plain text, never image-only.
27. [ ] Add `aria-label="Gas Safe Registration Number"` to Gas Safe element.
28. [ ] Create `BrandLogoRow.tsx` component for Worcester/Vaillant/Ideal logos.
29. [ ] Add `loading="lazy"` on all non-hero logos.
30. [ ] Create `PricingSection.tsx` component.
31. [ ] Add fields: `diagnosticFrom`, `repairRangeMin`, `repairRangeMax`, `installRangeMin`, `installRangeMax`.
32. [ ] Set install pricing guidance default to `£1,995 - £5,000`.
33. [ ] Render pricing disclaimer text below prices.
34. [ ] Finance copy should show available terms (`3, 5, 8, 10 years`) and `subject to status`, with no advertised rates/APR.
35. [ ] Create `FaultListSection.tsx` component for repair LP only.
36. [ ] Add canonical faults list: no heat, no hot water, leak, low pressure, kettling, error codes.
37. [ ] Add icon + short sentence per fault.
38. [ ] Create `ProofCardsSection.tsx` component.
39. [ ] For each proof card, include: `postcode`, `serviceType`, `outcome`, `reviewSnippet`, `date`.
40. [ ] Limit initial proof-card render to 6 cards.
41. [ ] Add `Show more` button that expands client-side to all cards.
42. [ ] Create `CoverageSection.tsx` component.
43. [ ] Add fields: `primaryTown`, `radiusMiles`, `postcodes[]`, `regionsCovered[]`.
44. [ ] Render postcode list in grouped format (for example: UB, HA, SL).
45. [ ] Add conditional note: `Outside area? Call to confirm`.
46. [ ] Ensure coverage copy uses approved areas only: West London, Greater London, Buckinghamshire, Hertfordshire, Berkshire, Surrey.
47. [ ] Create `FaqSection.tsx` with accessible accordion.
48. [ ] Use semantic `<button>` triggers and `aria-expanded`.
49. [ ] Track FAQ expand event `faq_expand` with question id.
50. [ ] Create `QuoteForm.tsx` using `react-hook-form`.
51. [ ] Add fields: `name`, `postcode`, `phone`, `issue`.
52. [ ] Set validation: name 2+ chars, UK-basic postcode regex, phone 10-15 chars, issue 10+ chars.
53. [ ] Disable submit while pending.
54. [ ] Add inline validation messages per field.
55. [ ] Add honeypot field `companyWebsite` hidden with CSS.
56. [ ] Reject submit if honeypot contains value.
57. [ ] Create `src/modules/forms/api/submitLead.ts` as server action or route helper.
58. [ ] Accept payload only from allowed origin (`NEXT_PUBLIC_SITE_URL`).
59. [ ] Sanitize string inputs (trim + collapse whitespace).
60. [ ] Attach metadata: timestamp, page path, service, location.
61. [ ] Attach attribution fields: `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `gclid`, `msclkid`.
62. [ ] Post payload to `FORM_WEBHOOK_URL`.
63. [ ] Handle webhook non-200 responses with structured error payload.
64. [ ] Return JSON `{ ok: true }` on success.
65. [ ] Create `src/app/api/lead/route.ts` POST endpoint.
66. [ ] Move lead submission logic into API route if server actions are not used.
67. [ ] Add rate limit (IP + 1-minute window), in-memory or Redis if available.
68. [ ] Return HTTP 429 for abuse.
69. [ ] Create tracking utility `src/modules/tracking/pushDataLayer.ts`.
70. [ ] Ensure safe no-op when `window` is undefined.
71. [ ] Push events with schema `{ event, category, action, label, value }`.
72. [ ] Create helper `trackCallClick(source)`.
73. [ ] Create helper `trackFormEvent(type)`.
74. [ ] In Hero primary CTA `onClick`, fire `trackCallClick("hero")`.
75. [ ] In sticky call bar `onClick`, fire `trackCallClick("sticky")`.
76. [ ] On first form-field focus, fire `form_start` once per session.
77. [ ] On form submit click, fire `form_submit_attempt`.
78. [ ] On successful response, fire `form_success`.
79. [ ] On error response, fire `form_error` with error-code label.
80. [ ] Add GTM loader in `(lp)/layout.tsx` only when `NEXT_PUBLIC_GTM_ID` exists.
81. [ ] Add `<noscript>` GTM iframe fallback in `<body>`.
82. [ ] Ensure GTM is not loaded twice by shared root layout.
83. [ ] Add GA4 `gtag` support only when `NEXT_PUBLIC_GA4_ID` exists.
84. [ ] Track page view on route change.
85. [ ] Send custom dimensions for service and location (if configured).
86. [ ] Create attribution parser `src/modules/tracking/attribution.ts`.
87. [ ] Parse URL query params for UTM params and click IDs.
88. [ ] Save attribution object in first-party cookie for 30 days.
89. [ ] Persist attribution in `sessionStorage` for immediate use.
90. [ ] Expose `getAttribution()` helper to form submitter.
91. [ ] Build dynamic text replacement utility `src/modules/lp/dtr.ts`.
92. [ ] Replace copy tokens: `{{location}}`, `{{service}}`, `{{keyword}}`.
93. [ ] Apply token replacement server-side before render.
94. [ ] In LP page loader, validate `service` param against allowlist: `boiler-repair`, `boiler-installation`.
95. [ ] Normalize `location` slug to lowercase kebab-case.
96. [ ] Resolve friendly location label from content file (for example `west-london` -> `West London`).
97. [ ] Create `src/modules/lp/templates/RepairTemplate.tsx`.
98. [ ] Compose Repair template order: Hero -> TrustStrip -> FaultList -> Pricing -> Proof -> Coverage -> FAQ -> QuoteForm.
99. [ ] Create `InstallTemplate.tsx` without fault list and with finance emphasis.
100. [ ] In `[service]/[location]/page.tsx`, switch template by `service` param.
101. [ ] If service is unknown, return 404.
102. [ ] Set page metadata (`title`, `description`) from content JSON.
103. [ ] Add canonical URL generation per LP route.
104. [ ] Create JSON-LD generator `src/modules/seo/localBusinessJsonLd.ts`.
105. [ ] Include business name, phone, area served, service type, aggregate rating (if available), and address region.
106. [ ] Inject JSON-LD script in LP page head.
107. [ ] Create `src/modules/lp/components/StickyCallBar.tsx`.
108. [ ] Show sticky call bar only when viewport width is `< 1024px`.
109. [ ] Include call icon and label `Call Now`.
110. [ ] Add bottom padding in page content so bar does not overlap form submit button.
111. [ ] Add performance budget check: LCP target `< 2.5s` on 4G emulation.
112. [ ] Convert hero image to `next/image` with explicit sizes and `priority={true}`.
113. [ ] Use system fonts or a single preloaded variable font.
114. [ ] Lazy-load non-critical below-the-fold components where beneficial.
115. [ ] Create finance page content module `finance.json`.
116. [ ] Add finance sections: eligibility, representative example, lender panel note, FCA disclaimer.
117. [ ] Add `Check eligibility` lead-form variant using same backend with `leadType=finance`.
118. [ ] Create about-trust page content module `about-trust.json`.
119. [ ] Add about-trust sections: company story, engineer credentials, guarantee policy, review proof, contact info.
120. [ ] Add visible Gas Safe number and insurance statement block on about-trust page.
121. [ ] Create call-tracking number abstraction `src/modules/tracking/callNumber.ts`.
122. [ ] Add rule: if `utm_source=google` and campaign includes `repair`, show tracking number A; else default number.
123. [ ] Store call-number mapping in env JSON string or static config.
124. [ ] Fallback to default call number if mapping is missing.
125. [ ] Add Cypress or Playwright E2E tests for LP critical path.
126. [ ] Add E2E test: Hero renders location-specific H1.
127. [ ] Add E2E test: call CTA `href` starts with `tel:`.
128. [ ] Add E2E test: form validation prevents empty submit.
129. [ ] Add E2E test: successful form submit shows success state.
130. [ ] Add E2E test: `dataLayer` receives `form_success` event.
131. [ ] Add unit tests for content loader + Zod validation.
132. [ ] Add unit tests for attribution parser + cookie persistence.
133. [ ] Add unit tests for DTR token replacement.
134. [ ] Configure CI pipeline: lint, typecheck, test, build.
135. [ ] Block merges on failed checks.
136. [ ] Add preview deployment per PR.
137. [ ] Add production deployment only from `main` with manual approval.
138. [ ] Create `docs/lp-ops.md`.
139. [ ] Document how to add a new location LP in 5 steps.
140. [ ] Document event names and expected GA4 parameters.
141. [ ] Document webhook payload schema for CRM/n8n ingestion.
142. [ ] Document weekly A/B test process: hypothesis, variant, runtime, and winner criteria.

## Bonus: First LPs to Generate Immediately

- [ ] `/lp/boiler-repair/uxbridge`
- [ ] `/lp/boiler-repair/hayes`
- [ ] `/lp/boiler-installation/uxbridge`
- [ ] `/lp/boiler-installation/hayes`
- [ ] `/finance`
- [ ] `/about-trust`
