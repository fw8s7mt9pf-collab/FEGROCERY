# Implement flyer extraction pipeline

Status: Open
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
