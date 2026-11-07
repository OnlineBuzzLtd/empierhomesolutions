#!/usr/bin/env bash
#
# Follow Agent -> CRM in real time.
#
# Streams two sides of the flow into a single local terminal:
#   LEFT  (CJ)     -> Cloud Run platform-api logs: every voice tool call, every
#                     BookingConfirmed/ConversationStarted publish, every error
#   RIGHT (Empire) -> Supabase polls: new crm.platform_event_log rows, new
#                     leads/customers/appointments
#
# Usage:
#   ./scripts/local/follow-agent-to-crm.sh
#
# Pre-reqs:
#   - gcloud auth (project: customer-journeys-ai)
#   - psql on PATH (libpq from brew works: /usr/local/Cellar/libpq/17.5/bin/psql)
#   - .env.local with SUPABASE_DB_PASSWORD (this script reads it)
#
# Stop with Ctrl+C — both tails are killed together.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="$ROOT/.env.local"
PROJECT="customer-journeys-ai"
SERVICE="customerjourneys-platform-api"
PSQL="${PSQL:-$(command -v psql || echo /usr/local/Cellar/libpq/17.5/bin/psql)}"

if [[ ! -x "$PSQL" ]]; then
  echo "psql not found. Set PSQL=/path/to/psql or brew install libpq." >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE — need SUPABASE_DB_PASSWORD." >&2
  exit 1
fi

EMPIRE_PW="$(grep '^SUPABASE_DB_PASSWORD' "$ENV_FILE" | cut -d= -f2)"
EMPIRE_DB="postgres://postgres.dodttkkkmxsqfewuahqi:${EMPIRE_PW}@aws-1-eu-west-1.pooler.supabase.com:5432/postgres"

CYAN='\033[0;36m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'; RED='\033[0;31m'; DIM='\033[2m'; RST='\033[0m'

echo -e "${CYAN}=== Agent -> CRM live tail ===${RST}"
echo -e "${DIM}CJ logs    : Cloud Run ${SERVICE}${RST}"
echo -e "${DIM}Empire DB  : crm.platform_event_log / leads / customers / appointments${RST}"
echo -e "${DIM}Make a call. Stop with Ctrl+C.${RST}"
echo ""

# Kill children on exit so Ctrl+C cleans up both tails
trap 'kill $(jobs -p) 2>/dev/null; exit 0' INT TERM EXIT

# ---------- CJ side: stream Cloud Run logs ----------
(
  gcloud logging tail "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"${SERVICE}\"" \
    --project="$PROJECT" \
    --format='value(timestamp, jsonPayload.msg, jsonPayload.eventType, jsonPayload.event, jsonPayload.idempotencyKey, jsonPayload.req.url, jsonPayload.statusCode, jsonPayload.err.message, httpRequest.requestUrl, httpRequest.status)' 2>&1 \
    | while IFS=$'\t' read -r ts msg eventType event idem url status errmsg httpUrl httpStatus; do
        # Skip noise: health checks, polling, empty rows
        [[ "$httpUrl" == *"/health"* ]] && continue
        [[ "$httpUrl" == *"/test-surface"* ]] && continue
        [[ -z "$msg$eventType$event$errmsg$httpUrl" ]] && continue

        time_short="${ts:11:8}"

        if [[ -n "$errmsg" ]]; then
          echo -e "${RED}[CJ ${time_short}] ERR: ${errmsg}${RST}"
          continue
        fi
        if [[ "$eventType" == "BookingConfirmed" || "$eventType" == "ConversationStarted" ]]; then
          echo -e "${GREEN}[CJ ${time_short}] PUBLISH ${eventType} (${idem})${RST}"
          continue
        fi
        if [[ -n "$httpUrl" ]]; then
          # Trim host
          short_url="${httpUrl##*.run.app}"
          color="$DIM"
          [[ "$httpStatus" == "5"* ]] && color="$RED"
          [[ "$httpStatus" == "4"* ]] && color="$YELLOW"
          echo -e "${color}[CJ ${time_short}] ${httpStatus} ${short_url}${RST}"
          continue
        fi
        if [[ -n "$msg" ]] && [[ "$msg" != "incoming request" ]] && [[ "$msg" != "request completed" ]]; then
          echo -e "${DIM}[CJ ${time_short}] ${msg}${RST}"
        fi
      done
) &

# ---------- Empire side: poll for new rows every 2s ----------
(
  TS_START="$(date -u +%Y-%m-%dT%H:%M:%S)"
  LAST_EVENT_TS="$TS_START"
  LAST_LEAD_TS="$TS_START"
  LAST_CUST_TS="$TS_START"
  LAST_APPT_TS="$TS_START"

  while true; do
    # New platform_event_log rows
    "$PSQL" "$EMPIRE_DB" -At -F'|' -c "
      select to_char(occurred_at,'HH24:MI:SS'), event_type, processing_status, coalesce(last_error,''), idempotency_key
      from crm.platform_event_log
      where occurred_at > '${LAST_EVENT_TS}'::timestamp
      order by occurred_at asc
    " 2>/dev/null | while IFS='|' read -r t et ps err idem; do
      [[ -z "$t" ]] && continue
      if [[ "$ps" == "processed" ]]; then
        echo -e "${GREEN}[CRM ${t}] EVENT ${et} processed (${idem})${RST}"
      else
        echo -e "${RED}[CRM ${t}] EVENT ${et} ${ps}: ${err}${RST}"
      fi
    done

    # New leads
    "$PSQL" "$EMPIRE_DB" -At -F'|' -c "
      select to_char(created_at,'HH24:MI:SS'), id, status, source, coalesce(customer_id::text,'(unlinked)')
      from crm.leads
      where created_at > '${LAST_LEAD_TS}'::timestamp
      order by created_at asc
    " 2>/dev/null | while IFS='|' read -r t id status src cust; do
      [[ -z "$t" ]] && continue
      if [[ "$cust" == "(unlinked)" ]]; then
        echo -e "${YELLOW}[CRM ${t}] LEAD created ${id:0:8} status=${status} src=${src} customer=UNLINKED${RST}"
      else
        echo -e "${GREEN}[CRM ${t}] LEAD created ${id:0:8} status=${status} src=${src} customer=${cust:0:8}${RST}"
      fi
    done

    # New customers
    "$PSQL" "$EMPIRE_DB" -At -F'|' -c "
      select to_char(created_at,'HH24:MI:SS'), id, coalesce(full_name,''), coalesce(phone,''), coalesce(email,''), coalesce(address_line1,''), coalesce(city,''), coalesce(postcode,'')
      from crm.customers
      where created_at > '${LAST_CUST_TS}'::timestamp
      order by created_at asc
    " 2>/dev/null | while IFS='|' read -r t id name phone email line1 city pc; do
      [[ -z "$t" ]] && continue
      filled=""
      [[ -n "$name"  ]] && filled+=" name"
      [[ -n "$phone" ]] && filled+=" phone"
      [[ -n "$email" ]] && filled+=" email"
      [[ -n "$line1" ]] && filled+=" addr"
      [[ -n "$city"  ]] && filled+=" city"
      [[ -n "$pc"    ]] && filled+=" postcode"
      echo -e "${GREEN}[CRM ${t}] CUSTOMER created ${id:0:8} '${name}'${filled}${RST}"
    done

    # New appointments
    "$PSQL" "$EMPIRE_DB" -At -F'|' -c "
      select to_char(created_at,'HH24:MI:SS'), id, type, status, to_char(starts_at,'YYYY-MM-DD HH24:MI'), coalesce(customer_id::text,'(unlinked)'), coalesce(lead_id::text,'(unlinked)')
      from crm.appointments
      where created_at > '${LAST_APPT_TS}'::timestamp
      order by created_at asc
    " 2>/dev/null | while IFS='|' read -r t id atype astatus starts cust lead; do
      [[ -z "$t" ]] && continue
      cs="${cust:0:8}"; ls="${lead:0:8}"
      [[ "$cust" == "(unlinked)" ]] && cs="UNLINKED"
      [[ "$lead" == "(unlinked)" ]] && ls="UNLINKED"
      echo -e "${GREEN}[CRM ${t}] APPT created ${id:0:8} ${atype}/${astatus} starts=${starts} customer=${cs} lead=${ls}${RST}"
    done

    # Advance watermarks to now (we already emitted everything before)
    NOW="$(date -u +%Y-%m-%dT%H:%M:%S)"
    LAST_EVENT_TS="$NOW"
    LAST_LEAD_TS="$NOW"
    LAST_CUST_TS="$NOW"
    LAST_APPT_TS="$NOW"

    sleep 2
  done
) &

wait
