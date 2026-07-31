# Wire AI vision OCR refresh extraction

Status: Open
Labels: wayfinder:task
Parent: Wayfinder Map: Grocery Deal Tracker MVP

## Goal

Populate the existing `visionText` extraction seam with real AI vision/OCR output during scheduled refreshes.

## Scope

- Choose the provider and model for low-cost Portuguese flyer OCR.
- Read the provider API key from GitHub Actions secrets.
- Fetch each flyer image during refresh and send it to the model.
- Store the returned text in the extraction input as `visionText`.
- Keep AI calls in scheduled refresh only, never on public page views.
- Make failures non-fatal per flyer and record them in debug output.

## Acceptance Criteria

- Krolow image-only flyers can be categorized and date-parsed from image text when the secret is configured.
- Missing API key does not break local development; the pipeline falls back to caption/title-only extraction with warnings.
- Debug output records OCR failures and skipped AI calls.
- Cost remains bounded by the small source count and scheduled refresh cadence.
