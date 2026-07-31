# Add refresh debug artifacts

Status: Open
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
