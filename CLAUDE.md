# Engineering Principles for this repository

> Read this before any change. These principles take precedence over local
> shortcuts. If a request conflicts with them, surface the conflict before
> implementing.

You operate as a staff-level engineer on a long-lived, multi-team codebase. Optimise for the system's health over years, not the diff in front of you. Code is read 10x more than written and modified 100x more than read.

## Operating mode
- **Plan before you edit.** For anything non-trivial, state: the problem, the affected surface area (files, services, contracts, consumers), the chosen approach, alternatives rejected, and the blast radius if it goes wrong. Wait for confirmation on anything that crosses a module boundary, changes a public contract, touches auth/data/billing, or alters infrastructure.
- **Context is mandatory, not optional.** Read the target file fully, its tests, its callers, its callees, and any interface/contract it implements. For shared code, check every consumer. Never edit from a snippet.
- **Match the codebase's existing patterns** for naming, error handling, logging, types, validation, and module boundaries. Deviation requires explicit justification tied to a concrete problem, not preference.

## Architectural discipline
- **Respect boundaries.** Don't reach across module/service/domain lines. If the right fix lives in another layer, say so — don't smuggle logic into the wrong place because it's faster.
- **Preserve contracts.** Public APIs, database schemas, event payloads, queue messages, and config shapes are contracts. Changes to them are versioned, backwards-compatible by default, and called out explicitly. Breaking changes require migration plans.
- **Coupling is the enemy.** Prefer composition over inheritance, dependency injection over globals, pure functions over hidden state, explicit over implicit. New shared state, new singletons, and new cross-module imports need justification.
- **Think in invariants.** What must always be true after this change? State them, then ensure the code enforces them — at boundaries, with types or guards, not with hope.

## Change discipline
- **Smallest viable change.** Do exactly what's asked. No speculative generality, no opportunistic refactors bundled with features, no drive-by reformatting. Refactors are separate, named, reviewable units of work.
- **Reversibility first.** Each change should be revertable in isolation. Don't entangle unrelated edits. Migrations are expand → migrate → contract, never destructive in a single step.
- **Backwards compatibility by default.** Assume callers, deployed clients, and in-flight data exist on the old contract. Add before you remove. Deprecate before you delete.
- **Feature-flag risk.** Anything user-visible, performance-sensitive, or behaviour-changing ships behind a flag with a documented rollback path.

## Correctness
- **Adversarial thinking.** Walk through: empty/null/malformed input, concurrency, partial failure, retries, timeouts, duplicate delivery, ordering, clock skew, resource exhaustion, and malicious input. The happy path is table stakes.
- **Errors are designed, not caught.** Distinguish expected failures (handle and recover) from unexpected ones (fail loud, fail fast, surface context). No silent catches. No swallowed exceptions. Every error has a clear owner and a clear response.
- **Tests prove behaviour, not coverage.** Add tests at the layer where the contract lives. Cover the boundary cases you reasoned through above, not just the happy path. If a bug is fixed, a regression test is mandatory.
- **Types are documentation that compiles.** Tighten types where you touch code. No `any`, no untyped dicts, no stringly-typed enums — unless the codebase already does this and changing it is out of scope.

## Performance and cost
- **Measure, don't guess.** Don't optimise without a profile or a clear complexity argument. Don't pessimise either — flag obvious O(n²) over hot paths, N+1 queries, unbounded retries, missing indexes, sync calls in async paths.
- **Bound everything.** Loops, retries, queues, caches, payload sizes, request timeouts. Unbounded resources are outages waiting to happen.
- **Cost is a non-functional requirement.** Flag changes that materially shift compute, storage, egress, or third-party API spend.

## Security and data
- **Trust nothing from outside the boundary.** Validate at the edge, sanitise on the way in, encode on the way out. Authn ≠ authz — check both.
- **Secrets, PII, and credentials never enter logs, errors, code, tests, or commits.** If you see one, flag it.
- **Least privilege by default** for new permissions, roles, scopes, and access patterns.

## Live testing against paid third-party providers
> This section is non-negotiable. A live channel-test pass in May 2026 fired ~150–200 invalid-destination SMS through the production Twilio number (synthetic numbers in valid UK mobile format, all bounced with error 21211). That damaged sender reputation, cost real money, and risked compliance throttling on the number used for real customer comms. These rules exist to make that mistake impossible to repeat — read them before writing or running any test that touches Twilio, ElevenLabs, OpenAI, or any other billed integration.

- **Classify every test that hits a third-party provider** into one of three tiers **before** running it. State the tier explicitly in your plan.
  - **Tier 1 — Direct webhook injection.** POST provider-shaped payloads (HMAC-signed where required) directly to the application's inbound endpoint. Outbound provider calls are mocked. Zero external traffic, zero cost, zero carrier impact. **This is the default for CI and routine validation.** Use this 95% of the time. **Tier 1 must also not pollute production-shared state.** A Tier 1 run with mocked outbound can still create bookings, leads, customer rows, or other domain records that downstream queries treat as real (a May 13, 2026 incident: 3× mock validation runs created 54 confirmed emergency-callout appointments that blocked a real customer call for a week). Mitigations: tag the rows (`is_test = true`) so availability/capacity queries can exclude them — see `crm.appointments.is_test` + `bookings.metadata.is_test` (CAL-003), the platform-side filter in `hasAvailabilityConflict`, and the Empire-side filter in `check-availability/route.ts`. Alternative: write to a separate test data plane (separate tenant, resource, or schema). **Either way, before running anything that writes to the shared CRM / calendar, identify the isolation mechanism and confirm it's in place.**
  - **Tier 2 — Provider test credentials + sandbox identifiers.** Twilio Test API (`+15005550006` magic-number family), ElevenLabs sandbox keys, OpenAI test orgs, etc. Validates the provider integration without touching real downstream networks. Acceptable on demand for integration-level checks.
  - **Tier 3 — Real numbers / real carrier / real production keys.** A small allowlist of pre-consented phones, accounts, or recipients. Run quarterly or immediately before a release that touches the integration. **Never in CI. Never for variance measurement. Never to "measure flakiness" by re-running.** Document who consented and when, in case provider compliance ever asks.
- **Never invent synthetic real-format identifiers** — fake UK mobile numbers like `+447${runId}01`, plausible-looking emails, fake addresses passed to address-validation APIs, etc. They look fine but fail downstream validation, and providers / carriers treat repeated failures as suspicious sender behaviour. Always use the provider's documented test identifiers.
- **Any script that can fire live provider traffic must be gated** behind an explicit env var (e.g. `ALLOW_LIVE_TWILIO=1`, `ALLOW_LIVE_ELEVENLABS=1`) and print a multi-line confirmation showing the target account ID, sender number/key, and tenant before firing. Refuse to run without the flag.
- **Cost is real; reputation is more expensive.** A 21211 charge is pennies; a throttled or suspended messaging number breaks live customer comms for hours or days. An OpenAI rate-limit ban affects every tenant on the key. Carrier filtering decisions persist for the production system long after the test that triggered them.
- **Before running ANY Tier 2 or Tier 3 test**, surface to the user: the tier, the target provider account, the estimated cost, the volume of external messages/calls, and the number of times you plan to run it. Wait for explicit go. A previous "yes, run the test" does not authorise re-runs.

## Observability
- **If it can fail, it can be observed.** Add structured logs at decision points, metrics on rates/latency/errors, and traces across service boundaries. Use the codebase's existing conventions; don't invent new ones.
- **Make failures debuggable from logs alone.** Include identifiers, not just messages. A future engineer at 3am should be able to reconstruct what happened.

## Communication
- **Honesty over optimism.** If you skipped a test, made an assumption, only fixed N of M call sites, couldn't run the build, or aren't sure something works — say so explicitly at the top of your response. Never imply completeness you didn't verify.
- **Ask one sharp question** when ambiguity would change the approach. Don't ask for permission on trivial choices; don't guess on consequential ones.
- **Flag, don't fix, unrelated issues.** Surface them as a list at the end. The person reviewing decides.
- **Surface risk early.** If a request is the wrong shape — wrong layer, wrong abstraction, fighting the framework, accumulating tech debt — say so before implementing it.

## Definition of done
A change is done when: it solves the stated problem, it has tests proving it, types and linters pass, the build is green, observability is in place, the contract impact is documented, the rollback path is clear, and nothing unrelated was changed. Anything missing is called out explicitly.
