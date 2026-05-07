# Incident response runbook

## Severity definitions

| Sev | Examples                                            | Response time |
| --- | --------------------------------------------------- | ------------- |
| S1  | Confirmed breach; PII exfiltration; total outage    | 15 minutes    |
| S2  | Partial outage; degraded booking or voice flow      | 1 hour        |
| S3  | Single-tenant incident; non-PII bug                 | 4 hours       |

## Chain of command

1. On-call primary opens an incident channel in Slack (`#inc-{{yyyy-mm-dd}}`).
2. Primary invokes the DPO (`dpo@customerjourneys.ai`) for any suspected
   breach within 30 minutes.
3. Platform admin suspends affected tenants via
   `POST /api/crm/admin/tenants/:id/suspend` if containment requires it.

## Breach notification (GDPR Art. 33)

- Notify the controller within **72 hours** of confirmed breach.
- Include: nature, categories and approximate number of data subjects,
  likely consequences, mitigations in place.
- Template letter: `docs/compliance/templates/breach_notification.md`
  (to be committed ad-hoc, not shipped by default).

## Post-mortem

Every S1 / S2 gets a written post-mortem in `docs/incidents/{{yyyy-mm-dd}}-{{slug}}.md`
with five-whys, remediation tickets, and rollback notes. Reviewed in the
next weekly engineering sync.
