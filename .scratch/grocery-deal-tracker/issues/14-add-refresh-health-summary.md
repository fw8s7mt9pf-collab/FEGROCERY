# Add refresh health summary

Status: Closed
Labels: wayfinder:task
Parent: Wayfinder Map: Grocery Deal Tracker MVP

## What to build

Make each scheduled refresh explain what happened without exposing credentials or full OCR payloads.

## Acceptance criteria

- [x] Record source, public, expired, and warning counts.
- [x] Record OCR provider, enabled state, attempts, successes, skips, and failures.
- [x] Record actionable OCR errors without secret material.
- [x] Keep the summary in generated debug JSON.

## Blocked by

None - can start immediately

## Resolution

`public/data/refresh-debug.json` now includes an OCR summary and errors while excluding candidate payloads and credentials.
