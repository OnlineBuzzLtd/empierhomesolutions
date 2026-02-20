# Performance Budget

## Targets

- LCP: `< 2.5s` on 4G emulation
- CLS: `< 0.1`
- INP: `< 200ms`

## Implemented Controls

- Hero image uses `next/image` with explicit dimensions and `priority`
- Non-critical sections are code-split with dynamic imports
- GTM/GA scripts load with deferred (`afterInteractive`) strategy
- LP pages are cacheable with static rendering + revalidation
- System font stack avoids extra font fetch overhead

## Verification Workflow

1. Run `npm run dev`
2. Open `/lp/boiler-repair/uxbridge`
3. Use Chrome Lighthouse mobile profile (4G throttling)
4. Confirm LCP is below 2.5s and note regressions in PR
