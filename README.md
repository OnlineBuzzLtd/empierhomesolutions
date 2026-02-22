# Empire Home Solutions - Paid LP Foundation

Next.js App Router build for paid landing pages with service/location variants, tracking, and lead capture.

## Local Demo

1. Install dependencies:

```bash
npm install
```

2. Copy environment values:

```bash
cp .env.example .env.local
```

3. Start dev server:

```bash
npm run dev
```

4. Open:

- `http://localhost:3000/lp/boiler-repair/uxbridge`
- `http://localhost:3000/lp/boiler-repair/hayes`
- `http://localhost:3000/lp/boiler-installation/uxbridge`
- `http://localhost:3000/lp/boiler-installation/hayes`
- `http://localhost:3000/lp/power-flushing/uxbridge`
- `http://localhost:3000/lp/power-flushing/hayes`
- `http://localhost:3000/finance`
- `http://localhost:3000/about-trust`

## Key Features Delivered

- Service/location LP routes with JSON content loader + Zod validation
- Dynamic text replacement for `{{location}}`, `{{service}}`, `{{keyword}}`
- LP templates for repair/install/power-flushing, plus finance and about-trust pages
- Sticky mobile call bar, hero call CTA tracking, FAQ expand tracking
- React Hook Form lead form with validation, honeypot, webhook submission
- Lead API with origin validation, sanitization, attribution, and rate limiting
- Attribution parsing and 30-day cookie persistence
- GTM/GA4 conditional loaders on LP layout only
- LocalBusiness JSON-LD injection and canonical metadata
- Unit tests (loader, attribution, DTR) + Playwright critical-path tests
- CI and deployment workflow scaffolding

## Scripts

- `npm run dev` - start development server
- `npm run lint` - run ESLint
- `npm run typecheck` - run TypeScript checks
- `npm run test` - run unit tests with coverage
- `npm run test:e2e` - run Playwright e2e tests
- `npm run build` - production build
- `npm run ci` - lint + typecheck + test + build

## Ops Docs

- `docs/lp-ops.md`
- `docs/lp-qa-checklist.md`
- `docs/deployment-pipeline.md`
- `docs/reporting-dashboard-spec.md`
