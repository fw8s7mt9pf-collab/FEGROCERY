# Implement website source collectors

Status: Open
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
