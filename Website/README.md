# Leading Properties — public website

Bilingual (English / Arabic, with RTL) marketing and listings site. Standalone Next.js
App Router app. Enquiries are relayed into VroduxERP CRM as leads.

This is an original design and original copy written for this project. No markup,
styling, imagery or text was taken from any existing site.

## Running it

```bash
npm install
cp .env.example .env.local     # then fill in the values below
npm run dev                    # http://localhost:3100
```

`npm run build` produces the production build; `npm start` serves it.
`npm run typecheck` runs `tsc --noEmit`.

## Environment

| Variable | Required | What it does |
|---|---|---|
| `CRM_INBOUND_URL` | yes | Where enquiries are delivered. Without it the form returns 503 and **leads are lost** — monitor for the `[enquiry]` error in the logs. |
| `CRM_SIGNING_SECRET` | no | Only if HMAC signing is enabled on the CRM integration. |
| `NEXT_PUBLIC_SITE_URL` | yes | Used for canonical URLs and Open Graph. |
| `NEXT_PUBLIC_PHONE` / `NEXT_PUBLIC_WHATSAPP` / `NEXT_PUBLIC_EMAIL` | yes | Shown in the header, footer and contact page. |

`CRM_INBOUND_URL` is deliberately **not** a `NEXT_PUBLIC_` variable. The inbound key is
the only thing protecting that endpoint; in a public variable it would be published in
the browser bundle and anyone could post junk leads into the CRM. Enquiries are
therefore relayed through `/api/enquiry` on the server.

## Connecting the CRM

1. In VroduxERP: **Settings → Integrations → Website Forms → Connect**.
2. Copy the inbound URL it generates (the unguessable key is already in it) into
   `CRM_INBOUND_URL`.
3. Optionally enable signing and copy the secret into `CRM_SIGNING_SECRET`.

Leads arrive with `source: "website"` and the field names the CRM's inbound provider
already recognises, so budget, timeframe and interest populate the lead's Requirements
panel rather than falling into the Form Responses catch-all. Property enquiries carry
the reference (e.g. `LP-2288`) in both `form_name` and `property_reference`.

## Editing listings

Listings live in `src/data/properties.json`. Each entry needs **both** languages —
`title`, `community`, `emirate`, `description` and `features` are all
`{ en, ar }`. Notes:

- `price` is a plain AED number. For rentals it is the **annual** figure. `null`
  renders as "price on request", and such listings are intentionally kept in results
  even when a price filter is applied, so the top of the market is never hidden from
  the buyers filtering for it.
- `bedrooms: 0` renders as "Studio". Bedrooms and bathrooms are hidden entirely for
  plots, where "0 beds" would read as a defect.
- `slug` is the URL. Never reuse a slug for a different unit — an old link would then
  point at the wrong property.

### Photography

`images` is an empty array on every listing until real photography is supplied. Until
then each listing renders a branded placeholder keyed off its reference, so the site is
presentable before the shoot is delivered. To add photos, drop them in
`public/properties/<slug>/` and list them:

```json
"images": ["/properties/sidra-gardens-villa-44/01.jpg", "...02.jpg"]
```

The first image is the hero; the next two fill the gallery strip.

## Translations

`src/i18n/en.json` and `src/i18n/ar.json` must have identical key sets — the Arabic
file is typed against the English one, so a missing key is a build error rather than a
blank string in production. Counts are pluralised through `Intl.PluralRules`, because
Arabic has six plural forms and a hand-rolled `n === 1` check gets them wrong.

Phone and email fields carry `dir="ltr"` inside the RTL layout; without it a number
renders with the `+` on the wrong end.

## Structure

```
src/
  app/[locale]/           pages: home, properties, properties/[slug], about, contact
  app/api/enquiry/        server-side relay into the CRM
  components/             header, footer, cards, filters, enquiry form
  data/properties.json    the listings
  i18n/                   en.json, ar.json, locale config
  lib/                    types, formatting, property queries, dictionary loader
  middleware.ts           redirects a bare path to /en or /ar
```

Search filters are held in the URL rather than component state, so a filtered result
set is a shareable link — an adviser can send a client "everything in Dubai Hills over
10M" directly.

## Before going live

- [ ] Replace the placeholder RERA ORN and trade licence in `footer.permit` (both
      language files) with the client's real numbers.
- [ ] Set the real phone, WhatsApp and email environment variables.
- [ ] Replace the sample listings with the client's actual instructions.
- [ ] Supply property photography.
- [ ] Have the client review the Arabic copy — it is written, not machine-translated,
      but it should be signed off by a native speaker before publication.
- [ ] Write the privacy policy and terms pages; the footer currently links to nothing.
- [ ] Add monitoring on the `[enquiry]` log lines so a broken CRM connection is noticed
      rather than silently dropping leads.

## Not built

Agent profiles, community/area guides, off-plan project pages, a blog and a valuation
request form were all scoped out of this pass. Listings are edited in the JSON file —
there is no CMS, so day-to-day changes need a developer and a redeploy.
