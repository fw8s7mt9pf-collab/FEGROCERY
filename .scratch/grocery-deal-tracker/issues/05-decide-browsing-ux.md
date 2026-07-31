# Decide flyer browsing UX

Status: Closed
Labels: wayfinder:prototype
Parent: Wayfinder Map: Grocery Deal Tracker MVP

## Question

What should the MVP website experience look like for 5-10 users browsing current supermarket flyers by category?

Known direction:

- V1 answers: what deals are available today by category?
- It does not compare prices across supermarkets.
- Expired flyers disappear from the main user-facing site.
- Flyer images should remain visible because extraction may be imperfect.

## Decision

Use a simple flyer-first website.

Primary screen:

- category filter using the fixed category list
- supermarket filter
- current flyer grid grouped by category
- flyer tile shows supermarket, category, validity, warning state, and last refreshed
- clicking a flyer opens the original full-size image

Behavior:

- default view shows all current flyers
- expired flyers are hidden from the public page
- warning badge appears when validity or category was inferred with low confidence
- no per-product cards and no cross-supermarket price comparison in v1

Optional debug surface:

- a private or unlinked debug JSON/page can list expired flyers, skipped images, extraction warnings, and refresh timestamps
