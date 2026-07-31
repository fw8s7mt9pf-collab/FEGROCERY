# Scaffold static flyer website

Status: Closed
Labels: wayfinder:task
Parent: Wayfinder Map: Grocery Deal Tracker MVP

## Goal

Create the minimal static website foundation for the grocery deal tracker.

## Scope

- Choose a light static setup for a low-cost site.
- Add a public page that can load generated deal JSON.
- Add responsive category and supermarket filters.
- Add flyer grid and full-size image viewing.
- Keep the first implementation simple enough to host on GitHub Pages or Cloudflare Pages.

## Acceptance Criteria

- Site runs locally.
- Site can render sample deal data.
- UI supports the fixed category list.
- Expired flyers are not shown in the main view.

## Result

Implemented a Vite static app with plain TypeScript, sample flyer JSON, category and supermarket filters, current flyer filtering, and full-size flyer viewing.

Verified with:

- `npm test`
- `npm run typecheck`
- `npm run build`
- local HTTP checks for `/` and `/data/deals.sample.json`
