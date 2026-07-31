# Wayfinder Map: Grocery Deal Tracker MVP

## Destination

A low-cost MVP spec for an always-available grocery deal website for Camaqua/RS. The site shows current supermarket deal flyers by category, refreshes 2-3 times per day, publishes automatically, and ingests deal flyers from supermarket website/Instagram sources without WhatsApp automation.

## Notes

Use the wayfinder, grilling, domain-modeling, and research skills. GitHub Issues are intended as the tracker for this map, but this file mirrors the map until the GitHub connector has access to the target repository.

Resolved direction from initial grilling:

- Expected initial audience is 5-10 users.
- Fully automatic publishing is acceptable for the MVP.
- Instagram stories and WhatsApp sources are out of scope for v1.
- Instagram posts may be scraped/imported if useful.
- Flyers are the primary deal unit; no need to create product cards for every item in dense flyers.
- Categories are a fixed list: Meats, Produce, Basic Groceries, Cleaning, Hygiene, Beverages, Bakery, Frozen, Other.
- V1 shows current deals by category; no supermarket-to-supermarket price comparison.
- Flyer metadata should include supermarket, category, valid from, valid until, source link, and last refreshed.
- Flyers with unclear validity should publish with a warning and expire after 48 hours.
- Expired flyers disappear from the user-facing site but remain stored for debugging/history.
- GitHub access was fixed through GitHub CLI rather than the Codex GitHub connector. Use `C:\Program Files\GitHub CLI\gh.exe` for issue operations if needed.
- The core Wayfinder decisions are now resolved. Next work should create implementation tickets for the scraper, extraction pipeline, generated data, and website.

Known source notes:

- Grupo Roxo promotions page: https://www.gruporoxo.com.br/promocoes/ embeds recent @roxocentrodecompras Instagram posts and direct Instagram CDN flyer images.
- Macro Atacado Krolow homepage: https://macroatacadokrolow.com.br/ includes an Ofertas Especiais area and image, but source extraction details still need inspection.

## Decisions so far

- [Research website source: Grupo Roxo](https://github.com/fw8s7mt9pf-collab/FEGROCERY/issues/5) - Ingest Grupo Roxo from its WordPress promotions page/REST content, using mirrored `wp-content/uploads` flyer images and Instagram permalinks; no third-party Instagram scraper needed for this source.
- [Research website source: Macro Atacado Krolow](https://github.com/fw8s7mt9pf-collab/FEGROCERY/issues/4) - Ingest Krolow from its WordPress homepage/REST content, using full-size Elementor offer carousel image links under `wp-content/uploads`; no third-party scraper needed for this source.
- [Decide low-cost hosting and refresh pipeline](https://github.com/fw8s7mt9pf-collab/FEGROCERY/issues/3) - Use a static-site-first v1 with GitHub Actions scheduled refreshes 2-3 times per day, generated JSON metadata, and `$0/month` hosting via GitHub Pages or Cloudflare Pages Free.
- [Decide flyer extraction behavior](https://github.com/fw8s7mt9pf-collab/FEGROCERY/issues/2) - Use AI vision/OCR during scheduled refreshes only, write extracted metadata to generated JSON, keep original flyer images as the source of truth, and apply a warning plus 48-hour fallback expiry when validity is unclear.
- [Decide flyer browsing UX](https://github.com/fw8s7mt9pf-collab/FEGROCERY/issues/6) - Use a flyer-first website with category and supermarket filters, current flyer grid grouped by category, warning/validity metadata, and full-size image viewing.

## Not yet specified

- Exact app file structure.
- Whether debug history is a hidden static page, JSON artifact only, or a later admin surface.

## Implementation Queue

- [Scaffold static flyer website](https://github.com/fw8s7mt9pf-collab/FEGROCERY/issues/7)
- [Implement website source collectors](https://github.com/fw8s7mt9pf-collab/FEGROCERY/issues/8)
- [Implement flyer extraction pipeline](https://github.com/fw8s7mt9pf-collab/FEGROCERY/issues/9)
- [Add scheduled refresh and publish workflow](https://github.com/fw8s7mt9pf-collab/FEGROCERY/issues/10)
- [Add refresh debug artifacts](https://github.com/fw8s7mt9pf-collab/FEGROCERY/issues/11)

## Out of scope

- WhatsApp automation for private group/status sources.
- Instagram stories.
- Product-level price comparison across supermarkets.
- Creating individual product cards for every item in each flyer.
