# Research: Grupo Roxo Source

## Question

How should the MVP ingest Grupo Roxo flyers from https://www.gruporoxo.com.br/promocoes/?

## Finding

Use the Grupo Roxo WordPress promotions page as the primary ingestion source for v1, not a third-party Instagram scraper.

The promotions page is reachable server-side and exposes a WordPress REST page endpoint at `https://www.gruporoxo.com.br/wp-json/wp/v2/pages/62`. That endpoint includes the rendered Instagram widget markup used on the public promotions page.

The rendered content includes:

- Local mirrored flyer image URLs under `https://www.gruporoxo.com.br/wp-content/uploads/...`
- Instagram post/reel source links like `https://www.instagram.com/p/DbcB0tjFSHN/`
- Caption/alt text such as `Ofertas do Hortifruti Roxo` and `Ofertas do Final de Semana ROXO`
- Media type hints from the WPZOOM Instagram widget markup, including carousel and video items

This means the MVP can ingest Grupo Roxo by polling the WordPress REST endpoint 2-3 times per day, parsing widget items, deduplicating by Instagram permalink or image URL, and downloading the mirrored image for OCR/vision/category extraction.

## Recommended Implementation Shape

1. Fetch `https://www.gruporoxo.com.br/wp-json/wp/v2/pages/62`.
2. Parse `content.rendered` as HTML.
3. Extract each Instagram widget item:
   - image URL from `data-src`
   - Instagram permalink from `href`
   - caption from `alt` or link `title`
   - media type from the item `data-media-type`
4. Ignore obvious non-deal posts during extraction/classification if caption and image do not indicate a flyer.
5. Use the mirrored `wp-content/uploads` image URL when available, because it is first-party to the supermarket site and avoids relying on expiring Instagram CDN URLs.
6. Store the Instagram permalink as the source link shown to users.

## Risks

- The WPZOOM Instagram widget markup may change if the site theme/plugin changes.
- The page currently includes some non-deal social posts, so the extraction pipeline still needs a deal/flyer classifier.
- Carousel posts may only expose a representative image in the widget; full carousel extraction may require opening Instagram or accepting that v1 captures the visible representative flyer only.

## Sources

- Grupo Roxo promotions page: https://www.gruporoxo.com.br/promocoes/
- Grupo Roxo WordPress REST page endpoint: https://www.gruporoxo.com.br/wp-json/wp/v2/pages/62
