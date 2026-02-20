# LP Ops Runbook

## Add a New Location LP in 5 Steps

1. Create JSON files in `src/modules/lp/content/locations/` for repair/install variants.
2. Add entries to `lpContentMap` in `src/modules/lp/content/loadContent.ts`.
3. Confirm route path works at `/lp/<service>/<location>` and metadata is valid.
4. Add local proof cards, postcode coverage, and FAQs for the new location.
5. Run `npm run ci` before merge.

## Event Names and GA4 Parameters

- `page_view`: `page_path`, `service`, `location`, `utm_source`, `utm_medium`, `utm_campaign`
- `cta_call_click`: `label=hero`
- `sticky_call_click`: `label=sticky`
- `form_start`: no extra params
- `form_submit_attempt`: no extra params
- `form_success`: success conversion event
- `form_error`: `label=<error_code>`
- `faq_expand`: `label=<faq_id>`

## Webhook Payload Schema (CRM/n8n)

```json
{
  "name": "Jane Smith",
  "postcode": "UB8 1AA",
  "phone": "07911123456",
  "issue": "No hot water since this morning",
  "leadType": "repair",
  "metadata": {
    "timestamp": "2026-02-19T10:00:00.000Z",
    "pagePath": "/lp/boiler-repair/uxbridge",
    "service": "boiler-repair",
    "location": "Uxbridge"
  },
  "attribution": {
    "utm_source": "google",
    "utm_medium": "cpc",
    "utm_campaign": "repair-uxbridge",
    "gclid": "..."
  }
}
```

## Weekly A/B Test Process

1. Define hypothesis and choose flag (`headline`, `cta`, or `trustOrder`).
2. Configure variant in `NEXT_PUBLIC_LP_AB_FLAGS`.
3. Run each variant for a fixed runtime (minimum 7 days).
4. Compare CVR and CPL against control.
5. Promote winner, archive findings, and queue next test.
