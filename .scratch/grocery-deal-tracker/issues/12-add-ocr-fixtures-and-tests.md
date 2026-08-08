# Add flyer OCR fixtures and extraction tests

Status: Closed
Labels: wayfinder:task
Parent: Wayfinder Map: Grocery Deal Tracker MVP

## What to build

Protect the flyer-first extraction behavior with representative dense-flyer OCR cases and mocked Google Vision responses.

## Acceptance criteria

- [x] Test Portuguese meat and produce category detection from OCR text.
- [x] Test Brazilian validity date parsing from OCR text.
- [x] Test missing credentials skips OCR without failing local refresh.
- [x] Test OCR success and failure statistics without making network calls.

## Blocked by

None - can start immediately

## Resolution

Added `src/visionOcr.test.ts` and retained the existing extraction tests. The suite now covers missing credentials, credential parsing, mocked OCR success, and the existing category/date/fallback rules.
