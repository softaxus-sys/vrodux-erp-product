# UAE VAT (FTA) return integration

## What FTA actually publishes (verified 2026-10-20)

Source: FTA *Requirement document for Tax Accounting Software*
(https://tax.gov.ae/DataFolder/Files/Pdf/requirement-document-for-tax-accounting-software.pdf).

| Item | Status |
|---|---|
| **FTA VAT Audit File (FAF)** — CSV, Appendix 5 (CompInfo / Purchase / Supply / GL tables) | Fully specified → **implemented** |
| **VAT 201 return field set** — Appendix 8 (boxes 1a–14) | Fully specified → **implemented** (computed + XML rendering) |
| **VAT return file for EmaraTax "Auto Fill VAT Return"** (Option 1, manual upload) | Field set specified; **no XML/xlsx schema published**, and the file must be **encrypted with credentials FTA issues at vendor certification** → our XML is marked `certified="false"` and is a worksheet, not an uploadable file |
| **Direct upload to ITAS from software** (Option 2) | Spec says it "is not an immediate need" and will be communicated to vendors later. **No endpoint, auth scheme, payload schema or sandbox is published** |
| UAE e-invoicing (Peppol, ASP) | A separate workflow (invoice clearance/reporting), not VAT-return filing — out of scope here |

No FTA/EmaraTax/Peppol code, credentials or endpoints existed in this repository.

**Consequence:** Vrodux does **not** transmit returns to FTA. `UnavailableUaeVatSubmissionGateway`
records a `not_available` attempt and never reports a return as submitted.

## Workflow

```
Draft → Validated → Reconciled → Approved → Ready to submit ─┬→ Submitted → Acknowledged | Rejected   (gateway response only)
                                                            └→ Filed via portal                       (person filed on EmaraTax, enters reference)
```

* **Prepare** reads `VatLedger` (issued invoices = output VAT, approved purchase bills = input VAT) —
  the same engine as the Tax & VAT screens; VAT is never recomputed. Foreign documents convert to
  AED with `GlPoster.GetRateAsync`, the rate the GL posted with.
* **Reconcile** compares net VAT with the period movement on the VAT control account `2200`
  (tolerance AED 1.00). An unreconciled return cannot be approved.
* **Ready** regenerates from the ledger, refuses if anything changed since approval, then freezes
  the FAF + XML, a SHA-256 content hash and an idempotency key.
* **Submit** commits an `in_progress` attempt first (a filtered unique index allows one per return),
  then calls the gateway, then records its real outcome. `failed`/`auth_failed`/`not_available`
  leave the return retryable with the same idempotency key; an accepted return is never resent.
* **Filed via portal** records an EmaraTax reference for a manual filing and marks the tax period filed.

Permissions reuse `finance.tax.*`: view (read/download), create (prepare), approve (approve, ready,
submit, record filing), edit (VAT registration). Data is tenant-isolated by the Finance DbContext filter.

## Known mapping limits (surfaced as warnings on every return)

* Invoices have no place-of-supply field → all standard-rated sales go to the registration's emirate box.
* 0% sales are reported as zero-rated (box 3); exempt / GCC / out-of-scope are not distinguished.
* Boxes 2, 4, 5, 6, 7, 10, 11 have no source data and are 0. Expenses carry no tax fields.
* FAF has one line per document (document-level VAT, so totals equal the return); the GL table is not yet emitted.

## Configuration

`UaeVat__*` environment variables (see `.env.example`, placeholders only). `AllowProduction` must be
explicitly `true` before any production gateway is used. Nothing is read from committed appsettings.

## Enabling real transmission later

Requires, from FTA (or an FTA-authorised provider): Tax Accounting Software accreditation and a
vendor TRN, published API documentation, sandbox base URL and credentials, and the encryption/
signing requirements for the return file. Then implement `IUaeVatSubmissionGateway` (TLS,
timeouts, token refresh, idempotency key header) and register it in place of the unavailable one.

## Tests

`dotnet test Backend/tests/Softaxis.Finance.UaeVat.Tests` — 35 tests, **all offline/mocked**
(in-process fake gateways, EF InMemory). There are no real sandbox tests because no sandbox exists.
Not covered: the SQL filtered unique index (InMemory does not enforce it) and `VatLedger` SQL queries.
