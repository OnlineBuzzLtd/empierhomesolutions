# Reporting Dashboard Spec

## Primary KPIs

- Conversion rate (`form_success / landing_sessions`)
- Cost per lead (`ad_spend / total_leads`)
- Call answer rate (`answered_calls / total_call_clicks`)

## Dimensions

- Service (`boiler-repair`, `boiler-installation`, `finance`)
- Location (`uxbridge`, `hayes`, etc.)
- Keyword / campaign (`utm_campaign`, `utm_term`)

## Data Sources

- GA4/GTM events for page and engagement tracking
- CRM webhook payloads for lead quality and status
- Call-tracking platform for answered/missed call outcomes

## Required Event Inputs

- `form_start`, `form_submit_attempt`, `form_success`, `form_error`
- `cta_call_click`, `sticky_call_click`, `faq_expand`
- Attribution params (`utm_*`, `gclid`, `msclkid`) attached to lead payload

## Weekly Review Views

- LP variant comparison (headline/CTA/trust-order)
- CVR by service-location route
- CPL trend by campaign and keyword
- Missed call trend by hour/day
