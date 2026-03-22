# Deployment Pipeline and Rollback

## Environments

- `Preview`: every pull request builds and uploads a preview artifact via `.github/workflows/deploy.yml`
- `Production`: deploy job runs only on `main` and uses the `production` GitHub environment

## Release Controls

- Branch protection should require `CI` workflow status before merge
- Production environment should enforce manual approval reviewers before deploy
- CRM release candidates should also pass `npm run crm:smoke:routes` and `npm run crm:smoke:remote`

## Rollback Strategy

1. Identify last healthy commit on `main`
2. Re-run production deployment from that commit hash
3. Revert faulty commit with `git revert <sha>`
4. Merge revert PR after CI passes
5. Redeploy from updated `main`

## Required Secrets

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`
- Any runtime environment secrets not committed to repository

## CRM Release Gate

Before approving a CRM production release:

1. Run `npm run lint`
2. Run `npm run typecheck`
3. Run `npm test`
4. Run `npm run build`
5. Run `CRM_BASE_URL=https://<deployment-url> npm run crm:smoke:routes`
6. Run `npm run crm:smoke:remote`
