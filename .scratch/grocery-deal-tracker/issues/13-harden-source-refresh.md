# Harden source refresh and duplicate handling

Status: Closed
Labels: wayfinder:task
Parent: Wayfinder Map: Grocery Deal Tracker MVP

## What to build

Keep a partial refresh useful when one supermarket source or one flyer is unavailable, while preserving deduplication across repeated source records.

## Acceptance criteria

- [x] A source failure does not prevent other source candidates from being processed.
- [x] An individual OCR or image failure does not prevent other flyers from being published.
- [x] Duplicate source candidates remain collapsed by source permalink or image URL.
- [x] Failures are recorded in refresh diagnostics.

## Blocked by

None - can start immediately

## Resolution

The existing source collector uses independent source results, and the OCR adapter now handles authentication and per-image failures without aborting extraction. Refresh diagnostics include skipped sources and OCR errors.
