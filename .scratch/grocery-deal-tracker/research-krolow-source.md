# Research: Macro Atacado Krolow Source

## Question

How should the MVP ingest Macro Atacado Krolow flyers from https://macroatacadokrolow.com.br/?

## Finding

Use the Macro Atacado Krolow WordPress homepage as the primary ingestion source for v1.

The site is WordPress/Elementor. The homepage is reachable server-side and has a WordPress REST page endpoint at `https://macroatacadokrolow.com.br/wp-json/wp/v2/pages?slug=home`, with page id `560`.

The rendered Elementor content exposes the active flyer images directly as `wp-content/uploads` links. Current offer images include full-size JPEG links such as:

- `https://macroatacadokrolow.com.br/wp-content/uploads/2026/07/WhatsApp-Image-2026-07-30-at-20.00.15.jpeg`
- `https://macroatacadokrolow.com.br/wp-content/uploads/2026/07/WhatsApp-Image-2026-07-30-at-20.00.14-3.jpeg`
- `https://macroatacadokrolow.com.br/wp-content/uploads/2026/07/WhatsApp-Image-2026-07-30-at-20.00.14-2.jpeg`
- `https://macroatacadokrolow.com.br/wp-content/uploads/2026/07/WhatsApp-Image-2026-07-30-at-20.00.14-1.jpeg`
- `https://macroatacadokrolow.com.br/wp-content/uploads/2026/07/WhatsApp-Image-2026-07-30-at-20.00.14.jpeg`
- `https://macroatacadokrolow.com.br/wp-content/uploads/2026/07/WhatsApp-Image-2026-07-30-at-20.00.13.jpeg`

The public page also includes an explicit warning to verify offer validity dates, so the MVP should rely on flyer OCR/vision for validity dates and use the existing 48-hour fallback rule when dates are unclear.

## Recommended Implementation Shape

1. Fetch `https://macroatacadokrolow.com.br/wp-json/wp/v2/pages?slug=home`.
2. Parse the first page object's `content.rendered` as HTML.
3. Locate the offer carousel/lightbox area by extracting image links under `wp-content/uploads` whose filenames match recent flyer-like assets, especially `WhatsApp-Image-*.jpeg`.
4. Prefer the full-size anchor `href` image over resized `src` variants such as `-819x1024.jpeg`.
5. Deduplicate by full-size image URL.
6. Use the website homepage as the source link unless a more specific offer page appears later.
7. Send each full-size flyer image through the shared flyer extraction pipeline for category and validity detection.

## Risks

- Elementor markup may change if the page is edited.
- The homepage includes non-offer images, so extraction should filter for the active offers section or flyer-like filenames.
- The source link is less precise than Grupo Roxo because the offers appear on the homepage rather than a dedicated promotion permalink.

## Sources

- Macro Atacado Krolow homepage: https://macroatacadokrolow.com.br/
- Macro Atacado Krolow WordPress REST page endpoint: https://macroatacadokrolow.com.br/wp-json/wp/v2/pages?slug=home
