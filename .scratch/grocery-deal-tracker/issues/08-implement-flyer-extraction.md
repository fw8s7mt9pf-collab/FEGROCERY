# Implement flyer extraction pipeline

Status: Closed
Labels: wayfinder:task
Parent: Wayfinder Map: Grocery Deal Tracker MVP

## Goal

Turn flyer image candidates into public deal metadata using AI vision/OCR during scheduled refreshes.

## Scope

- Classify each flyer into the fixed category list.
- Extract valid-from and valid-until dates when visible.
- Preserve original image URL/path as source of truth.
- Apply warning and 48-hour fallback expiry when validity is unclear.
- Avoid per-product extraction for dense flyers in v1.

## Acceptance Criteria

- Extraction writes normalized deal JSON.
- Low-confidence category or date fields set warning metadata.
- Dense flyers remain a single flyer record.
- Pipeline can run on sample Prado and Krolow-style images.

## Result

Implemented `npm run extract:flyers`.

The pipeline reads `public/data/raw-candidates.json` and writes:

- `public/data/deals.json`
- `public/data/extraction-debug.json`

Current extraction uses the candidate caption/title plus an optional `visionText` seam for AI vision/OCR output. It classifies into the fixed category list, parses common Brazilian validity-date formats, preserves the original flyer image URL, keeps one deal per flyer candidate, and applies warning metadata plus a 48-hour fallback expiry when dates are unclear.

Verified with:

- `npx vitest run src/flyerExtraction.test.ts`
- `npm run collect:sources`
- `npm run extract:flyers`
- `npm test`
- `npm run typecheck`
- `npm run build`
