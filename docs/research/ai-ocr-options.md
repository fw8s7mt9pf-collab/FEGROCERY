# AI OCR options for grocery flyers

Researched 2026-08-09. This is a provider comparison for printed Portuguese/Brazilian supermarket flyers, not a measured accuracy benchmark. All prices are USD and should be rechecked before a purchase.

## Expected volume and cost

Proposed cadence: refresh only after offers expire, at most once every two days. With two supermarkets and 2-8 flyer images per refresh, that is about 15 refreshes and **30-120 images per month**.

At that volume, OCR.Space, Google Cloud Vision, and Azure Vision remain inside their published free tiers. AWS Textract costs **$0.045-$0.18/month** after its introductory free tier. Mistral OCR 4 costs **$0.12-$0.48/month** for standard OCR, excluding annotated output. Self-hosted PaddleOCR has no per-image provider charge, but needs a maintained machine or runner.

## Comparison

| Option | Portuguese and flyer fit | Pricing at 30-120 images/month | Format and limits | Data / commercial use stated | Verdict |
| --- | --- | --- | --- | --- | --- |
| **OCR.Space** (current) | Engine 2 is its documented all-round engine; Engine 3 is aimed at more difficult/stylized text and returns Markdown. Portuguese is an available language code. | Free: 25,000 requests/month and 500/day/IP; 1 MB file limit. $0 at this volume. PRO is $30/month. | Upload file, Base64, or a URL. AVIF support is **not documented**; convert AVIF to JPEG/PNG first. | Free API is permitted in commercial projects, but has no uptime guarantee. OCR.Space says it does not store documents/images. | Cheapest and already integrated. Keep it as primary, but add AVIF conversion and retain a fallback. |
| **Google Cloud Vision** | `DOCUMENT_TEXT_DETECTION` is designed for dense text/documents and accepts language hints, though Latin-script detection normally needs none. | First 1,000 text/document-text units each month are free; then $1.50/1,000. $0 at this volume; 120 images would be $0.18 without the allowance. | JPEG, PNG, GIF, BMP, WEBP, RAW, ICO, PDF, TIFF; max 20 MB. AVIF is **not documented**. | Immediate requests are processed in memory, not persisted; Google says API content is not used to train Vision models. Requires a Google Cloud billing account to enable use. | Strong managed fallback, but the account/billing setup is disproportionate for this project and AVIF still needs conversion. |
| **Azure AI Vision** | Read OCR supports Portuguese and returns words/lines with locations and confidence. | F0: 5,000 free transactions/month and 20 transactions/minute. $0 at this volume. The public price page directs paid pricing to the region/account calculator. | Read OCR: JPEG, PNG, BMP, PDF, TIFF. Image Analysis OCR: JPEG, PNG, GIF, BMP, WEBP, ICO, TIFF, MPO. AVIF is **not documented**. | Microsoft directs customers to its Foundry Tools data/privacy policies; no narrower retention statement was found in the OCR docs reviewed. | Viable free alternative, but no advantage over OCR.Space for this small project; AVIF conversion remains required. |
| **AWS Textract** | Explicitly supports Portuguese printed-text detection and returns words/lines and geometry. | DetectDocumentText is $0.0015/page for the first 1M pages. New AWS customers receive 1,000 pages/month for three months. $0.045-$0.18/month after that. | JPEG, PNG, PDF, TIFF; synchronous single-page input max 10 MB. AVIF is **not supported**. | Uses HTTPS; AWS documents account/IAM, encryption, and regional controls. | Predictable and inexpensive, but designed for documents and needs AWS setup plus AVIF conversion. Not the first choice. |
| **Mistral OCR 4** | Document OCR produces structured Markdown, tables, blocks, and confidence data. Its documentation describes 40+ languages. | $4/1,000 pages: $0.12-$0.48/month. Annotated pages are $5/1,000. No free tier is documented for OCR 4. | Direct `image_url` explicitly supports PNG, JPEG/JPG, **AVIF**, and more; it also accepts document URLs/files. Current rate controls are account limits, including pages/minute. | API data is documented as not used for model training; default API retention is up to 30 days for abuse monitoring unless zero-data-retention is enabled. | Best hosted option for Krolow AVIF and complex flyer layouts. Worth using as a targeted fallback, not as the default at this scale. |
| **PaddleOCR PP-OCRv5** (self-hosted) | The lightweight Latin model explicitly supports Portuguese; official documentation lists a 14 MB recognition model and CPU inference figures. | Software is Apache-2.0 licensed; no per-image API cost. Hosting, monitoring, updates, and conversion are ours. | Run locally or as a service. AVIF input is **not documented**; convert first. | Processing stays in our infrastructure. Apache-2.0 grants broad use and distribution rights subject to its conditions. | The only no-provider-credit route. It is a reasonable later experiment, but adds more operational work than this v1 warrants. |

## Recommendation

Use a two-provider design:

1. **Keep OCR.Space Engine 2 as the primary OCR.** With the new cadence, the free allowance is vastly larger than needed and the existing integration is already working.
2. **Convert every source image to JPEG or PNG before OCR.** This is required for Krolow AVIF with OCR.Space and all major cloud alternatives except Mistral. Keep enough resolution for prices and dates; do not over-compress.
3. **Use Mistral OCR 4 only as a fallback** when OCR.Space returns no readable validity date, price, or category. It directly supports AVIF and its worst-case monthly cost under this cadence is below $0.50 if every flyer used it.
4. **Refresh based on validity, with a two-day safety check.** Refresh on the day after the latest detected expiry; when a flyer has no reliable expiry date, check every two days and preserve the existing 48-hour warning. This reduces calls without risking stale offers indefinitely.

Before changing providers, run the same saved set of 10-20 Roxo and Krolow flyers through OCR.Space Engine 2, OCR.Space Engine 3, and Mistral. Score only the fields that matter here: validity dates, product/category terms, Brazilian prices, and false text. That small local benchmark will be more useful than general OCR marketing claims.

## Official sources

- [OCR.Space API plans, limits, input methods, and engines](https://ocr.space/ocrapi); [commercial use and retention FAQ](https://ocr.space/faq)
- [Google Cloud Vision pricing](https://cloud.google.com/vision/pricing); [OCR guide](https://docs.cloud.google.com/vision/docs/ocr); [supported files](https://docs.cloud.google.com/vision/docs/supported-files); [data-usage FAQ](https://docs.cloud.google.com/vision/docs/data-usage)
- [Azure AI Vision pricing](https://azure.microsoft.com/en-in/pricing/details/computer-vision/); [OCR overview](https://learn.microsoft.com/en-us/azure/ai-services/computer-vision/overview-ocr); [Image Analysis requirements](https://learn.microsoft.com/en-us/azure/ai-services/computer-vision/overview-image-analysis)
- [AWS Textract pricing](https://aws.amazon.com/textract/pricing/); [supported languages and quotas](https://docs.aws.amazon.com/textract/latest/dg/limits-document.html); [data protection](https://docs.aws.amazon.com/textract/latest/dg/data-protection.html)
- [Mistral OCR processor](https://docs.mistral.ai/studio-api/document-processing/basic_ocr); [OCR 4 model card and pricing](https://docs.mistral.ai/models/model-cards/ocr-4-0); [API privacy controls](https://docs.mistral.ai/admin/monitor-comply/privacy-data-controls); [API retention policy](https://legal.mistral.ai/terms/privacy-policy)
- [PaddleOCR PP-OCRv5 multilingual model](https://paddlepaddle.github.io/PaddleOCR/latest/en/version3.x/algorithm/PP-OCRv5/PP-OCRv5_multi_languages.html); [usage and model sizes](https://paddlepaddle.github.io/PaddleOCR/main/en/version3.x/pipeline_usage/OCR.html); [Apache-2.0 license](https://raw.githubusercontent.com/PaddlePaddle/PaddleOCR/main/LICENSE)
