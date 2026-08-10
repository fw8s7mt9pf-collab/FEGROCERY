# Website design style: Fazenda Emanuel editorial scrapbook

## Direction

Create a warm, confident **digital noticeboard from the farm**: part printed parish bulletin, part family photo album, part market placard. It should feel human and well-made rather than rustic-for-rustic's-sake. The reference posts repeatedly combine deep green, creamy paper, oversized type, tactile grain, pinned photographs, and small celebratory details.

Use the style to make grocery deals feel trusted and local: a neighbour showing what is worth buying this week.

## The visual rules

### Colour

| Role | Token | Value | Use |
| --- | --- | --- | --- |
| Forest | `--forest-950` | `#092714` | Hero areas, footer, high-contrast sections |
| Fazenda green | `--forest-700` | `#244C2E` | Primary buttons, headings, active filters |
| Leaf | `--leaf-500` | `#6BA34D` | Small highlights, status accents; never body text |
| Paper | `--paper-50` | `#F5F1E7` | Main page background and cards |
| Ink | `--ink-950` | `#142017` | Body copy on paper |
| Ochre | `--ochre-500` | `#C9963E` | Pins, arrows, dividers, restrained emphasis |
| Tomato | `--tomato-600` | `#B94431` | Urgent/expiring deal only |

Keep the site about 70% paper, 20% green, and 10% supporting accents. Avoid bright primary colours, pure white backgrounds, gradients, and large blocks of light green.

### Typography

- **Display:** `DM Serif Display` or `Cormorant Garamond`, weight 400. Use elegant uppercase or title case for editorial moments only: page hero, seasonal callouts, and key category headings.
- **Utility / deal data:** `Barlow Condensed` or `Roboto Condensed`, weight 700–800, uppercase. Use for prices, dates, categories, labels, and buttons. The tall, compact rhythm mirrors the poster lettering in the references.
- **Body:** `Inter` or `Manrope`, weight 400–500. Keep content clear and modern beneath the expressive display layer.
- **Handwritten accent:** `Caveat` only for one-to-five-word annotations such as “fresh today” or a small arrow label. Never use it for a price or paragraph.

Price hierarchy: make the numeral dominant; put `R$` small and aligned to its top edge; place the unit directly below in compact uppercase type.

### Texture and decoration

- Add a very subtle paper grain to paper and green surfaces (2–4% opacity). It must never compromise reading or product photography.
- Use thin 1 px off-white rules, small four-point stars, loose hand-drawn arrows, and matte ochre “pin” dots as recurring details.
- Use torn-paper edges sparingly: section boundaries and campaign cards, not every card.
- Favour slightly imperfect compositions over heavy shadows, glass effects, or rounded SaaS panels.

## Layout system

### Page frame

- Desktop content width: `1200px`; page gutter: `clamp(20px, 4vw, 64px)`.
- Use generous vertical rhythm: 24 / 40 / 64 / 96 px spacing steps.
- Paper background is the default. Let one forest-green band interrupt each major page to create pace.
- Navigation: quiet paper bar, small logo/wordmark, condensed uppercase links, a single green action button.

### Homepage structure

1. **Hero — green poster.** Deep green field, large cream display headline, short practical subhead, a single search/filter action. A small star or hand-drawn arrow may point to the action.
2. **Fresh deals — paper board.** A simple category rail followed by deal cards. Let the data be primary, not decoration.
3. **Featured flyer — scrapbook moment.** One real flyer, slightly tilted within a cream Polaroid-style frame, optionally held by an ochre pin. Keep the flyer legible.
4. **How it works — calm utility.** Three clear steps on paper; no illustrations required beyond tiny graphic marks.
5. **Sources / trust note.** Forest-green strip with a direct explanation that deals come from local supermarket sources, and when they were last refreshed.

### Deal card

Use a paper card with a thin `--forest-700` border, 0–4 px radius, and no floating shadow. Structure it as:

```
CATEGORY · STORE                              VALID UNTIL 14 AUG
Product name / flyer title
R$ 12,99                                      500 G
Source · checked today                         View flyer →
```

- Use a colored edge, small label, or icon to distinguish categories—not a full-colour card background.
- Ensure price, unit, source, validity, and a flyer link remain visible without hover.
- Treat deal urgency with the tomato accent and a plain language label (for example, “ends today”), rather than countdown theatrics.

## Photography and flyers

- Real flyers are evidence, so preserve their original colour and legibility. Do not add filters or place text over price areas.
- Use people, community, produce, and landscape photography for supporting editorial moments—not stock images of generic supermarkets.
- Crop images generously but respectfully. Favour candid group moments and tactile details over polished lifestyle shots.
- When an image is used as a scrap, add a cream border and modest 1–3° rotation. Do not rotate functional images such as product flyers.

## Interaction and accessibility

- Minimum text contrast: WCAG AA. Cream on forest is the signature high-contrast pairing.
- Focus states: 2 px ochre outline plus 2 px offset, visible on every interactive element.
- Buttons should be rectangular or gently rounded (4 px max), with clear labels such as “View flyer” and “Filter deals.”
- Motion: 150–200 ms simple fades or 1–2 px lifts. Respect `prefers-reduced-motion` and avoid wobble/rotation animation.
- Texture, handwritten accents, and decoration are never the sole carrier of meaning.

## Do / avoid

**Do:** use oversized editorial headlines, tall utilitarian labels, paper warmth, hard-working prices, authentic local imagery, and restrained celebratory marks.

**Avoid:** generic green eco-branding, beige minimalist luxury, heavy drop shadows, pill-everything UI, scripted text for important information, or scrapbook effects that hide data.

## Starter CSS tokens

```css
:root {
  --forest-950: #092714;
  --forest-700: #244c2e;
  --leaf-500: #6ba34d;
  --paper-50: #f5f1e7;
  --ink-950: #142017;
  --ochre-500: #c9963e;
  --tomato-600: #b94431;
  --radius: 4px;
  --content-width: 1200px;
}
```

## Reference read

The supplied posts point consistently to a cohesive language: dark textured greens; cream, slightly speckled paper; high-contrast vintage serif headlines; condensed poster lettering; taped or pinned candid photographs; and small gold/white illustrative flourishes. The recommended website version retains that character but makes functional deal data clearer, calmer, and easier to scan.
