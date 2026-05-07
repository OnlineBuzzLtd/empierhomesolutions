# Env Var Management Runbook

**Audience**: anyone setting / rotating env vars on Vercel projects.
**Origin**: EHS-020. Codifies lessons from the 2026-05-07 incident where three env vars (`NEXT_PUBLIC_GOOGLE_ADS_ID`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`) were silently corrupted with trailing `\n`, causing Cloudflare's siteverify to reject every Turnstile token and the whole lead form to 403.

## The rule

When piping values into `vercel env add` from the CLI, **always use `printf '%s'`, never `echo`**:

```bash
# ✅ Correct
printf '%s' '0x4ABCDEF...secret' | vercel env add TURNSTILE_SECRET_KEY production

# ❌ Wrong — adds a literal newline
echo "0x4ABCDEF...secret" | vercel env add TURNSTILE_SECRET_KEY production
```

`echo` (without `-n`) appends a newline to its output. Vercel stores that newline as part of the value. Most consumers (curl, Next.js `process.env`) treat it as part of the string, so the corrupted value silently fails downstream — Turnstile rejected secrets ending in `\n` because Cloudflare's siteverify endpoint is strict about whitespace.

`printf '%s'` writes the value with no terminator. Use this every time.

## Verifying a value before declaring success

After any `vercel env add`, **always** pull the env back and grep:

```bash
rm -f /tmp/.env.check
vercel env pull /tmp/.env.check --environment=production
grep -E '^MY_VAR=' /tmp/.env.check
# Look for: MY_VAR="value"  ← clean
# Reject:    MY_VAR="value\n"  ← corrupted
```

If you see a literal `\n` in the dotenv-encoded value, remove and re-add with `printf`.

## Removing an env var

The CLI prompts interactively unless you pass `-y`:

```bash
vercel env rm MY_VAR production -y
vercel env rm MY_VAR preview -y
```

## Triggering a deploy after an env var change

Env var changes do **not** auto-deploy. New deployments need to be built with the new env baked in. Either:

1. **Empty commit + push** (preferred — keeps changes in the git audit log):
   ```bash
   git commit --allow-empty -m "chore(deploy): rebuild for ENV_VAR_NAME"
   git push origin main
   ```
2. **CLI direct deploy**:
   ```bash
   vercel deploy --prod --yes
   ```
3. **Re-promote latest preview** (rebuilds with prod env):
   ```bash
   echo "y" | vercel promote https://<latest-preview-url>.vercel.app
   ```

If pushes to `main` aren't triggering Production deploys, see [TICKET EHS-003](../follow-up-tickets.md) — usually the project's Production Branch is wrong.

## Common values that need this care

These env vars have caused issues before because trailing whitespace breaks the consumer:

| Var | Consumer | Failure mode if `\n` appended |
|---|---|---|
| `TURNSTILE_SECRET_KEY` | Cloudflare siteverify | Returns `success: false`, all form submissions get `bot_check_failed` 403 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase JWT verification | `Invalid JWT` errors, RLS-bypass calls fail |
| `*_API_TOKEN` (any) | HTTP `Authorization: Bearer …` header | Server returns 401; some servers `400` on malformed header |
| `NEXT_PUBLIC_*` IDs | Embedded in HTML | Visually fine, but consumers that match exact ID (Google Ads detector, GTM) silently fail |

## Future-proofing: optional CI lint

Recommended for `EHS-020` follow-up — a CI step that pulls each environment and asserts no values contain `\n`, `\r`, or trailing whitespace:

```bash
vercel env pull /tmp/.env.lint --environment=production
if grep -P '\\n"|\\r"' /tmp/.env.lint; then
  echo "❌ Env var with trailing whitespace detected" >&2
  exit 1
fi
```

Wire this into the `deploy` workflow before the Vercel deploy step. Catches the problem at PR time instead of after a failed deploy.
