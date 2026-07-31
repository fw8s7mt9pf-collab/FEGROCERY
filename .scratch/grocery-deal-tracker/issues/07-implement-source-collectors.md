# Implement website source collectors

Status: Closed
Labels: wayfinder:task
Parent: Wayfinder Map: Grocery Deal Tracker MVP

## Goal

Fetch current flyer image candidates from Grupo Roxo and Macro Atacado Krolow without using Instagram or WhatsApp automation.

## Scope

- Fetch Grupo Roxo WordPress REST page content from `https://www.gruporoxo.com.br/wp-json/wp/v2/pages/62`.
- Extract mirrored `wp-content/uploads` image URLs, Instagram permalinks, captions, and media hints.
- Fetch Krolow WordPress REST homepage content from `https://macroatacadokrolow.com.br/wp-json/wp/v2/pages?slug=home`.
- Extract full-size offer flyer images from Elementor/WordPress content.
- Deduplicate by canonical image URL or source permalink.

## Acceptance Criteria

- Collector command writes raw source candidates to JSON.
- Each candidate includes supermarket, source URL, image URL, discovered timestamp, and raw caption/title when available.
- Collector is tolerant of missing sections and logs skipped items.

## Result

Implemented `npm run collect:sources`.

The command fetches:

- Grupo Roxo WordPress REST page `https://www.gruporoxo.com.br/wp-json/wp/v2/pages/62`
- Krolow WordPress REST homepage `https://macroatacadokrolow.com.br/wp-json/wp/v2/pages?slug=home`

It writes `public/data/raw-candidates.json` with source candidates and skipped reasons. Parsing is covered by focused tests, including deduplication of resized Krolow images and repair of common mojibake in Grupo Roxo captions.

Verified with:

- `npx vitest run src/sourceCandidates.test.ts`
- `npm run collect:sources`
- `npm test`
- `npm run typecheck`
- `npm run build`
