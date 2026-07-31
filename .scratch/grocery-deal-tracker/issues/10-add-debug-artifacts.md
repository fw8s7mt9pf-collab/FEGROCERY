# Add refresh debug artifacts

Status: Closed
Labels: wayfinder:task
Parent: Wayfinder Map: Grocery Deal Tracker MVP

## Goal

Keep enough refresh history to diagnose bad imports without exposing an admin system.

## Scope

- Store latest raw candidates.
- Store latest extraction warnings.
- Store skipped images with reasons where possible.
- Store expired flyer records separately from public current deals.

## Acceptance Criteria

- Public site only shows current non-expired flyers.
- Debug JSON artifacts are generated.
- Refresh timestamps are visible in debug output.

## Result

Generated debug artifacts now include:

- `public/data/raw-candidates.json` for latest raw source candidates and skipped source reasons
- `public/data/extraction-debug.json` for extraction warnings
- `public/data/refresh-debug.json` for refresh timestamps, counts, warnings, and source skipped reasons
- `public/data/expired-deals.json` for expired flyer records kept out of the public deal list

`public/data/deals.json` now contains only current non-expired public deals.

Verified with:

- `npx vitest run src/flyerExtraction.test.ts`
- `npm run refresh:data`
- `npm test`
- `npm run typecheck`
- `npm run build`
