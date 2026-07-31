# Add scheduled refresh and publish workflow

Status: Closed
Labels: wayfinder:task
Parent: Wayfinder Map: Grocery Deal Tracker MVP

## Goal

Refresh sources automatically 2-3 times per day and publish updated static data.

## Scope

- Add GitHub Actions schedule.
- Run collectors and extraction.
- Write generated JSON and any cached image artifacts.
- Commit or publish generated output in a way compatible with static hosting.
- Keep monthly cost at `$0` for v1 where possible.

## Acceptance Criteria

- Workflow can be run manually.
- Workflow has scheduled triggers.
- Public data updates without a server or database.
- Failures are visible in Actions logs.

## Result

Added `.github/workflows/refresh-and-publish.yml`.

The workflow:

- runs manually with `workflow_dispatch`
- runs three times per day on GitHub's UTC cron schedule
- installs dependencies with `npm ci`
- runs `npm run refresh:data`
- validates with tests, typecheck, and build
- commits changed `public/data/*.json` files back to the repository
- uploads `dist` and deploys to GitHub Pages

Added `npm run refresh:data` as the single local command used by the workflow.

Verified locally with:

- `npm run refresh:data`
- `npm test`
- `npm run typecheck`
- `npm run build`
