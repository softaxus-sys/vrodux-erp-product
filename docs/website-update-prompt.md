# Prompt: update vrodux.com to match the product (2026-11-04)

> Paste everything below the line into Claude, with access to the website's source repository.
> Written by comparing the live site (home, pricing, features, AI Workforce, security, FAQ, demos and several docs pages)
> with the product repository. Items marked **[OWNER TO CONFIRM]** need evidence or a decision from Soft Axis Technologies.
> Claude must leave those as visible placeholders or leave the old text out, and list them in its final report.

---

You are updating the marketing and documentation website https://vrodux.com (Vrodux ERP by SoftAxis Technologies LLC, Dubai) so that it
matches what the product does today. Work in the website's source repository. Before changing anything: read the repo layout, find how the
pages below are built (static files, CMS, markdown, components), and tell me the plan in a few lines. Then make the edits.

## Ground rules (read twice)

1. **Accuracy over marketing.** Publish only what is stated in this brief. Never invent numbers, customers, certifications, integrations,
   prices or dates. Where this brief says OWNER TO CONFIRM, do not guess: keep a clearly marked placeholder in the code (not visible to
   visitors if the site builds for production; use an HTML comment or a `TODO(owner)` constant) and list it in your report.
2. **Compliance wording.** Vrodux *prepares, exports and reconciles* UAE VAT returns, WPS salary files and e-invoicing data. It does not
   file with the FTA or submit to banks automatically. Never write "files with the FTA", "FTA-ready", or "e-invoicing ready".
3. **Pricing facts.** The only pricing dimension is users: 3, 10 or 50 users, plus Enterprise through sales. **Every module is on every plan.**
   Free trial: **14 days, unlimited users, no card.** Reminder emails 7, 3 and 1 days before the end. Data is never deleted if a subscription
   lapses. Checkout will not let a customer pick a plan smaller than their active user count. Dollar prices on the pricing page
   ($129, $249, $699 billed annually; $159, $299, $849 monthly) match the billing configuration as last seen; keep them.
4. **English and Arabic.** The main app has English and Arabic (right-to-left). Several customer-facing pages (member portal, quotation
   link, emails) are English only. Do not promise Arabic for those.
5. Do not touch pages not listed here. Keep the existing design system, components, and tone.
6. Change nothing about blog posts except where listed. Do not delete pages.

## Part 1. Corrections to existing pages

### 1.1 Security page (highest priority: several claims are not backed by the product)

| Current claim | Problem | Replace with |
|---|---|---|
| "Keys managed with industry-standard HSMs." | No HSM or key vault is used. | Remove the sentence. Replace with: "Sensitive values such as API tokens and two-factor secrets are stored encrypted." |
| "All data encrypted at rest (AES-256) and in transit (TLS 1.3)." | At-rest encryption is applied to secrets; whole-database encryption and the TLS version are not confirmed. | "Connections use TLS. Sensitive secrets (integration tokens, two-factor secrets) are encrypted at rest." **[OWNER TO CONFIRM]** whether database-level encryption and TLS 1.3 can be claimed. |
| "Automated daily backups with point-in-time recovery. RTO < 4 hours, RPO < 1 hour." | Disaster-recovery document says daily backups, recovery point up to 24 hours. No point-in-time recovery. | "Automated daily backups. A restore can lose up to 24 hours of changes since the last backup." **[OWNER TO CONFIRM]** any stronger target before publishing. |
| "Complete audit log ... with tamper-proof records." | The log exists; nothing makes it tamper-proof. | "A full audit log records who created, changed or deleted what, and when." Remove "tamper-proof". |
| "ISO 27001" (home page badge) vs "aligned" (security page) | Not certified. The two pages disagree. | Use "Built on ISO 27001-aligned practices" everywhere. No badge image. |
| "SOC 2 Type II: In Progress" | Keep, but only if the audit is actually underway. | **[OWNER TO CONFIRM]**. If unsure, remove. |
| "GDPR compliant", "UAE PDPL compliant" | Legal claim, not verified. | "Designed to support GDPR and UAE PDPL requirements" until legal confirms. |
| "PCI DSS Ready" | Vrodux does not handle card numbers. | "We never store card numbers. Card payments run on Stripe and PayPal's hosted pages." |
| "HIPAA Capable" | Not verified. | Remove. |
| Uptime SLA | Not stated on the security page, but claimed as 99.9% on the home page. | **[OWNER TO CONFIRM]**. If no SLA is contractually offered, say "Enterprise plans include an SLA" and drop the percentage from the home page. |

Keep (all true): TOTP two-factor sign-in with backup codes; role-based access with per-user grants and denies; list of signed-in devices with
remote sign-out; tenant isolation (each customer's data is separated); VAT features for the UAE.

### 1.2 Home page

- Stats strip: "500+ businesses", "40+ countries", "4.9/5 from 200+ reviews" and "99.9% uptime SLA" are not backed by anything in the product
  repository. **[OWNER TO CONFIRM]** each one with evidence; remove any that cannot be proven.
- Module count: the page says both "12 ERP modules" and "23 integrated modules". Use one number. With E-commerce and SEO added the
  count is **25** (8 core + 15 industry, which the site already counts, + E-commerce + SEO). Update the stat, the section title and the
  alt text everywhere.
- "13 industry modules" heading above a list of 15 items: make the heading match the list (now 17 with E-commerce and SEO if they are shown
  as industry cards; otherwise keep E-commerce and SEO in a new "Grow online" group of two cards).
- Add cards for **E-commerce** and **SEO AI Agent** (text in Part 2). Add **Mobile app** to the platform capabilities.
- Compliance badge row: apply the wording from 1.1.
- Add an "included with every plan" line: "Every plan includes every module, plus SEO and Lead Generation."

### 1.3 Pricing page

- Keep the four plans, prices, user limits and "every plan includes every module".
- The comparison table lists these as Professional-only (or Enterprise-only): multi-company (up to 3), multi-currency, advanced BI, API access,
  custom workflows, advanced reporting. In the product, multi-currency, the API and reporting work on every plan and only seat count and storage
  are limited. **[OWNER TO CONFIRM]** the intended tiering. Until then show these as "included on all plans" and keep "SLA, dedicated support,
  on-premise option, custom integrations, dedicated account manager, data migration assistance" as Enterprise-only. Remove "up to 3 companies"
  unless confirmed.
- AI line: replace "AI assistant (pay-as-you-go, bring your own key)" with:
  "Vrodux AI on every plan. Connect your own AI provider key, or use the shared allowance included with your workspace where enabled
  (monthly message limit applies)." **[OWNER TO CONFIRM]** the shared allowance is switched on in production before publishing this.
- Add a short **"Add-ons and credits"** section (copy in Part 2.3). Do not show credit prices; say prices are shown in Billing.
- FAQ answers must render (see 1.7).

### 1.4 Lead Generation page and docs

- Remove "Buy credit packs by Stripe or PayPal."
- Replace with: "Buy credits in Settings, Billing, Add-ons and credits, by card through Stripe or PayPal. The same credits system covers SEO audits, and
  unused credits can be swapped between add-ons."
- Keep: free discovery, credits only when you reveal a contact, unusable or bounced contacts are refunded, UAE live, own mailbox
  (Google, Microsoft or SMTP and IMAP), warm-up limits, sequences, unsubscribe link, suppression, auto-pause on bounces, shared reply inbox, push to CRM.
- Do not claim other countries, calls, or SMS/WhatsApp outreach.

### 1.5 AI Workforce page and AI docs

- Naming: the product is called **Vrodux AI** (the menu item and floating button say "Ask Vrodux"). Use "Vrodux AI" as the product name,
  "Vrodux AI Workforce" as the page title, and "Ask Vrodux" for the button. Replace "the AI assistant" in the docs with "Vrodux AI".
- "Six agents": the picker lists a specialist per module (CRM, Sales, Purchase, Finance, HR, Inventory, POS, Restaurant, Hospitality, Real Estate,
  Library, Lead Generation, SEO, E-commerce, Visa, Trade, Projects, Manufacturing, Construction, Recipe, B2B, Education, Healthcare, Insurance).
  Rewrite as "a specialist for each module you use, plus an Auto mode that picks the right one". Keep the six-role marketing story as examples if you like,
  but do not say there are only six.
- Tools: "more than 250 tools" becomes "more than 300 tools". It can list, look up, create and change records and run steps such as approvals
  and status changes. It has **no delete tools**, and it cannot make, void or refund a POS sale. Every change is shown as a field-by-field summary
  and needs your confirmation first.
- Keys: see 1.3. Add a short note on voice: push-to-talk in the chat, with spoken replies where voice is enabled for the workspace.
  **[OWNER TO CONFIRM]** the platform voice is enabled before promising it.
- Telegram and phone-call voice claims on the page already exist: leave them, but **[OWNER TO CONFIRM]** they are still current.

### 1.6 Features index and feature pages

- Count: 25 modules (see 1.2).
- Add feature cards and pages: E-commerce, SEO AI Agent (Part 2). Add Online Listings to the Inventory page.
- CRM page: add "Send quotations from a lead or account using your Sales templates" and "Tell Meta which leads became customers" (Part 2.5).
- Finance page: keep as is. It is accurate. Add the line "Vrodux prepares your VAT return and exports the files; you file on the FTA portal."
- Hospitality page: do not add screenshots of housekeeping until the housekeeping screen bug is fixed (**[OWNER TO CONFIRM]** it was crashing on the demo workspace on
  2 November 2026).
- Add a "Travel agency" section to the Hospitality page text: "Tour packages with itineraries, dated departures with seats, bookings with
  travellers, supplier bookings, instalments and payments, and posting to Finance." It currently only links to a guide.
- POS and Restaurant pages are accurate. Keep.

### 1.7 FAQ

The 18 questions render without answers. Check whether this is a rendering bug (collapsed accordion content missing from the HTML) and fix it. Suggested answers:
- What are the pricing tiers? 3, 10 or 50 users, plus Enterprise. Every plan includes every module. Prices are on the pricing page.
- Is there a free trial? 14 days, unlimited users, no credit card.
- Hidden fees? None per module. Add-ons such as SEO audits and Lead Generation reveals use credits you buy yourself. Optional services (data migration, implementation, custom development) are quoted separately.
- Can I change plans? Yes, in Settings, Billing. You cannot choose a plan smaller than your active user count.
- Does Vrodux file VAT returns with the FTA? No. Vrodux prepares your VAT 201, checks it against your ledger, and exports the files. You file on the FTA portal and record the reference in Vrodux.
- Is it available in Arabic? The app has Arabic and right-to-left support. Some customer-facing pages, such as the library member portal and quotation links, are English only for now.
- Is there an API? Yes. **[OWNER TO CONFIRM]** the plan wording.
- Is it mobile-friendly? The web app works on phones and tablets, and there is a companion mobile app (see 2.7).
- Uptime SLA and backups: **[OWNER TO CONFIRM]**, then match the security page.
- Implementation, migration, training, support: **[OWNER TO CONFIRM]** the current offer.

### 1.8 Mobile app docs page (/docs/mobile-app/whats-on-your-phone)

Add: Lead Generation, Master Data, push notifications for assignments and approvals, and the camera barcode scanner. State the platforms and store
links **[OWNER TO CONFIRM]**. Keep: no creating multi-field records from scratch; administration stays on web.

### 1.9 Blog

Do not edit existing posts. If any post gives VAT dates or e-invoicing dates, add an "Updated" note at the top and check the dates against the
Ministry of Finance (e-invoicing: businesses under AED 50 million appoint a provider by 31 March 2027 and go live on 1 July 2027, as currently reported; verify before publishing).

## Part 2. New content to publish

### 2.1 E-commerce (new feature page, new docs section, home card)

**Headline:** Sell online from the stock you already hold.
**Overview:** Your own online store, built on Inventory. Products, prices and stock come straight from Inventory, so nothing is entered twice. Build pages with a
visual page builder, take orders and payments, and manage fulfilment in Vrodux.

**What it does (publish exactly this):**
- **Online listings in Inventory.** A listing is what customers see: name, description, photos, options such as size and colour (up to three), and search details.
  Each variant is an ordinary Inventory product with its own SKU, barcode, price and stock, so POS, purchasing and reports stay correct.
- **List stock online in one click.** From the stock list, or from a "Not yet listed" worklist, select items and list them as drafts or published. Photos stay with the stock item.
- **Import stock with pictures.** Upload an Excel or CSV with picture links; photos are fetched in the background; running the file twice does not duplicate items.
- **Your own store.** One store per workspace, on a web address you choose (or your own domain, set up with DNS). Private preview until you launch.
- **Page builder.** Pages built from sections (hero, product grid, text, images, call to action) with a live preview. Menus, collections, discount codes.
- **Checkout.** Customers check out with or without an account. Delivery zones and rates, a free-delivery threshold, tax, discount codes. Totals, stock and prices are
  always worked out by the server, never trusted from the browser.
- **Payments.** Card payments through your own Stripe or PayPal account, cash on delivery, or bank transfer.
- **Orders.** Stock is reserved when the order is placed and released if it is cancelled or never paid. Mark paid, pack, ship, deliver, refund. Customers are emailed at each step.
- **Customer accounts.** Customers sign in to the store, with password reset by email.
- **Shopify.** Connect a Shopify store: publish products from Inventory, keep stock in step both ways, and bring its orders into Vrodux.
- **Languages.** The storefront supports English and Arabic (right-to-left). **[OWNER TO CONFIRM]** after a visual check before featuring Arabic.

**Do not claim yet:** WooCommerce (shown as coming soon in the app), reviews, wishlists, abandoned-cart emails, gift cards, courier-rate quotes, store orders creating
sales orders, invoices or ledger entries automatically, a tested connection to a live Shopify store, link previews that show product details when shared on social media.

**Docs pages to add (section "E-commerce", slug docs/ecommerce):** open-your-online-store; settings-payments-and-delivery; design-pages-and-collections;
publish-products-from-inventory; connect-shopify; manage-store-orders. Also add under Inventory: online-listings-and-photos; import-stock-with-pictures.

**Video:** `ecommerce` (see Part 3). Also embed the Inventory video chapters 2:55 to 4:40 on the two Inventory pages above.

### 2.2 SEO AI Agent (new feature page, new docs section, home card)

**Headline:** Find what holds your site back, and fix it.
**Overview:** Connect your website, run a technical audit, and review the fixes an AI agent proposes. Add competitors to see what they cover that you do not, and turn the gaps into a 30-day content plan. SEO is included with every workspace.

**What it does:**
- **Site audit.** Crawls up to 500 pages and checks more than 30 rules: titles, descriptions, headings, canonical tags, structured data, images and alt text, speed, redirects, broken links, duplicates, orphan pages, sitemap and robots.
  Gives a 0 to 100 health score and a history of audits. Issues are remembered, so a re-run updates them and closes the ones you fixed.
- **Fixes you approve.** The agent proposes fixes for new issues; nothing changes until you approve it.
- **Product listing SEO.** For stores on Vrodux, review and edit the title, description and photo alt text of each online listing and publish the change to your store.
- **Search Console.** Connect Google Search Console to bring in the queries your site already gets.
- **Competitor analysis.** Add up to five competitor websites and a search market. See topics they cover that you do not, and, where keyword data is available, search terms they rank for that you do not.
- **30-day content plan and drafts.** A calendar of article ideas from the gaps. Write a draft with one click into a review queue; publishing to WordPress is a separate step you choose.
- **Credits.** An audit costs 1 credit per 25 pages crawled; every workspace starts with 20 credits; competitor analysis costs credits per website. Buy more in Billing. You see the cost before you run anything.

**Do not claim yet:** keyword research tool, rank tracking, backlink analysis, AI-search ("GEO") visibility, fixes applied directly to the source of external sites
(on websites that are not hosted on Vrodux, approved fixes are applied by a script in the visitor's browser, which search crawlers and social previews may not see; WordPress
articles can be pushed, but existing WordPress pages are not edited at source). A bigger keyword and ranking toolset is planned and not available.

**Docs pages to add (docs/seo):** connect-a-site; run-an-audit-and-read-the-health-score; review-and-approve-fixes; product-listing-seo; competitor-analysis-and-content-plan;
credits-for-seo. **Video:** `seo-ai-agent`.

### 2.3 Add-ons and credits (pricing page section, docs page settings/add-ons-and-credits)

SEO audits and Lead Generation reveals use credits. Buy them in **Settings, Billing, Add-ons and credits** by card (Stripe or PayPal). Each add-on keeps its own balance,
shown in credits. Bulk purchases get a discount. Credits do not expire and are not refundable. You can swap credits from one add-on to another at their relative value (a small fee may apply).
Credits can be bought once the workspace has a subscription (not during the free trial). Do not publish prices; they are set in Billing. **[OWNER TO CONFIRM]** the fee and the
no-refund policy wording before publishing.

### 2.4 Real-time notifications (platform page, docs page settings/notifications-and-apps)

An alert appears in the bell and as a pop-up the moment something needs you, with a soft sound you can mute and optional desktop notifications.
Alerts are stored, so you see what you missed while offline. Examples: a lead, opportunity or account assigned to you; a leave request to approve; a payroll run awaiting
Finance approval; a purchase requisition to approve; a project issue assigned to you; a rented property about to fall vacant; trade shipments and payments needing attention.
Team leads are also told when work lands on one of their team members. Only modules your plan and role can open appear.

### 2.5 CRM additions

- **Quotations from CRM.** From a lead or account, create a quotation from your Sales template, preview the exact branded document, send it by email or share a link the
  customer can accept or decline online. You are alerted when they answer.
- **Tell Meta which leads became customers.** When a lead that came from a Meta ad changes stage or its deal is won, Vrodux can tell Meta (through its Conversions API for CRM),
  so Meta can learn which leads were good. Off until you switch it on; needs a Dataset ID and token from Meta Events Manager. **Do not claim** any improvement in ad results; say only
  that Vrodux sends the signal. **[OWNER TO CONFIRM]** it has been tested with a real Meta dataset first.

### 2.6 Vrodux AI additions

Covers more than 300 tools across 20+ modules: for example log a project bug, create a quotation, check a guest in, issue a library book, approve a purchase requisition,
change an SEO fix status. See 1.5 for limits. Voice: see 1.5.

### 2.7 Mobile app (home page capability, features card, docs page)

Companion app for lookups, approvals and actions that suit a phone: CRM leads and pipeline, your own HR (attendance, leave, payslips) and the HR team's tools, one
approvals inbox (leave, purchase, sales returns, payroll), Lead Generation, master data, read-only lookups across other modules, camera barcode scanning,
push notifications, and Vrodux AI. Same sign-in, roles, permissions and two-factor as the web. A list of signed-in devices with remote sign-out.
**[OWNER TO CONFIRM]** platforms and store links.

### 2.8 E-invoicing (optional landing page, to catch search demand)

Only publish if the owner approves, and keep this exact scope. Title: "UAE e-invoicing: how Vrodux helps you prepare."
Content: the UAE is moving to e-invoicing on the Peppol network using the PINT AE format, through accredited service providers (ASPs); businesses with revenue under AED 50 million are
reported to need an ASP appointed by 31 March 2027 and to go live on 1 July 2027 (verify with the Ministry of Finance before publishing). Vrodux today: tax invoices with seller and buyer
name, address and TRN, VAT 201 preparation, and the data fields needed for e-invoicing. In progress: PINT AE invoice files and a connection to an accredited provider.
**Never write** that Vrodux is "e-invoicing ready", "FTA approved" or that it submits to the FTA. Add a "get notified" form.

## Part 3. Video instructions (docs pages and demos page)

Videos are hosted on Contabo. Base: `https://sin1.contabostorage.com/5eebb73791834c68aa89cf1633f74425:demo-videos/`. The manifest at `.../manifest.json` lists every video; each entry has `video` and `poster`
paths relative to that base, plus `chapters`. Videos are served with a one-day cache, so a replaced file can show the old copy for up to a day.

### 3.1 Demos page

1. Find out whether `/demos` reads `manifest.json` from Contabo or has a hard-coded list. If it reads the manifest, no list changes are needed; check it renders the new categories and entries. If hard-coded, replace the
   list with the table below (and consider switching to the manifest).
2. Sections: Getting started; Sales and customers; Finance and people; Operations; Industry modules; Platform. Each video: poster, title, duration, one-line description, and the chapter list with timestamps that seek the player.
3. Update the durations of the six refreshed videos: Getting Started 6:19 to **6:49**; Point of Sale 4:38 to **5:33**; Restaurant 11:58 to **12:06**; Finance 10:40 to **12:48**; Inventory 3:06 to **5:01**; Library 2:05 to **4:26**.
4. Remove the "no demo yet" implication for Hospitality, Insurance and B2B; they now have videos.

| Slug | Title | Length | Section | Status |
|---|---|---|---|---|
| getting-started | Getting Started | 6:49 | Getting started | refreshed (14-day trial, phone number, all-modules picker, up to 3 business types) |
| pos | Point of Sale | 5:33 | Sales and customers | refreshed (choose branch, credit, offline mode) |
| restaurant | Restaurant | 12:06 | Sales and customers | refreshed (choose branch) |
| lead-generation | Lead Generation | 3:15 | Sales and customers | **new** |
| seo-ai-agent | SEO AI Agent | 1:46 | Sales and customers | **new** |
| ecommerce | E-commerce | 4:19 | Sales and customers | **new** |
| finance | Finance | 12:48 | Finance and people | refreshed (recurring expenses, VAT 201, Finance Posting) |
| inventory | Inventory | 5:01 | Operations | refreshed (import with pictures, online listings) |
| project-management | Project Management | 2:49 | Operations | **new** |
| library | Library | 4:26 | Industry modules | refreshed |
| hotel-management | Hotel Management | 4:56 | Industry modules | **new** |
| travel-agency | Travel Agency | 2:57 | Industry modules | **new** |
| insurance | Insurance | 1:02 | Industry modules | **new** |
| b2b-services | B2B Services | 1:00 | Industry modules | **new** |
| vrodux-ai | Vrodux AI | 1:02 | Platform | **new** |
| reports-file-manager | Reports and File Manager | 1:06 | Platform | **new** |
| billing-connections-security | Billing, Connections and Security | 1:11 | Platform | **new** |
| help-support | Help and Support | 0:50 | Platform | **new** |

The other 13 videos are unchanged (CRM, Sales, Purchase, HR and Payroll, Manufacturing, Import and Export, Real Estate, Visa Services, Construction, Healthcare, Education, Master Data, Calendar).

Descriptions (use these):
- lead-generation: Find businesses, reveal contacts with credits, and run outreach from your own mailbox.
- seo-ai-agent: Connect a site, audit it, and review the fixes the agent proposes.
- ecommerce: Open an online store on top of Inventory, publish products, take an order, and manage it.
- project-management: Projects, Kanban boards, sprints and issues.
- hotel-management: Rooms, rates, reservations, check-in, billing and housekeeping for a hotel.
- travel-agency: Tour packages, departures, bookings, suppliers and payments for a travel agency.
- insurance: Policies, renewals and claims.
- b2b-services: Proposals, contracts and support tickets for business clients.
- vrodux-ai: Ask about your business, use specialist agents, and confirm actions before they happen.
- reports-file-manager: The reports hub for every module, and a library of documents organised by owner.
- billing-connections-security: Your plan and seats, every connected service in one list, and two-factor sign-in.
- help-support: Video guides, and how to raise a ticket with the Vrodux team.

Chapter lists: take them from `manifest.json` rather than retyping. A few chapter titles repeat within a video (for example "Take payment", "Check out", "The issues list", "Start the sprint", "Posted documents"). Keep the timestamps; if you want
them tidy, append a number to the second occurrence, but do not change the times.

### 3.2 Where to embed each video in the docs

Embed the player (poster, chapter list that seeks) at the top of the listed docs pages, with the line "Watch the walkthrough (m:ss)". Where a video covers several pages, embed it on the section index and on the first page, and link to the video from the
others with the relevant chapter timestamp.

| Video | Docs pages |
|---|---|
| getting-started | start-here/creating-your-account, start-here/company-profile-currency-branding, start-here/users-roles-teams-permissions, start-here/inviting-your-team |
| pos | pos/retail-and-restaurant, pos/open-and-close-a-shift, pos/customer-credit-accounts (from 3:38), pos/offline-mode-and-sync (from 4:55), pos/pos-dashboard-and-reports (from 2:43) |
| restaurant | restaurant/floors-tables-and-menu (0:08), take-orders-with-modifiers (3:17), kitchen-display (4:25), bills-split-payments-and-tips (5:07), delivery-and-riders (6:59), restaurant-roles-and-reports (10:54) |
| lead-generation | lead-generation/find-businesses-and-reveal-contacts (0:21 to 2:04), lead-generation/campaigns-and-the-reply-inbox (2:04) |
| seo-ai-agent | new docs/seo pages (2.2) |
| ecommerce | new docs/ecommerce pages (2.1) |
| finance | finance/invoicing-expenses-ledger, tax-invoices-and-recurring-invoices (7:31), record-and-approve-expenses (1:35), reconcile-a-bank-account (4:16), prepare-a-uae-vat-return (11:14), integration-center-and-finance-posting (8:02) |
| inventory | inventory/products-warehouses-stock, inventory/set-up-warehouses-and-master-data (0:21), inventory/move-and-adjust-stock (1:48), new e-commerce and Inventory listing pages (2:55 on) |
| project-management | project-management/boards-sprints-issues, projects-teams-and-access (0:18), backlog-sprints-and-issues (1:31) |
| library | library/build-the-catalogue-and-import-books (2:09), circulation-desk-issue-return-and-reserve (0:53), members-fines-and-reminders (3:27), member-portal (3:48) |
| hotel-management | hospitality/front-desk-check-in-and-out (1:12), rooms-room-types-and-rates (0:27), folios-and-housekeeping (2:30) |
| travel-agency | hospitality/tour-packages-departures-and-bookings |
| insurance | industry-packs/insurance-policies-renewals-and-claims |
| b2b-services | industry-packs/b2b-proposals-contracts-and-tickets |
| vrodux-ai | ai-assistant/ask-it-confirm-it, ai-assistant/what-the-assistant-can-do |
| reports-file-manager | reports/overview, reports/run-and-export-reports, file-manager/overview (0:48) |
| billing-connections-security | settings/plans-trial-and-billing (0:07), settings/two-factor-authentication-and-security-settings (0:51), settings/users-security-plan, new settings/add-ons-and-credits |
| help-support | start-here/where-to-go-next, and a new Help and Support docs page |

### 3.3 Player and SEO details

- Use a native `<video controls preload="metadata" poster="...">` with the Contabo URL. Do not autoplay. Chapter buttons set `currentTime` and play.
- Add `VideoObject` structured data per video: `name`, `description`, `thumbnailUrl` (poster URL), `uploadDate` (the day the file is uploaded), `duration` in ISO 8601 (for example 4:56 is `PT4M56S`),
  `contentUrl`, and chapters as `hasPart` with `Clip` entries (name, startOffset, url with `#t=`).
- The videos carry on-screen captions and English narration but no separate subtitle file. If the site has a transcript convention, add the scene narration later; do not claim captions or accessibility
  compliance beyond that.
- Sitemap: add the new pages (E-commerce, SEO, add-ons, docs sections) and the video entries if the site publishes a video sitemap.

## Part 4. Deliverables and checks

1. Make the edits on a branch and give me a summary of every file changed.
2. Produce a **list of all OWNER TO CONFIRM items** and the placeholder you left for each.
3. Build the site and check: no broken links, new pages in navigation and sitemap, the demos page lists all 31 entries, the player seeks on a chapter click, Arabic/RTL pages are not broken by the changes.
4. Search the whole site for the old claims and make sure none remain: "HSM", "RPO < 1", "point-in-time", "tamper-proof", "ISO 27001" without "aligned", "credit packs", "12 ERP modules", "13 industry",
   "files with the FTA", "FTA-ready", "e-invoicing ready".
5. Do not publish to production; leave it for review.
