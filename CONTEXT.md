# Grocery Deal Tracker

This context describes a low-cost grocery deal tracking product for supermarkets in Camaqua, Rio Grande do Sul. It keeps domain language stable while planning the MVP.

## Language

**Deal**:
A supermarket-advertised offer for one or more grocery products, usually published through an Instagram post, Instagram story, or supermarket website.
_Avoid_: Promo, bargain, discount

**Source**:
A supermarket-controlled place where deals are published, such as a website, Instagram profile, or WhatsApp channel/list.
_Avoid_: Feed, channel, scraper target

**Website Source**:
A supermarket website that publishes deals directly and can be checked during each refresh.
_Avoid_: Site, web feed

**Social Source**:
A supermarket Instagram profile or WhatsApp channel/list that publishes deals outside the supermarket website.
_Avoid_: Social feed, social channel

**Flyer**:
A promotional image containing one or more deals, usually with product names, prices, units, and validity dates embedded in the image.
_Avoid_: Banner, ad image, creative

**Category**:
A broad grocery grouping for a flyer or deal, such as meats, basic necessities, vegetables, or cleaning products.
_Avoid_: Department, section, tag

**Deal Unit**:
The primary item shown on the website; for the MVP this is usually a flyer, not every individual product inside a flyer.
_Avoid_: Product card, item card

**Refresh**:
A scheduled collection pass that checks sources for newly published deals and updates the website's displayed deal set.
_Avoid_: Sync, scrape run, crawl

**Published Deal**:
A deal that is visible on the public website after automatic collection and extraction, without manual approval in the early MVP.
_Avoid_: Approved deal, reviewed deal
