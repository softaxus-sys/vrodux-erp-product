# UAE E-Invoicing: ASP provider research and integration model

_Written 2026-11-04. Companion to `uae-einvoicing-plan.md` (what the law requires and what Vrodux must build)._
_Provider facts below come from the providers' own public pages and developer docs, read on this date. No contract,
price list or accreditation certificate has been seen. Verify every point before relying on it._

## 1. Status

- **Nothing is sent to an ASP yet.** There is no PINT AE builder, no ASP gateway, no send queue and no credit note
  document in Finance. See the "What exists" list in section 7.
- **No provider is chosen.** Storecove has been contacted (form submitted by Soft Axis Technologies). Wafeq's sandbox
  is free and self-service and can be opened at any time.
- Do not describe Vrodux as "e-invoicing ready" until a provider is connected and tested in its sandbox. Use
  "prepares PINT AE invoices for your accredited provider".

## 2. Why an ASP is needed, and why it costs money

- Only an Accredited Service Provider can put an invoice on the Peppol network and report it to the FTA. Software,
  and the business itself, cannot submit directly. There is no portal where a business uploads invoices by hand the
  way it files a VAT return.
- Accreditation means audited security, certified Peppol access, uptime and archiving duties and support. Providers
  recover that cost through subscriptions, per-invoice fees and per-company fees.
- Vrodux should not try to become an ASP.

## 3. Wafeq (read from docs.wafeq.com)

| Item | What the docs say |
|---|---|
| Sign up | Organization in the Wafeq ASP portal (einvoicing.wafeq.com). API keys under Developer, API keys. |
| Sandbox | Free, no subscription. Keys start `pk_test_`. Nothing reaches EmaraTax, Peppol or the FTA. Delivery is simulated. Two reserved test buyers exist (one not on Peppol, one that simulates Peppol being down). |
| Live | Paid subscription bought in the portal. Keys start `pk_live_`. Separate keys, OAuth client, webhooks and taxpayers from sandbox. Nothing carries over. |
| Who builds the XML | **Wafeq.** Our app sends invoice data. Wafeq builds the PINT AE document, validates it, delivers it and reports it to the FTA. Invalid documents are refused and nothing is sent. |
| Documents | Invoices, credit notes, void by credit note, self-billed invoices and credit notes. A check-without-sending endpoint for each. XML download. Delivery status. History of FTA reports. |
| Buyer lookup | Peppol reachability check. Buyer id is `0235:` plus the buyer's TIN. Not on Peppol means the FTA-only route, which needs the buyer's VAT TRN. |
| Status | Webhooks (must return 2xx or the event is resent). `Idempotency-Key` on submissions. |
| Connecting a customer | The customer picks **Wafeq FZ LLC** as provider in EmaraTax, enters its tax id and registered email at Wafeq, then approves our app (OAuth grant). We store a taxpayer id and a grant id per customer. The customer can revoke at any time. |
| Limits | Subscription includes a number of **taxpayer seats**; each connected customer uses one while its grant is active. No seats left means no new customer can approve. Revoking frees the seat. **An unverified app is limited to 25 businesses in Live.** Wafeq verifies apps on request. No subscription means submissions fail with `402 subscription_required`. |
| Not found in the docs read | Prices, contract terms, partner or reseller programme, incoming supplier invoices, accreditation reference. |
| Pages not yet read | Authentication, webhooks, rate limits, errors, document types, VAT on each line, special scenarios, import from file. |

Concerns: Wafeq also sells accounting software, so it competes with Vrodux. Confirm in writing that serving a rival
ERP is acceptable. Customers connected this way use Wafeq as their ASP; a customer on another provider needs another
adapter. The docs use a 10-digit TIN, while Vrodux stores a 15-digit TRN; the mapping must be confirmed.

## 4. Storecove (read from storecove.com/us/en/compliance/uae)

- Offers a single API covering format, Peppol exchange, validation and FTA reporting, and a **30-day sandbox**.
- Lists integrators (Odoo, Oracle, SAP, QuickBooks, Sage, Zoho and others) and a "Become an Integrator" page.
- The page does **not** state that Storecove is an accredited UAE provider. Its listed accreditations are not
  UAE-specific. **Confirm accreditation against the Ministry list before paying.**
- No prices and no UAE partner programme are described.
- **Status:** a get-started form was submitted by Soft Axis Technologies on 2026-11-04. **Reply received 2026-11-05** (by email, unverified until confirmed in writing and against the Ministry list):
  - Says Storecove, through **Storecove Gulf**, is pre-approved as a UAE accredited provider (no reference number given).
  - One integration can serve many customer companies; each customer is created as a **legal entity (TRN + Peppol ID) through the API**, so onboarding can sit inside Vrodux. No limit on the number of customers.
  - Sandbox is free; they can set up access now and asked who should receive the credentials.
  - Production is under an **Integrator/partner agreement**: a platform licence plus volume-tiered per-document pricing, with reseller or direct-billing options. No figures given.
  - Supports sending and receiving PINT AE invoices and credit notes, incoming supplier invoices (webhook or API), and status webhooks.
  - They proposed a 30-minute call next week to scope volumes and commercial setup.
  - **Still to ask:** the accreditation reference and the exact entity name on the Ministry list; the licence fee and per-document price bands; whether Storecove builds the PINT AE XML or we must; how the customer's EmaraTax provider appointment works; who supports end customers; what happens to history if a customer leaves; data location and retention.
  - **API facts found 2026-11-05** (full docs at app.storecove.com/docs are behind a login, so these come from search extracts, a Boomi connector page and Storecove blog posts; verify in the sandbox): REST JSON, `https://api.storecove.com/api/v2/`, Bearer API key. Resources: `legal_entities` (create/get/update/delete), `additional_tax_identifiers`, `peppol_identifiers`, `administrations`, `document_submissions` (send; evidence endpoint returns the exact document sent and the receiving point's signature), received documents plus purchase invoice as JSON or UBL, discovery (does a participant exist / receive), webhook instances. UAE: sending JSON "Pure" to `document_submissions` yields a PINT-AE 1.0.4 UBL invoice or credit note, so **Storecove builds the XML**. Peppol id scheme 0235 = first 10 digits of the TRN (carried as `AE:TIN`); a legal registration id is required (`AE:TL` trade licence, `AE:EID`, `AE:PAS`, `AE:CD`), with registration authority name for a licence and issuing country for a passport. Buyer not on Peppol uses placeholder `0235:9900000098`. Credit notes = code 381. Validation runs at creation. Blog claims parallel FTA e-reporting. **Not found:** webhook payloads, EmaraTax appointment steps, rate limits, prices, sandbox limits, accreditation number.
  - This answers the "one account, many TRNs" question that Wafeq's 25-business cap left open, so Storecove is now the leading candidate to resell.

## 5. Who else

The Ministry of Finance publishes the official list: https://mof.gov.ae/en/about-us/initiatives/einvoicing/pre-approved-einvoicing-service-%20providers/
Third-party directories disagree on the number (41, 65, 80 and 83 are all quoted), so use only the Ministry page.
Aigentrix (TronStride) publishes a 29-endpoint API reference with a sandbox that routes to the Peppol test network,
but it was not read in detail.

## 6. Business model options

1. **Customer brings their own ASP.** Vrodux only integrates. Cheapest for us, no extra revenue, works only for
   providers we have an adapter for.
2. **Vrodux resells one ASP** as an add-on: the customer pays Vrodux a monthly fee plus a per-invoice charge, Vrodux
   pays the provider. We keep the margin and give one bill and one support contact. Needs a price from the provider,
   a seat plan, and a billing method (the credit system used for SEO and Lead Generation could carry the per-invoice
   charge).
3. **Mixed:** resell by default, allow other providers for customers that already have one.

Suggested: integrate two providers, resell one as the easy default.

## 7. What can be built before any provider is connected

> **Built 2026-11-05 (Module 99 in CLAUDE.md):** items 1, 4, 5, 6, 7 and 9 below. Not yet built: items 2 and 3 as new screens (the line fields already existed), and item 8 (incoming invoices). Nothing is sent: the gateway reports that no provider is connected.

Exists today: tax category, exemption reason and unit code on invoice lines; city, emirate, country code, TRN and
Peppol id on customers (migration `AddEInvoicingCustomerAndLineTaxFields`); supplier name, address and TRN on printed
invoices; buyer address and TRN on invoices; VAT 201 preparation.

Build now:
1. Credit notes in Finance, linked to the invoice they correct.
2. Tax category per line and exemption reason chosen on the invoice screens and used in totals.
3. Structured buyer address, TRN check, Peppol id on the customer, AED tax total on foreign-currency invoices.
4. Lock an invoice once it is issued; corrections only by credit note.
5. A provider-neutral gateway interface, with a default that honestly reports "no provider connected" and never
   claims a send. One adapter per provider later.
6. Send queue (outbox, one send per document, retry, status shown on the invoice, provider error text, snapshot of
   what was sent), provider settings with encrypted credentials, and permissions `finance.einvoicing.*`.
7. PINT AE XML builder and validator with tests against the official samples, and a "Download XML" action. Still
   useful when a provider builds the XML itself, because it supports file export and other providers.
8. Incoming supplier invoices into draft purchase bills, tested with sample files.
9. A readiness dashboard listing invoices and customers with missing TRN, address or tax category.

**Release in two steps.** Step 1: items 1 to 4, 7, 8, 9, so a customer downloads the XML and uploads it to their
provider's portal (provider upload support must be confirmed). Step 2: one provider adapter for automatic sending.

## 8. Questions to put to every provider

1. Ministry accreditation reference and the PINT AE version supported.
2. Sandbox and production price, monthly and annual; whether the sandbox fee is credited against a contract.
3. Any charge per invoice or per company; seat limits; price of extra seats.
4. How customers are added: one partner account with many TRNs, or each customer contracts separately.
5. Partner or reseller programme and margin; the process and cost of app verification.
6. Support for incoming supplier invoices, credit notes, status webhooks.
7. Who handles customer support and who holds the legal relationship.
8. What happens to a customer's history if they move to another provider.

## 9. Open points (not settled in the sources)

Clearance versus reporting; whether retail and POS receipts are in scope and from when; the current number of
accredited providers; the 10-digit TIN versus 15-digit TRN mapping; deadlines (the plan records 31 March 2027 to
appoint an ASP and 1 July 2027 to go live for businesses under AED 50 million, 30 October 2026 and 1 January 2027
for AED 50 million and above; confirm with the Ministry).

## Sources

- https://docs.wafeq.com/ and the UAE e-invoicing guides under https://docs.wafeq.com/uae-einvoicing/
- https://www.storecove.com/us/en/compliance/uae
- https://mof.gov.ae/en/about-us/initiatives/einvoicing/pre-approved-einvoicing-service-%20providers/
- https://www.tronstride.com/api-docs/
