# Decide flyer extraction behavior

Status: Closed
Labels: wayfinder:grilling
Parent: Wayfinder Map: Grocery Deal Tracker MVP

## Question

What extraction behavior should the MVP apply to flyer images?

Known direction:

- Flyers are the primary deal unit.
- The MVP does not need product cards for every item.
- Categories use a fixed list: Meats, Produce, Basic Groceries, Cleaning, Hygiene, Beverages, Bakery, Frozen, Other.
- Metadata should include supermarket, category, valid from, valid until, source link, and last refreshed.
- If validity is unclear, publish with a warning and expire after 48 hours.

## Decision

Use AI vision/OCR during scheduled refreshes, not during page views. Keep the website static and cheap by storing the extracted flyer metadata in generated JSON.

Extraction should produce:

- supermarket
- category from the fixed category list
- valid from, when visible
- valid until, when visible
- source link
- image URL or stored image path
- last refreshed timestamp
- warning flag when validity or category is uncertain

If the valid-until date cannot be read confidently, publish the flyer with a warning and apply a 48-hour fallback expiry. Do not attempt per-product extraction for dense flyers in v1; preserve the original flyer image as the source of truth.
