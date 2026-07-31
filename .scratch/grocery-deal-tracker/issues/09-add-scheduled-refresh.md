# Add scheduled refresh and publish workflow

Status: Open
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
