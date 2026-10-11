# Finance Integration Center

Audit of how every module reaches the General Ledger, and the feature built from it
(`/finance/integrations`, API `api/finance/integrations`).

## 1. Audit — what reached the ledger when this was written

> **Out of date for the modules marked in the table below.** The current position is in
> [Current status](#current-status-after-the-posting-hub). This section is kept as the original audit.

Traced from the business transaction to the journal entry. "Posts" means a handler calls
`GlPoster.PostAsync` (`Softaxis.Finance.Infrastructure/Handlers/GeneralLedger/GlPoster.cs`), the
only code that creates posted journal entries outside the manual journal screen.

### Fully connected — Finance's own documents

Posted in the same database transaction as the document, to fixed account numbers.

| Transaction | Trigger | Entry | Reversal |
|---|---|---|---|
| Sales invoice | `SendInvoiceHandler`, `InvoiceScheduleSweep` | Dr 1200 AR · Cr 4001 revenue · Cr 2200 VAT | Cancel / reset |
| Invoice payment | `MarkInvoicePaidHandler` | Dr 1001/1010 · Cr 1200 · FX to 4950 | Reset |
| Receipt voucher | `PostReceiptVoucherHandler` | Dr 1001/1010 · Cr 1200 · FX to 4950 | Void |
| Purchase bill | `ApprovePurchaseBillHandler` | Dr 5400 purchases · Dr 2200 VAT · Cr 2001 AP | Cancel |
| Payment voucher | `PostPaymentVoucherHandler` | Dr 2001 · Cr 1001/1010 · FX to 4950 | Void |
| Expense | `ExpensePosting` (manual pay + recurring auto-post) | Dr expense by category · Cr 1001/1010 | — |

### Partially connected — driven from the browser

The browser calls the Finance API after the source action. Nothing server-side guarantees it runs.

| Transaction | How | Gap |
|---|---|---|
| Payroll | `use-payroll-finance.ts` creates a journal entry after Finance approval | Accounts are matched **by name**; when none match, the run is approved and nothing is posted. Posts net pay only, not gross and deductions. |
| Production cost | "Post cost to Finance" on a completed order | Creates a **draft** entry; optional; orders can stay unposted (2 of 5 completed orders in the dev database have none). |
| Visa case invoice | Tick box at case creation | Draft invoice; reaches the ledger only when someone sends it. |
| Quotation → invoice | Button on the quotation | Same. Sales orders and delivery challans post nothing. |

### Not connected

| Module | Transactions that post nothing |
|---|---|
| Retail POS | Sales, refunds, cash movements |
| Restaurant | Paid orders, refunds, tips |
| Real Estate | Rent payments, advance rent |
| Library | Fines collected |
| Sales | Approved / completed returns |
| Purchase | Goods receipts, purchase returns |
| Inventory | Adjustments, write-offs, transfers |
| Hospitality | Booking payments |
| Construction | — (no financial transactions in the module) |
| Finance | **Bank transactions** — deposits, withdrawals and transfers change the bank account balance but raise no journal entry, so the bank balance and ledger account 1010 can drift apart |

### Other findings

1. **No account mapping existed.** Every posting used account numbers hardcoded in `GlPoster`.
2. **No source link on a journal entry.** A journal entry carries only a free-text `Reference`; the
   link lives on the source document (`JournalEntryId`).
3. **No duplicate-posting guard beyond document status.** Sound for Finance's own documents (each
   handler checks status first), absent for anything posted from the browser.
4. **No failed-posting handling.** A browser-side posting that fails is a toast; nothing records it
   or retries it.
5. **A closed fiscal period returned HTTP 500.** Eight handlers return `FiscalPeriod.Locked`, a code
   `FinanceControllerBase` did not map. **Fixed** — now 409.
6. **Stock is not carried in the ledger.** Purchases are expensed to 5400 when the bill is approved,
   and nothing posts to 1300 Inventory. Goods receipts, stock adjustments and production receipts
   therefore have no account to move without first changing how bills post. Not changed — it is an
   accounting-policy decision, not a wiring gap.
7. **Native postings do not round.** `invoice.Total * rate` and `SubTotal * rate + TaxAmount * rate`
   are compared with decimal equality; with a non-1 exchange rate a last-digit difference would
   throw "not balanced". Not observed, not changed. The new engine rounds each line to 2 places and
   absorbs a rounding difference of at most one cent per line.

## 2. What was built

### Model (schema `finance`, migration `AddFinanceIntegrationCenter`)

- `integration_settings` — per workspace, per integration: `off | review | auto`, optional start date.
  **No row means off.** Nothing is collected or posted until a workspace switches an integration on.
- `integration_account_mappings` — role → account. No row = the integration's default account.
- `posting_items` — one row per source document. **Unique on (tenant, integration, source id)**:
  this is the duplicate-posting guard.

### Queue-backed integrations

`pos.sale`, `pos.refund`, `restaurant.order`, `restaurant.refund`, `realestate.rent`,
`library.fine`, `hr.payroll`.

Finance **reads** each module's table with cross-schema SQL (`PostingSources.cs`) — no code in
those modules changed, and each still works without Finance. Raw SQL is outside EF's tenant
filter, so every source compares its tenant column by hand; a unit test fails if one does not.

### Posting (`PostingEngine.PostAsync`)

1. **Claim** the item with one `UPDATE … WHERE Status IN ('pending','failed')`. Of two simultaneous
   callers exactly one changes a row; the other posts nothing.
2. Resolve accounts (mapping, else default), convert to the ledger currency, build lines
   (`PostingLineBuilder`, pure and unit-tested).
3. Refuse — with a reason stored on the item — when the period is closed, an account is missing or
   inactive, or the entry does not balance.
4. Post through the existing `GlPoster`, mark the item posted. **Journal entry and item status are
   one save.**

A stale claim (worker died mid-post) is retryable after 10 minutes.

### Payroll write-back

Payroll shows its journal entry on the run, and its approval screen posts from the browser when the
run has none. So a run posted from the queue writes its entry id back to `hr.payroll_runs` — only
into a link column that is still empty. This is the one place Finance writes outside its schema.

### Background

`PostingQueueHostedService` — every 15 minutes, only workspaces with an integration switched on,
honours `ITenantWorkFilter` (a cloud mirror does not post).

### Permissions (`finance.integrations`, migration `AddFinanceIntegrationPermissions`)

`view` reads · `edit` changes modes, mappings, skip/requeue · `approve` writes to the ledger
(collect, post, retry, reverse). Administrator roles gain all three at startup.

### API

`GET /` overview · `PUT /{key}/setting` · `PUT /{key}/mappings` · `POST /sync` · `GET /queue` ·
`GET /queue/{id}/preview` · `POST /queue/post` · `POST /queue/retry-failed` ·
`POST /queue/{id}/skip|requeue|reverse`.

## 3. Accounting choices to confirm with an accountant

- **Tips** are credited to 2400 Accrued Expenses (a liability owed to staff), not revenue.
- **Payroll** is posted gross: Dr 5001 for basic + allowances, Cr 2100 for net, Cr 2400 for deductions.
- **Restaurant refunds** debit revenue for the whole amount; tax is not split out because a refund
  row stores a single amount.
- **Rent** is posted when an installment is fully paid, for the amount paid. Part payments wait.
- **POS card and wallet takings** go to 1010 Bank. A workspace that wants a card-clearing account
  can map the `bank` role to one.
- Dates of POS and restaurant documents are the **UTC** date of the transaction.

## 4. Not built

- Server-side posting for bank transactions, sales returns, goods receipts, stock movements,
  production cost, hotel bookings.
- Account mapping for Finance's own documents (still the fixed `GlPoster` numbers).
- A source link on the journal entry itself, and a "linked documents" view from the journal screen.
- Re-posting a reversed item (a correction is a manual journal entry).
- POS cash-in / cash-out movements.

## Posting from a module, checks, and automatic posting (added after the first release)

**From each module.** POS, Restaurant, Real Estate, Library and HR each have a "Post to Finance"
button. It appears only when the workspace has Finance and the user holds
`finance.integrations.view`. It opens that module's documents: waiting, failed and posted.

**Check before posting.** Posting always goes through a check first:

1. Select documents (or "Check all").
2. The check shows how many are ready and how many are blocked, with the reason for each blocked one
   (no account for a role, inactive account, closed period, already posted).
3. It shows total debit, total credit, whether they agree, and the amount going to each account.
4. The user ticks a confirmation and posts.

The total the user saw is sent with the post (`controlTotal`). The server runs the same check again
and posts nothing if the total has changed or does not balance. Blocked documents are skipped, not
failed.

| Endpoint | Permission | Purpose |
|---|---|---|
| `GET /integrations?module=pos` | view | One module's integrations |
| `POST /integrations/queue/check` | view | Dry run; writes nothing |
| `POST /integrations/queue/post` (`controlTotal`) | approve | Post what was checked |
| `GET /integrations/{key}/auto-readiness` | view | What automatic posting would do |

**Automatic posting.** Switching an integration to automatic is refused unless:

- the request carries `acknowledgeAuto: true` (the UI sets it only after the warning is confirmed);
- every account the integration needs exists and is active;
- the user holds `finance.integrations.approve`.

Changing the start date while automatic is on needs the confirmation again, because it changes which
documents are posted unattended. Going back to manual or off needs none.

**Verified:** 48 API checks and a browser run on the Restaurant page. Only restaurant orders were
posted; the other modules' buttons use the same component but were not opened.

## Safeguards on automatic posting

Automatic posting writes to the ledger with nobody looking, so it posts a document only when all of
these hold. Otherwise the document waits for a person, with the reason shown.

| Safeguard | What happens |
|---|---|
| The document's own figures agree | Tax inside the total, payments cover the document, payroll basic + allowances − deductions = net. If not: held. |
| Every payment has a posting rule | Cash → cash account; card, cheque, transfer → bank; wallet, store credit, house account → customer balances (1200). Anything else (POS "Mixed", "Voucher", rent with no method, fine paid as "other"): held. |
| The document is unchanged since it was collected | It is read again at the moment of posting. Changed: figures updated, not posted, waits for a re-check. |
| The document still qualifies | Cancelled, deleted, or already posted from its own module (payroll approval screen, library fines screen): not posted, taken out of the queue. |
| Same currency as the ledger | Never converted. A mismatch is refused. |
| A start date is set | Required before automatic can be switched on. |
| Accounts exist and are active | Checked when switching on, and again for every document. |
| One entry per document | Unique queue key, single-claim posting, and the source is marked in the same transaction. |

After posting: if a POS sale is voided or a restaurant order cancelled, its queue item is flagged and
the integration shows an issue. A person reverses the entry; it is not reversed automatically.

## Current status (after the Finance Posting screen)

One screen, **Finance Posting** (`/finance/posting`), now shows every module's documents waiting for the
ledger. A workspace sees only the modules it has: the server filters by the licences in the user's
token, so a workspace with only Finance and Inventory sees none of the POS, Sales or Library data.

### Connected
| Module | How | Posting |
|---|---|---|
| Finance: invoices, payments, vouchers, purchase bills, expenses | Native — posted with the document | Automatic, reversed by cancel/void |
| Retail POS: sales, refunds | Posting screen | Manual or automatic |
| Restaurant: orders, refunds | Posting screen | Manual or automatic |
| Real Estate: rent received | Posting screen | Manual or automatic |
| Library: fine payments | Posting screen (shared with the library's own post-fines screen: one payment is never in two entries) | Manual or automatic |
| HR: payroll | Posting screen (shared with the payroll approval screen, same rule) | Manual or automatic |
| Sales: approved returns | Posting screen | **Manual only** — returns carry no tax and are not tied to an invoice |
| POS: wallet top-ups and house-account payments | Posting screen. The payment method is now recorded on each top-up: cash debits cash, card / bank transfer / cheque debits the bank, credit goes to customer balances (1200). | Manual or automatic |
| POS: cash in / out | Posting screen. The cashier picks what the cash was for: owner deposit, bank withdrawal, cash out to bank, petty expense, owner withdrawal. | Manual or automatic |
| Hotel: booking payments | Posting screen. Each payment is its own row with a method; cash or bank is debited, revenue (4001) credited. | Manual or automatic |

### Partly connected
| Module | State |
|---|---|
| Manufacturing: production cost | A person posts a draft entry from the order. Not on the queue: it would debit finished goods and credit raw materials, but purchases are expensed, so raw materials are not in the ledger. Needs the inventory decision below. |
| Visa case invoices, Quotation → invoice | They create a Finance invoice; it reaches the ledger when the invoice is sent (native). Nothing further to connect. |

### Not connected, and why
| Item | Why it is not posted |
|---|---|
| Bank transactions | Deliberately **not posted**: a bank line has one side only, and receipt/payment vouchers already post the same money, so posting both would count it twice. They are **reconciled** against the ledger instead (see Bank reconciliation below). |
| Goods receipts, purchase returns, stock adjustments and write-offs | Stock is not carried in the ledger (purchases are expensed at bill approval). Needs the accounting decision to carry inventory first. |
| Construction | The module records no financial transactions. |
| Rows recorded before this release | Wallet top-ups, cash movements and hotel payments with no method or category are collected but **held for review**; hotel bookings that already had a paid total are not back-posted. |

### Approval levels
Set per integration in the Integration Center, and enforced by the server.

| Level | Permission | Can |
|---|---|---|
| View | `finance.integrations.view` | See the screen |
| Prepare | `finance.integrations.submit` | Submit documents for approval, withdraw their own |
| Approve | `finance.integrations.approve` | Check and post, reverse, retry |
| High-value | `finance.integrations.approve-high` | Post or reverse documents above the integration's limit |

An integration may also have a **limit** (documents above it need high-value approval and are never
posted automatically) and **a second person must approve** (the submitter cannot be the approver;
not available together with automatic posting).

### No duplicates
One queue row per source document (unique tenant + integration + source id); a document is claimed
with a single update before it is posted, so simultaneous posts make one entry; the journal entry and
the queue row are saved together; documents that can also be posted from their own module screen are
marked there in the same transaction. Verified: six simultaneous posts, repeated collections, and a
repost after a reversal each leave exactly one live entry.

### Reversing a wrong entry
Open the document → **Reverse entry** → give a reason (required). The entry is cancelled in the
ledger and kept; the document shows who reversed it and why. **Post again** puts it back in the queue
once the cause is fixed. Reversing an entry above the limit needs high-value approval.

## Bank reconciliation

Screen: Finance → Banking → **Reconcile** (needs `finance.banking.view` to look, `finance.banking.edit` to match).

- Each bank account is tied to the chart account it is kept in (**Ledger account**). It is chosen by a
  person, never guessed, and cannot be changed while lines are matched.
- The screen lists statement lines not yet matched, and the posted ledger lines on that account not yet on
  the statement. Money **in** at the bank pairs with a **debit** to the account in the books, money out with a credit.
- A pair must have the **same amount and direction**; the server refuses anything else. Draft and deleted
  entries are never offered. A ledger line can be matched once (unique index).
- Suggestions are lines with the same amount within a date window (0–60 days, default 5), closest date first.
- **Auto-match** settles only unambiguous pairs — one candidate from each side. Anything else is left for a person.
- The books balance, the statement balance and the difference are shown. A difference is normal until the open lines are matched or explained.
- Unmatch is available from the transactions table (a matched line shows its entry number).
- Nothing is posted by reconciliation: it never creates or changes a journal entry.

Not built: importing a bank statement file, matching one statement line to several ledger lines (or the
reverse), creating a journal entry from an unmatched statement line (bank fees, interest), and a reconciliation
sign-off report for a period.
