# UAE E-Invoicing — Plan for Vrodux

_Written 2026-10-20. Based on web research. Most of the sources are consultants' and software vendors'
articles, not FTA documents. Before building against any date or field list, check it against the
Ministry of Finance / FTA publications and the final PINT AE specification._

## 1. What the law requires

| Item | What the sources agree on |
|---|---|
| Model | Peppol, using the UAE "5-corner" model, also called DCTCE. Supplier → supplier's Accredited Service Provider (ASP) → buyer's ASP → buyer. Invoice data is also reported to the FTA (the fifth corner). |
| Format | **PINT AE**: the UAE profile of Peppol's international invoice standard. Structured XML (UBL 2.1). A PDF is not an e-invoice. |
| Who sends | **Only an Accredited Service Provider can send.** A business, or its software, cannot submit to the FTA directly. |
| Pilot | Voluntary pilot from 1 Jul 2026. No penalties. |
| Phase 1 | Revenue **≥ AED 50M**: appoint an ASP by **30 Oct 2026** (moved from 31 Jul by Ministerial Decision 66/2026). Go live **1 Jan 2027**. |
| Phase 2 | All other businesses: appoint an ASP by **31 Mar 2027**. Go live **1 Jul 2027**. |
| Government entities | From 1 Oct 2027. |
| Penalties (reported) | AED 5,000 a month for not appointing an ASP. AED 100 per invoice not sent, capped at AED 5,000 a month. |

**Not settled in the sources. Confirm with the FTA spec:**
- Clearance or reporting? Some sources say the FTA validates each invoice and can reject it; others say it only receives a copy.
- Whether both ASPs report the tax data to the FTA.
- Whether B2C (retail / POS receipts) is in scope, and from when.
- How many ASPs are accredited. Sources give 16 and 41; use the Ministry's current list.

> ⚠️ **10 days left for Phase 1.** Any Vrodux customer with revenue of AED 50M or more must appoint an ASP
> by 30 Oct 2026. That is the customer's legal duty, not Vrodux's, but they will ask us which ASP works with
> Vrodux. We need an answer quickly.

## 2. Vrodux's role

Vrodux is **not** an ASP, and should not try to become one. Accreditation is a regulated process with security
audits and Peppol certification.

Vrodux's job is to:
1. Produce a correct PINT AE invoice for every taxable B2B/B2G document.
2. Hand it to the customer's chosen ASP through that provider's API.
3. Record what happened (accepted, rejected, delivered), store the returned identifiers, and show them on the invoice.
4. Receive incoming supplier e-invoices from the ASP and turn them into draft purchase bills. This part is optional, but valuable.

This follows the same pattern as the VAT 201 work (Module 82). There, a submission interface whose default
implementation honestly reports "not available" lets a real provider be plugged in without other changes.

## 3. Gaps in today's data

| Needed by PINT AE | Vrodux today | Work |
|---|---|---|
| Supplier TRN, legal name, address | Settings → Company (Module 55) | Validate as a 15-digit TRN. Add a structured address (emirate, city, country code). |
| Buyer TRN, name, address | `Invoice.CustomerTrn` / `CustomerAddress`, free text (Module 55b) | Structured buyer address plus emirate. Keep TRN on the **customer master**, not only on the invoice. |
| Buyer's Peppol participant ID | — | New field on the customer, filled automatically by the ASP's directory lookup where possible. |
| Invoice type (tax invoice, simplified, credit note, debit note) | Invoice only; credit notes appear only as Sales returns | **Credit notes linked to the original invoice in Finance.** This is a real gap. |
| Tax category per line (standard 5%, zero-rated, exempt, out of scope, reverse charge) | One tax rate per invoice | Tax category **on each line**, plus reason codes for zero-rated and exempt lines. |
| Unit of measure codes (UN/ECE Rec 20) | Free text | Map units to codes. |
| Item classification / description | Description only | Confirm against the final data dictionary. |
| Currency + AED tax amount | Currency on the invoice; exchange rates exist (Module 6e) | AED tax total required on foreign-currency invoices. |
| Invoice number uniqueness, issue date and time | Numbers are unique per tenant | Lock the invoice against edits once sent. |
| Payment terms and due date | Partial | Map them. |

Documents in scope, in order: Finance invoices (incl. recurring and quotation → invoice), credit notes,
purchase bills (incoming), Real Estate rent invoices, Visa invoices. POS / Restaurant / Hotel receipts only if
the FTA confirms B2C is in scope.

## 4. Technical design

```
Finance.Application/EInvoicing/
  PintAeBuilder        — pure: Invoice → PINT AE UBL XML (unit-testable, like UaeVatReturnBuilder)
  PintAeValidator      — schema + business-rule checks before anything leaves Vrodux
  IEInvoiceGateway     — Send / GetStatus / ReceiveInbound / LookupParticipant
Finance.Infrastructure/EInvoicing/
  UnavailableEInvoiceGateway      — default: "no ASP connected", never claims a send
  <Asp>EInvoiceGateway            — one class per ASP we partner with
  EInvoiceOutboxProcessor         — background service: send, retry with backoff, poll status
Finance.Domain
  EInvoiceSubmission   — per document: status (queued/sent/accepted/rejected/delivered/failed),
                         ASP message id, FTA reference, XML snapshot, errors, attempts
  EInvoiceSettings     — per tenant: ASP, credentials (encrypted, as for the CRM integrations), go-live date, on/off
```

Rules:
- **Outbox, not inline.** Approving an invoice queues it, and sending happens in the background, so an ASP outage never blocks invoicing. Use the claim-then-send pattern with a unique key per document (as in Module 53) so an invoice can never be sent twice.
- **Snapshot the XML** that was sent. Never regenerate it for a sent invoice.
- **Once sent, the invoice cannot be edited.** Corrections go through a credit note.
- **Errors are shown on the invoice**, with the ASP's own message, and offer a retry.
- Permissions: `finance.einvoicing.view / edit / send`.
- Super-admin setting: list of supported ASPs.

## 5. Phases

| Phase | Scope | Target |
|---|---|---|
| **0 — now** | Pick 1–2 ASPs to partner with (API quality, price, sandbox access, UAE accreditation). Get sandbox credentials. Get the final PINT AE spec. Tell large customers which ASP to appoint. | before 30 Oct 2026 |
| **1 — data** | Structured addresses and TRN on the customer, tax category per line, credit notes in Finance, UoM codes. Useful even without e-invoicing. | Nov 2026 |
| **2 — builder** | `PintAeBuilder` + validator + unit tests against the official samples; "Download PINT AE XML" on an invoice. | Nov 2026 |
| **3 — send** | First ASP gateway, outbox, status tracking, invoice UI, settings page. End-to-end test in the ASP sandbox. | Dec 2026 (Phase 1 customers go live 1 Jan 2027) |
| **4 — receive** | Incoming e-invoices → draft purchase bills, matched to supplier and PO. | Q1 2027 |
| **5 — broaden** | Second ASP, Real Estate / Visa invoices, B2C if in scope, dashboard of rejected / unsent invoices. | before 1 Jul 2027 |

## 6. Decisions needed

1. **Which ASP(s) to partner with.** This drives Phase 3, and customers are asking now.
2. **Phase 1 customers.** Does any current tenant have revenue of AED 50M or more? If none, the real deadline is 1 Jul 2027 and the plan can relax.
3. **Credit notes.** Build a proper Finance credit-note document (recommended) rather than reusing Sales returns.

## Sources
- [ClearTax — e-Invoicing in UAE](https://www.cleartax.com/ae/e-invoicing-uae)
- [VATCalc — UAE e-invoicing timeline](https://www.vatcalc.com/uae/uae-e-invoice-plans-2022/)
- [GFLO — UAE e-invoicing 2026 guide](https://gflolaw.com/en/uae-e-invoicing-2026-guide/)
- [Velmont Crest — deadline extended to 30 October](https://velmontcrest.ae/insights/uae-e-invoicing-2026/)
- [Amal ERP — deadlines, PINT AE](https://amalerp.com/ae/e-invoicing-software)
- [Hubpay — deadlines and penalties](https://hubpay.io/resources/e-invoicing-uae)
- [Wafeq — what your accounting system must support](https://www.wafeq.com/en-ae/tax-and-reporting/uae-fta-e-invoicing-what-your-accounting-system-must-support-before-the-deadline)
- [Massive — 5-corner model](https://massive.ae/e-invoicing-uae/5-corner-model)
- [Fatura — Peppol and PINT AE](https://invoicefatura.com/guides/peppol-pint-ae-explained)
- [Taxstar — PINT AE data dictionary](https://www.taxstar.app/pint-ae-explained)
