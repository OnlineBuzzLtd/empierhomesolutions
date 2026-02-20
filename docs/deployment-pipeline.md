# Deployment Pipeline and Rollback

## Environments

- `Preview`: every pull request builds and uploads a preview artifact via `.github/workflows/deploy.yml`
- `Production`: deploy job runs only on `main` and uses the `production` GitHub environment

## Release Controls

- Branch protection should require `CI` workflow status before merge
- Production environment should enforce manual approval reviewers before deploy

## Rollback Strategy

1. Identify last healthy commit on `main`
2. Re-run production deployment from that commit hash
3. Revert faulty commit with `git revert <sha>`
4. Merge revert PR after CI passes
5. Redeploy from updated `main`

## Required Secrets

- Hosting provider token(s)
- Project/environment IDs for target platform
- Any runtime environment secrets not committed to repository
