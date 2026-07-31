# Decision: Low-Cost Hosting and Refresh Pipeline

## Question

What low-cost hosting, storage, and scheduler setup should power an always-available flyer website that refreshes 2-3 times per day?

## Decision

Use a static-site-first architecture with GitHub Actions as the scheduled refresh runner.

For v1:

- Host the public website as a static site.
- Run refresh jobs from GitHub Actions 2-3 times per day.
- Store flyer metadata in a generated JSON file.
- Store flyer images either in the repo at first or in object storage later if repository size becomes a problem.
- Keep the expected monthly platform cost at `$0`.

Preferred hosting path:

- Start with GitHub Pages if the app can remain simple static HTML/JS.
- Use Cloudflare Pages Free if we want a cleaner CDN/deploy path while still keeping cost at `$0`.

Do not use Vercel Pro, Supabase Pro, or a paid database for the MVP unless a later decision creates a concrete need.

## Rationale

The initial audience is only 5-10 users, and both researched sources can be ingested directly from public WordPress content. The workload is tiny: two source fetches, image parsing/extraction, and publishing a small current-flyers dataset a few times per day.

GitHub Actions provides enough free monthly minutes for this workload, and a static site avoids paying for an always-running server.

## Consequences

- The refresh job becomes part of the repository.
- The site can be deployed from generated static assets.
- If flyer image volume grows, image storage may need to move out of Git into Cloudflare R2 or similar object storage.
- If extraction becomes slow or requires paid AI calls, extraction cost should be handled as a separate decision.
