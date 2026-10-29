# Online store — go-live runbook

What was built, what must be configured once on the server, and what a store owner does. Read top to bottom the first time.

## 1. What a store is

One per workspace (module `ecommerce`, needs Inventory). Products are **not copied**: the store shows Inventory listings that are
published online (Inventory → Online Listings). Stock, price and photos are Inventory's, so POS, the store and Shopify all
draw from the same numbers.

| Piece | Where |
|---|---|
| Public store (browse, cart, checkout, accounts) | `/shop/{store}/…`, or the store's own address |
| Store settings, pages & design, collections, delivery, discounts, orders, customers | ERP → E-commerce |
| API for staff | `api/ecommerce/store/*` |
| API for shoppers (anonymous) | `api/ecommerce/shop/{store}/*` |

Payments: cash on delivery, bank transfer, **Stripe** (hosted Checkout) and **PayPal** — each store uses the **owner's own**
Stripe / PayPal account (secrets are encrypted at rest, never shown again). Shipping: delivery options per country (flat rate,
free above an amount). Tax: one rate, included or added on top.

## 2. One-time server setup

1. **Deploy** normally (migrations `AddStorefront` and `AddStorefrontPermissions` apply on start; Administrators gain the new
   permissions on that start; other roles need `ecommerce.store.*`, `ecommerce.discounts.*`, `ecommerce.customers.view`,
   `ecommerce.orders.*` granted, and the user must log out and in).
2. `docker-compose.prod.yml` now sets `Gateway__TrustForwardedHeaders=true`. **This matters**: without it every visitor looks like
   the nginx container and the per-address limits (shopper sign-in 20/min, checkout 20/min) apply to *everyone together*.
   Never set it on a gateway that is reachable directly (the on-premises install).
3. nginx now has a no-cache rule for `/api/ecommerce/shop/`. **Reload nginx** (`docker exec vrodux-nginx nginx -s reload`). Without
   it, the generic 5-minute API cache would serve one shopper's account page to the next visitor.
4. SMTP must be configured (`Email__*`) or order confirmations, shipping notices and password resets are not sent (checkout still works).
5. Optional environment: `STORE_BASE_DOMAIN` (sub-domain stores), `Ecommerce__PublicApiUrl` (only if the API is on a different host than the
   web app; it is only used to show the Stripe webhook address).

### Stores on their own address (optional)
- **Path stores need nothing**: `https://erp.vrodux.com/shop/{store}` works as soon as the store is open.
- **Sub-domains** (`{store}.shops.example.com`): wildcard DNS `*.shops.example.com → server`, a wildcard certificate
  (Let's Encrypt DNS-01), copy `nginx/conf.d/stores.conf.example` → `stores.conf`, set `STORE_BASE_DOMAIN=shops.example.com`.
- **Custom domains** (`shop.brand.com`): the owner adds a CNAME to the ERP host, you issue a certificate and add a server block
  (see the example file), the owner enters the domain in *Online store → Address & launch*.
- The web app must be built with `VITE_APP_HOSTS` listing the ERP's own hostnames (default `localhost,127.0.0.1,erp.vrodux.com`); any
  other hostname triggers one lookup to see whether it is a store.

## 3. Owner setup (about 20 minutes)
1. *E-commerce → Online Store*: create the store (name + address).
2. **Inventory → Online Listings**: publish the products to sell (each needs a photo, a price and at least one variant switched on for online sale).
3. *Online Store → Details / Look / Payments / Delivery*; *Pages & Design* for the home page.
4. Payments → **Stripe**: paste the secret key, add the webhook address shown (events `checkout.session.completed`, `.expired`,
   `.async_payment_succeeded`, `.async_payment_failed`), paste its signing secret. **PayPal**: client id + secret, turn off *Test mode* when live.
5. Place one test order of each payment type (use Stripe/PayPal test mode first), cancel/refund it, check the emails.
6. *Address & launch* → open the store.

## 4. How orders behave
- Stock is taken from Inventory **when the order is placed** (also for unpaid card/PayPal orders). Unpaid card/PayPal orders are
  cancelled and their stock released after ~65 minutes (the background job asks Stripe first, so a paid order is never cancelled).
- Two shoppers buying the last unit: one wins, the other is told. Discount-code use limits hold under simultaneous orders.
- A payment of the wrong amount is **never** accepted as paid: it is flagged on the order for staff.
- Refunding a card/PayPal order sends the money back through the provider, cancels the order and returns the stock.
- Shopify (or any channel) keeps working alongside: store orders change Inventory stock, which the channel sync then pushes.

## 5. Known limits (say these to the customer before go-live)
- **Search-engine previews**: the store is a single-page app. Google renders it, but link previews on WhatsApp/Facebook show the
  generic page, not the product. (Fix = server-side rendering — not built.)
- **No sales orders / invoices / ledger postings are created from store orders yet.** Orders live in the store orders screen; take stock
  correctly, but accounting entry is manual until the Finance integration is extended.
- One store per workspace; one currency; flat delivery rates (no live courier rates or labels).
- Product reviews, wishlists, abandoned-cart emails, gift cards, multi-language catalogue, and marketplace feeds are not built.
- Admin screens for the store are English only (the shopper-facing store is English + Arabic with right-to-left).
- Shopper accounts use their own login (not ERP users). Password reset works by email.
- Real-money payments were **not** exercised against Stripe / PayPal — only against stand-ins that mimic them. Do a live test order first.
