# Responsive mobile strategy

## Conclusion

Keep one site and refactor it to a **mobile-first responsive layout**. The desktop presentation should be the wide-screen state of the same page, not a separate desktop product. A separate mobile site is not justified here: shoppers perform the same task (find and inspect current deals), and this static Vite application already has one shared data source and page.

Google recommends responsive web design because the same URL and HTML with CSS that adapts to the device is easier to maintain. Its separate-mobile-URL guidance requires device detection, redirects, `Vary: User-Agent`, equivalent content/metadata, and reciprocal `canonical`/`alternate` annotations. It explicitly advises new sites to avoid separate mobile URLs because of their complexity.

## What the repository shows

- The app is a static TypeScript/Vite site deployed through GitHub Pages (`package.json`, `.github/workflows/refresh-and-publish.yml`). It renders a single deal board from `public/data/deals.json`; duplicating it would duplicate UI and release paths without changing the underlying user task.
- `index.html` already contains the required `width=device-width, initial-scale=1` viewport declaration, so mobile browsers can use the device width.
- Before the responsive refactor, the selected `ledger` style had several overlapping `@media (max-width: 760px)` sections and late overrides for the same hero, controls, cards, and grid. CSS source order made the effective phone layout difficult to reason about; the implementation now consolidates this into a mobile base with a `48rem` desktop enhancement.
- The page uses a 170 px desktop filter rail and two-column deal tickets. Those are appropriate wide-screen enhancements, but the phone layout should deliberately become a single vertical flow rather than merely compressing the desktop geometry.

## Recommended implementation

1. Consolidate the selected `ledger` CSS into one mobile base layer and a small number of `min-width` enhancements. Do not use the unused alternate-style rules as part of the live cascade.
2. On narrow screens: one-column header; full-width two filter controls; one deal ticket per row; thumbnail plus title/price; content may wrap but no horizontal scrolling; full-width modal content.
3. At the first content-driven breakpoint (roughly 48 rem, after checking the actual layout), enable the 170 px filter rail and two-column deal ticket. Keep the existing wide desktop treatment at larger widths. Choose breakpoints when the content needs them, not for named phone models.
4. Preserve one semantic HTML structure and one deal fetch. Use CSS Grid/Flexbox, fluid widths, `minmax(0, 1fr)`, `clamp()` for type, and `img { max-width: 100%; }`. Add a container query only if reusable card layout needs to react to its own available width rather than the viewport.
5. Test representative widths at 320, 360, 390, 768, 1024, and 1440 CSS pixels, including the open filter menus, grid/list switch, dialog, long product names, and browser text zoom. Add `prefers-reduced-motion` coverage for the animated hero.

## When a separate mobile experience would be warranted

Only split the interface if research shows that phone users need a materially different product flow or content—for example, location-led store selection, offline scan-and-save behaviour, or a native-app capability. A different arrangement of the current deal board is a responsive-design problem, not a separate-site problem.

## Sources

- [Google Search Central: mobile-first indexing and responsive design](https://developers.google.com/search/docs/crawling-indexing/mobile/mobile-sites-mobile-first-indexing)
- [Google Search Central: separate mobile URLs and mobile-first indexing](https://developers.google.com/search/blog/2020/03/announcing-mobile-first-indexing-for)
- [MDN: Responsive web design](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/CSS_layout/Responsive_Design)
- [MDN: CSS container queries](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Containment/Container_queries)
- [MDN: Responsive images](https://developer.mozilla.org/en-US/docs/Learn/HTML/Multimedia_and_embedding/Responsive_images)
