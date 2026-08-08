# Verify first end-to-end scheduled publication

Status: Open
Labels: wayfinder:task
Parent: Wayfinder Map: Grocery Deal Tracker MVP

## What to build

Configure Google Cloud Vision in GitHub Actions and verify one real scheduled refresh from supermarket sources through the published website.

## Acceptance criteria

- [ ] Add `GOOGLE_CLOUD_CREDENTIALS_JSON` to the repository Actions secrets.
- [ ] Run a real refresh and confirm OCR succeeds for image-only Krolow flyers.
- [ ] Confirm categories, validity dates, warnings, and image links on the published site.
- [ ] Confirm the workflow publishes generated data and remains successful when a source is unavailable.

## Blocked by

- Google Cloud Vision project and service-account setup by the repository owner.
