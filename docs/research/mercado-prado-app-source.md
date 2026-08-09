# Mercado Prado app as an offers source

## Conclusion

The authenticated club portal is a viable first-party source. It exposes structured offers after login, so it can replace the Mercado Prado Instagram/Apify collector without OCR.

## Evidence

- The official iOS and Android listings describe exclusive benefits for registered Clube Vem Pro Prado members, selected according to purchase profile.
- Official screenshots show individual product offers, prices, and an "activate offer" action. This suggests structured offer records behind the app rather than Instagram-style image posts.
- Cresce Vendas, the app vendor, says its platform supports discount clubs, segmented campaigns, and digital flyers. It also says customers register, activate an offer in the app/site, and identify themselves by CPF at checkout.
- Cresce Vendas mentions API integrations with point-of-sale vendors, but no public consumer/offers API documentation was found.

## Implications

- If the offer catalogue is returned before login, it should be easier, cheaper, and more reliable to collect than Instagram.
- If login is required, a normal user account may see personalised or club-only offers rather than a universal public price list. We should not automate a person's CPF or session without explicit permission.
- Best route: inspect the app's network traffic using a dedicated test account authorised for this project, or ask Mercado Prado/Cresce Vendas for a public digital-flyer feed/API.

## Proposed proof of concept

1. Open the app without registering and check whether offers load.
2. If they do, capture only the offer-list request and verify whether it returns product, price, validity dates, store, and image.
3. If not, repeat with an authorised test account and determine whether results are personalised.
4. Build a collector only if access is stable and permitted; retain Instagram as fallback during validation.

## Test results (2026-08-09)

- Verified the Android package checksum before inspecting it as an archive; nothing was installed or executed.
- Confirmed that the app and public web portal use Cresce Vendas GraphQL and identify this tenant as Mercado do Prado (client 661).
- The schema contains structured offer fields including product name, regular price, final price, image, expiry text, promotion text, and participating stores.
- Anonymous `app_version` access succeeds.
- Anonymous campaign access is rejected with a login/registration requirement.
- Anonymous discount search and home-carousel requests succeed but return no offers.
- The public `pamphlets` (Jornal) request returns no flyer, and opening Jornal in the web portal presents a login prompt.

Conclusion: no usable anonymous deal feed is currently available. The next valid test requires the user to sign in to a real club account and then check whether the catalogue is complete or personalized.

## Authenticated test results (2026-08-09)

- A signed-in club account exposed 66 structured offers.
- Each rendered offer includes a product name, regular price, deal price, product image, and relative expiry; some also include purchase limits.
- The Jornal page exposed seven flyer images.
- Product and flyer image files are hosted on public Cresce Vendas URLs and load without authentication once their URLs are known.
- Authentication is therefore needed to discover the current records, but OCR is unnecessary for the structured offer catalogue.

The user explicitly authorised use of their personal club account for this project. The integration therefore collects the structured offers using encrypted repository secrets and never commits or logs the login details. Because offers may be personalised to that account, the Jornal images remain useful as a fallback or cross-check.

## Sources

- Apple App Store: https://apps.apple.com/br/app/vem-pro-prado/id6673881639
- Google Play: https://play.google.com/store/apps/details?id=com.crescevendas.clubeamigosdoprado
- Cresce Vendas product site: https://www.crescevendas.com/site/
