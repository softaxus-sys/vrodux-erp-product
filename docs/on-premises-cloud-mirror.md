# On-Premises Primary → Cloud Mirror
## Design for a single-store retail tenant running POS, Inventory and Finance locally, syncing once nightly

> **Scope agreed with the client before this document:** the cloud copy is a **read-only mirror**, and
> this is a **single store**. Both constraints are load-bearing — most of the simplicity below comes
> directly from them, and neither can be relaxed later without redesigning the sync layer. Section 12
> says what changes if they are.
>
> Stack as it actually is in this repo: **.NET 10, EF Core, MediatR/CQRS, SQL Server, multi-tenant via
> shadow `TenantId` + global query filter**, one `ApiGateway` process hosting every service, one
> physical database with a schema per service.

---

## 0. Executive Summary

The client trades all day with no dependency on the internet, and wants the day's data in the cloud
each night so the owner can see reports off-site and so there is an off-premises copy.

**The shape:** the on-premises box is the *system of record*. The cloud holds a second tenant with the
**same tenant GUID**, kept up to date by a nightly one-way push, and is **read-only** — enforced, not
merely agreed. Nothing ever flows down.

**What already exists and is reused rather than rebuilt:**

| Need | Already in the codebase |
|---|---|
| "Is this tenant on-prem?" | `Tenant.DeploymentType` (`Cloud` / `OnPremises`) |
| Offline licensing | RSA-signed `LicenseKey` with `ExpiresAt` inside the signature; `SubscriptionEnforcementMiddleware.EvaluateOnPrem` validates it with no network |
| On-prem packaging | `Deploy/server/publish.bat` → self-contained single-file exe, run as the VroduxERP Windows Service |
| Scheduled background work | `TrialLifecycleService` / `RentAlertBackgroundService` — daily loop, startup delay, try/catch at both levels |
| Failure alerting | `IIntegrationHealthAlerter` (Module 62b) — announce on failure, again on escalation, once on recovery |
| Idempotent replay | Module 58's `ClientRef` + tenant-scoped filtered unique index |

**What does not exist at all:** any data sync between two databases. Module 58's POS "offline mode" is
a browser-side IndexedDB cache on the till, replayed into the *same* server at day end. It is not a
second database and it covers POS sale events only — nothing in Inventory or Finance. It is useful
precedent for idempotent replay and nothing more.

**New surface this design adds:** one settings entity, one capture service, one push service, one
receive endpoint, one scheduler, and a read-only guard on the cloud side. No changes to any existing
module's domain model.

---

## 1. Principles

These are the rules the rest of the document follows. Each exists because breaking it produces a class
of bug rather than a single bug.

1. **One writer.** The on-premises database is authoritative for every row in scope. The cloud copy is
   never edited. Two writers with a 24-hour reconciliation window owes conflict resolution for every
   entity in three modules, and gets it wrong silently.
2. **Read-only is enforced on the cloud, not assumed.** Someone will eventually try to edit there. If
   the only thing stopping them is a policy, the divergence is discovered weeks later by an accountant.
3. **Sync failure never blocks trading.** A failed night is an alert and a retry. The shop opens in the
   morning regardless, and the local system does not care whether the cloud is reachable.
4. **Idempotent by construction.** Every push can be replayed safely. The night the link drops
   mid-batch, the retry must not double-apply — that is not an edge case, it is the normal failure.
5. **Convergent, not all-or-nothing.** Progress is checkpointed per batch, so a store on a poor
   connection converges over several attempts instead of restarting from zero each night.
6. **A silent sync failure is the feature failing.** Nothing about this is visible to the user until it
   breaks, so the alerting path is part of the build, not a follow-up.

---

## 2. Topology

```
        ON-PREMISES (system of record)                    CLOUD (read-only mirror)
  ┌────────────────────────────────────────┐        ┌────────────────────────────────────┐
  │  Tills (browser) ──LAN──┐              │        │                                    │
  │                         ▼              │        │  ApiGateway (shared, multi-tenant) │
  │   VroduxERP Windows Service            │        │                                    │
  │   (self-contained ApiGateway exe)      │        │  Tenant {same GUID}                │
  │                         │              │        │    IsMirror = true  ← read-only    │
  │                         ▼              │        │                                    │
  │   SQL Server Express                   │        │  SoftaxisErpDb (cloud)             │
  │   SoftaxisErpDb (local)                │        │    identity / pos / inventory /    │
  │     Change Tracking ON                 │        │    finance — same schemas          │
  │                         │              │        │           ▲                        │
  │   SyncPushService ──────┘              │        │           │                        │
  │        │ nightly, configured local time│ HTTPS  │  POST /api/sync/push               │
  │        └────────────────────────────────┼───────▶│  (license-authenticated)          │
  └────────────────────────────────────────┘        └────────────────────────────────────┘
```

**Why the till talks to the local server, not to IndexedDB.** With an on-premises server the tills are
genuinely online all day over the LAN, so POS should run in **normal online mode**. Module 58's offline
mode stays available as the fallback for a till that loses the LAN — but running both as the normal
path stacks two sync layers with different idempotency models over the same data, which is a
reconciliation problem nobody needs. **Default POS offline mode to off for this tenant.**

---

## 3. Tenant model — what to add, and what not to

### 3.1 Do not add a third `DeploymentType`

`DeploymentType` answers *"how is this installation licensed and enforced"*. For this client the answer
is genuinely `OnPremises`: the box runs all day with no internet on a signed offline license, which is
exactly what `EvaluateOnPrem` already does. Adding a `Hybrid` member forces every licensing branch to
answer "is Hybrid more like Cloud or On-Prem?" — forever, in code nobody wants to touch.

**Sync is a different concern from licensing.** Model it separately:

| | `DeploymentType` | Sync settings |
|---|---|---|
| Ordinary SaaS tenant | `Cloud` | none |
| Air-gapped on-prem | `OnPremises` | absent / disabled |
| **This client, in the shop** | `OnPremises` | **enabled, nightly** |
| **This client, in the cloud** | `OnPremises` | none — `IsMirror = true` |

**Both sides are `OnPremises`, and that is deliberate.** It was the natural assumption that the cloud
row should be `Cloud`, and it does not work: `GenerateTenantLicenseCommandHandler` refuses to issue a
key for a `Cloud` tenant (`Tenant.NotOnPrem`), so the provisioning order below would be impossible at
step 2. It is also the right answer on its own terms — the mirror is a view of an on-premises
installation, licensed by the same signed key, so `EvaluateOnPrem` gates both sides on the same
licence. If the customer stops paying, the box and the mirror stop together, which is what should
happen.

### 3.2 New: `TenantSyncSettings` (on-premises side, `identity` schema)

One row per installation. Single store means one row, full stop.

```csharp
public sealed class TenantSyncSettings : AuditableEntity<Guid>
{
    public Guid    TenantId       { get; private set; }
    public bool    Enabled        { get; private set; }
    public string  CloudBaseUrl   { get; private set; } = "";        // https://erp.vrodux.com
    public string  RunAtLocalTime { get; private set; } = "23:30";   // "HH:mm"
    public string  TimeZoneId     { get; private set; } = "Asia/Dubai";

    // Operational state, written by the push service.
    public DateTime? LastAttemptAt       { get; private set; }
    public DateTime? LastSuccessAt       { get; private set; }
    public int       ConsecutiveFailures { get; private set; }
    public string?   LastError           { get; private set; }
    public bool      ReseedRequired      { get; private set; }       // see §5.4
}
```

**The time zone is stored, not assumed.** "Day end at 23:30" is a local wall-clock instant; a UTC
schedule drifts against the trading day and lands mid-shift after a clock change. `WorkSchedule`
(Module 43) already carries a `TimeZoneId` for exactly this reason — follow it, including its rule that
an unresolvable id falls back to UTC rather than throwing, so a bad value never stops the service.

**No credentials are stored here.** Authentication reuses the license key already on the box (§7).

### 3.3 New: `Tenant.IsMirror` (cloud side)

A single `bool`, default `false`, marking a cloud tenant as the read-only reflection of an on-prem
installation. It is what §8.1 enforces against. It lives on `Tenant` rather than in sync settings
because the cloud side has no sync settings — it receives, it does not push.

### 3.4 Provisioning a store

The **same tenant GUID must exist in both databases** — that is what makes the mirror coherent, and
GUID primary keys throughout mean there is no id-collision problem to solve.

1. Create the tenant in the **cloud** as normal (super-admin console), plan and modules set to POS +
   Inventory + Finance, **deployment type `OnPremises`**, and `IsMirror = true`.
2. Generate the license key — `GenerateTenantLicenseCommand`, already exists. This is why step 1 sets
   `OnPremises`: a `Cloud` tenant is refused here.
3. Install on-premises: publish the exe, run `install-service.bat`, and seed the local database with
   **that tenant's GUID and license key** rather than creating a new tenant.
4. Configure `TenantSyncSettings` on the box and run the **initial seed** (§5.3).

> **Step 3 is the one genuinely new piece of provisioning work.** Today the only way to get a tenant
> row is to create a fresh one with a fresh id, so this needs an explicit adopt-existing-tenant path —
> a startup switch or a one-shot admin endpoint. Everything else is existing functionality run in a
> particular order.

---

## 4. What syncs, and what must not

Scope is the three modules the client bought, plus the identity data needed to make the mirror
readable. Roughly **64 tables** across `pos`, `inventory` and `finance` (28 / 10 / 26 by explicit
`ToTable()` calls — treat as approximate until enumerated in Phase 2), plus a subset of the ~18 in
`identity`.

### 4.1 Pushed up (on-prem → cloud)

| Schema | Content |
|---|---|
| `pos` | sales, payments, sessions/shifts, cash movements, customers, products, vouchers, tax rates, configuration |
| `inventory` | products, stock, stock movements, transfers, warehouses, brands, categories, units |
| `finance` | invoices, expenses, journals, accounts, payments, bills, budgets, fiscal periods |
| `identity` | users, roles, permissions, role/user assignments, branches, app settings |

### 4.2 Never overwritten by a push — cloud-owned

This list is not an optimisation; getting it wrong breaks billing.

- **`tenants`** — the cloud row carries plan, subscription state, trial dates, `IsMirror` and the
  billing relationship. The on-prem row carries a license key and a local view of the same tenant. A
  blind upsert would let the shop's local copy overwrite the cloud's billing state every night.
- **`subscriptions`, `subscription_invoices`, `billing_settings`, `billing_webhook_events`** — money.
  Owned by the cloud and by the payment providers.
- **`refresh_tokens`** — sessions are per installation and meaningless in the mirror.
- **`notifications`** — raised by whichever side generated them; mirroring would put unactionable
  alerts in front of cloud users.

Implement as an **explicit allow-list of tables to sync**, never a deny-list. A table added by a future
module then defaults to *not synced* and somebody has to think about it, rather than silently flowing
to the cloud and possibly clobbering something.

### 4.3 Soft deletes

Everything in scope uses `AuditableEntity`'s `IsDeleted` rather than hard deletes, so a deletion is an
ordinary column change needing no special handling. The few genuine hard deletes in the codebase are
outside this tenant's module set — and Change Tracking captures them correctly anyway.

---

## 5. Capture — SQL Server Change Tracking

### 5.1 Why Change Tracking rather than an `UpdatedAt` watermark

An `UpdatedAt > lastSync` sweep is the obvious approach and it is **wrong for this codebase
specifically**: several write paths bypass EF entirely with raw SQL and therefore never touch
`UpdatedAt`. Modules 6b and 6c enumerated them, and they are precisely the stock data a retail client
checks first:

- `POS/CrossSchemaProductService.DeductStockAsync` / `RestoreStockAsync` — raw `INSERT` into
  `pos.stock_movements`, `inventory.stock_movements`, `inventory.product_stock`, and raw `UPDATE` of
  `pos.products` / `inventory.products`.
- `Inventory/StockMovementRepository.AdjustPosProductStockAsync` — raw `UPDATE` of `pos.products`.

A watermark sweep would silently miss every one of those. An EF `SaveChanges` interceptor writing to an
outbox has exactly the same blind spot. **Change Tracking sits in the engine and sees all writes,
whatever issued them.**

The second reason is deployment: these boxes run **SQL Server Express**. Change Tracking is supported
on Express; Change Data Capture is not.

### 5.2 Enabling it

```sql
ALTER DATABASE SoftaxisErpDb
  SET CHANGE_TRACKING = ON (CHANGE_RETENTION = 7 DAYS, AUTO_CLEANUP = ON);

-- per table in the allow-list
ALTER TABLE [pos].[pos_transactions]
  ENABLE CHANGE_TRACKING WITH (TRACK_COLUMNS_UPDATED = OFF);
```

`TRACK_COLUMNS_UPDATED = OFF` because the push sends whole rows — column-level detail would be stored
and never read.

**Seven days of retention is a deliberate margin**, not a default. It is the length of outage the
system can absorb before needing a full reseed (§5.4); a week covers a dead router over a holiday
weekend.

Enabling per-table must be **idempotent and automatic on startup**, in the same place migrations run.
Otherwise a table added by a future migration is never tracked and its changes are silently never
synced — a failure that stays invisible until someone notices missing data.

### 5.3 Initial seed

The first sync is **not** a Change Tracking read. It is a full export of every row in the allow-list,
pushed in dependency order, after which the watermark is set to the version captured *before* the
export began:

```sql
DECLARE @v BIGINT = CHANGE_TRACKING_CURRENT_VERSION();   -- capture FIRST
-- ... full export ...
-- persist @v as the starting watermark
```

Capturing the version first means anything written *during* the export is replayed by the next
incremental run. Capturing it afterwards loses those rows. Replay is harmless because the upsert is
idempotent (§6.3).

### 5.4 The retention trap

If the last successful sync is older than `CHANGE_RETENTION`, the stored watermark is no longer valid
and Change Tracking **cannot** tell you what changed. This must be detected, not discovered:

```sql
SELECT CHANGE_TRACKING_MIN_VALID_VERSION(OBJECT_ID('pos.pos_transactions'));
```

If the stored version is below that, the only correct action is a **full reseed of that table**. Set
`ReseedRequired`, alert, and reseed on the next run. Continuing from an invalid version produces a
mirror quietly missing arbitrary rows — the worst possible outcome, because it looks fine.

### 5.5 Reading changes

```sql
SELECT ct.SYS_CHANGE_OPERATION, ct.SYS_CHANGE_VERSION, t.*
FROM   CHANGETABLE(CHANGES [pos].[pos_transactions], @lastVersion) AS ct
LEFT   JOIN [pos].[pos_transactions] AS t ON t.Id = ct.Id
WHERE  ct.SYS_CHANGE_VERSION <= @currentVersion
ORDER  BY ct.SYS_CHANGE_VERSION;
```

`LEFT JOIN` because a hard-deleted row has no current version — the join yields nulls and the operation
is `D`. Bounding on `@currentVersion`, taken once at the start of the run, stops a long run chasing a
moving target and never finishing.

### 5.6 Watermarks

```csharp
public sealed class SyncTableState              // table: identity.sync_table_state
{
    public string    TableName         { get; set; } = "";   // "pos.pos_transactions"
    public long      LastSyncedVersion { get; set; }
    public DateTime? LastSyncedAt      { get; set; }
    public long      PendingEstimate   { get; set; }
}
```

**Per table, not one global watermark.** A single global number means one failing table blocks every
other table's progress, and a partial run cannot be checkpointed at all.

---

## 6. The push protocol

### 6.1 Batch shape

```jsonc
POST /api/sync/push
{
  "tenantId":    "…",
  "licenseKey":  "…",                 // authentication, see §7
  "batchId":     "…",                 // GUID — idempotency key for the whole batch
  "table":       "pos.pos_transactions",
  "fromVersion": 40122,
  "toVersion":   40388,
  "rows": [
    { "op": "U", "id": "…", "data": { /* whole row, column names as in SQL */ } },
    { "op": "D", "id": "…" }
  ]
}
```

- **Whole rows, not deltas.** A delta needs the receiver to already hold the correct prior state; a
  whole row converges even if an earlier batch was lost or applied twice.
- **One table per batch**, so a checkpoint is meaningful and a failure is attributable.
- **500 rows per batch, gzipped.** A retail day is thousands of rows; one giant request is a single
  point of failure with no partial progress.

### 6.2 Ordering

Foreign keys exist on the cloud, so rows must land parents-first. Two mechanisms together:

1. A **static topological order** over the allow-list, applied per run.
2. A **deferred retry queue** within the run: a row failing on a foreign key is set aside and retried
   at the end, because its parent may arrive in a later batch of the same run. Only a row still failing
   after the whole run is reported.

The alternative — dropping FK constraints on the mirror — is tempting and should be **rejected**: those
constraints are the only thing that will catch a sync bug before a user does.

### 6.3 Idempotent upsert

Keyed on the row's own GUID: insert if absent, update if present; for `op: "D"`, delete if present.
Replaying a batch must be a no-op, because it *will* be replayed. `batchId` is recorded in a ledger
with a unique index — `OfflineSyncBatch` (Module 58) is the precedent — so a duplicate batch is
recognised and acknowledged without reapplying, and so the receiver can answer "did you get batch X?"
after a timeout. That timeout case is the one that otherwise causes double application.

### 6.4 Response

```jsonc
{ "batchId": "…", "applied": 500, "deferred": 3, "rejected": 0, "alreadyApplied": false }
```

The on-prem side advances that table's watermark **only** on `rejected == 0` with no deferred rows
outstanding at end of run. Advancing optimistically turns a transient failure into permanently missing
data.

---

## 7. Authentication

**Reuse the license key.** Each box already holds an RSA-signed key containing its tenant id and
expiry, and the cloud already has `ILicenseService.ValidateLicenseKey` to verify the signature. The
push endpoint authenticates the same way: validate the signature, confirm the payload's tenant matches
the batch's `tenantId`, confirm the cloud tenant has `IsMirror = true`.

That avoids inventing a second credential and a second place to rotate it, and it means a box whose
license has expired also stops syncing — which is correct.

Transport is HTTPS with the certificate validated. The endpoint is anonymous to the normal JWT pipeline
(there is no user session behind a nightly job) and must be **exempt from
`SubscriptionEnforcementMiddleware`** — the same exemption `/api/billing/` needed in Module 20, for the
same reason: the endpoint that resolves the situation must not be blocked by the situation.

---

## 8. Cloud-side guards

These are the traps specific to running the same codebase in two places at once. Each of them is
something that works perfectly in a single-deployment world and breaks quietly in this one.

### 8.1 The mirror must refuse writes

Extend `SubscriptionEnforcementMiddleware`: for a tenant with `IsMirror = true`, block every
non-`GET`/`HEAD` request with a distinct code — `MIRROR_READ_ONLY` — and a message that says where to
make the change instead ("this workspace mirrors your in-store system; edits are made in the shop").
The sync endpoint itself is the only exemption.

A code of its own, rather than reusing a subscription block, matters: the frontend can then show a
standing banner and hide create/edit affordances, instead of every button failing with a message about
billing.

### 8.2 Background jobs will double-run — the most likely week-one bug

The gateway runs every hosted service in every deployment. Both copies would therefore act on the same
tenant. The clearest example: **`RecurringInvoiceHostedService` would generate the same tenant's
invoices twice** — once on-prem, once in the cloud — with clashing document numbers, and the cloud's
copies would then be overwritten by the next push, leaving Finance quietly wrong in a way that only
shows up at month end.

**Every background job must skip mirrored tenants.** Today they enumerate workspaces and process each;
the fix is a single filter, but it has to be applied to all of them and to every new one:

| Service | On mirror |
|---|---|
| `RecurringInvoiceHostedService` | **skip** — generation belongs to the shop |
| `TrialLifecycleService` | run (cloud-owned billing, and the mirror tenant is the billed one) |
| `RentAlertBackgroundService` | n/a (module not sold to this client) |
| `ExchangeRateRefreshService` | run — global reference data, not tenant data |
| `RawLeadInboxProcessor` | n/a |
| `SyncPushService` | **on-prem only** |

Write this as a shared helper (`ITenantWorkFilter.ShouldProcess(tenant)`) rather than a repeated
`if`, so the next hosted service inherits the rule instead of rediscovering it.

### 8.3 Document numbering is on-prem only

Invoice, receipt, transaction and payroll numbers are generated locally. The cloud stores what it is
given and never mints its own. This follows from 8.1 and 8.2 together, but is worth stating explicitly
because a numbering collision is discovered by an auditor rather than by a test.

### 8.4 Identity syncs up, and on-prem wins

Login must work with no internet, so users, roles and permission grants live locally and flow upward.
A password changed in the cloud copy would be silently overwritten on the next push — which is another
reason 8.1 is enforced rather than assumed. Practically: user administration happens in the shop.

---

## 9. Scheduling and failure handling

`SyncPushService : BackgroundService`, following the existing pattern exactly — startup delay, a loop,
`try/catch` at both the loop and the per-run level, because a crashing `BackgroundService` tears down
the host and would turn a sync bug into an outage.

**Behaviour:**

- Wakes each minute, compares local wall-clock time in `TimeZoneId` to `RunAtLocalTime`, runs once per
  local day. Cheap, and immune to the drift a fixed-interval timer accumulates.
- **A missed window still runs.** If the box was off at 23:30, sync at next start rather than skipping
  to tomorrow — matching a rung to the exact minute is how a run silently never happens (the lesson
  from the rent-reminder ladder in Module 53).
- Retries with backoff — 5 min, 15 min, 1 h — up to a cap, then waits for the next day's window.
- A manual **"Sync now"** button, because the first thing anyone asks after a failure alert is whether
  it works now.

**Never blocks trading.** The run holds no locks on business tables — Change Tracking reads are
side-effect-free — and failure changes nothing locally beyond the settings row.

---

## 10. Observability

Three surfaces, on-premises:

1. **Status card** — last success, rows pending per table, next scheduled run, last error in full.
2. **Run history** — one row per attempt: started, duration, tables, rows, outcome. The question after
   a bad night is always "when did this start?", which needs history, not a current state.
3. **Alerting** via the existing `IIntegrationHealthAlerter` shape: announce on **first** failure, again
   on escalation, once on recovery — deliberately not every cycle, because a channel that repeats
   itself is one people filter exactly when it next matters.

On the cloud side, the mirror's age should be visible wherever its data is read: a dashboard showing
figures that are three days stale because sync has been failing is worse than one that says so.

---

## 11. Build order

Each phase is independently useful and independently testable. Dev setup is two databases on one box
plus two gateway instances on different ports — the real topology, minus the network.

| Phase | Delivers | Notes |
|---|---|---|
> **All five phases are built.** Each row below is done; the notes record why the order was chosen.
| **1 — Tenancy & guards** | `TenantSyncSettings`, `Tenant.IsMirror`, read-only enforcement (8.1), background-job filter (8.2), adopt-existing-tenant provisioning (3.4) | No sync yet. Ships the protections *before* the thing that needs them, so the mirror can never be written to even during testing |
| **2 — Capture** | Change Tracking enablement (idempotent, on startup), the table allow-list, `SyncTableState`, change reader, `MIN_VALID_VERSION` guard | Verifiable alone: run the reader and confirm it sees raw-SQL stock writes, which is the whole reason for this approach |
| **3 — Transport** | `/api/sync/push`, batch ledger, idempotent upsert, topological order + deferred retry | Test by pushing the same batch twice and asserting the second is a no-op |
| **4 — Scheduling** | `SyncPushService`, initial seed, resumability, backoff, manual trigger | First end-to-end night |
| **5 — Operations** | Settings → Cloud Sync screen (status, schedule, run history, manual run, reseed), `[sync].[run_log]`, `ISyncAlerter` (in-app + email, twice per outage) | The phase that makes it supportable rather than merely working. Alerting is deliberately not per-attempt: the scheduler retries nightly, and a channel that repeats itself is one people filter |

**Phase 1 before Phase 3 is deliberate.** Building the transport first means there is a window in which
the cloud copy is writable and being written to by a half-built sync — and any divergence created then
is invisible and permanent.

---

## 12. What changes if the constraints move

Recorded so the cost is known in advance rather than discovered.

**If the cloud becomes writable (two-way):** this design does not extend — it is replaced. Every entity
needs a conflict policy, every table needs per-row versioning or vector clocks, and the "one writer"
principle that makes §6 simple is gone. The honest estimate is several times this build. If head office
genuinely needs to push data down, the cheap version is a **separate, narrow, cloud-authoritative
channel** for a handful of tables (price lists, product catalogue) that the upward sync explicitly
excludes — never the same rows in both directions.

**If a second store is added:** the sync layer mostly survives — each store pushes its own rows, and the
tenant GUID stays constant. What breaks is everything that assumes one of something: document numbering
would need a per-store prefix, `SyncTableState` becomes per (store, table), and rows need a store
identifier to be reportable separately. `Branch` already exists in Identity and is the right anchor.
Worth knowing: **multi-store is where two-way pressure usually comes from**, because head office starts
wanting to manage products centrally.

**If the requirement is really just backup:** if nobody will actually read the cloud copy, scheduled
database backup upload is a fraction of this work and carries none of the risk. Worth re-confirming
before Phase 2, because it is the single largest scope question here.

---

## 13. Open questions

1. **What is the cloud copy actually used for** — reports, off-site backup, or both? If the owner will
   only ever look at sales totals, the synced table set could shrink dramatically.
2. **Who administers users** — the shop, or Softaxis? §8.4 assumes the shop.
3. **What is the acceptable staleness** if a night fails — one day, three, a week? This sets the
   `CHANGE_RETENTION` margin and the alert escalation thresholds.
4. **Does the box have a static outbound route and a reliable clock?** Nightly scheduling and TLS both
   depend on the second more than people expect.
5. **Backup of the on-premises database itself.** The cloud mirror is *not* a backup — it holds only
   what was pushed, and is read-only. `docs/backup-restore-guide.md` still applies locally, and for a
   system of record that now lives in a shop, it matters more than before.

---

## Appendix — new artefacts at a glance

| Artefact | Side | Kind |
|---|---|---|
| `TenantSyncSettings` | on-prem | entity + migration |
| `SyncTableState` | on-prem | entity + migration |
| `SyncRunLog` | on-prem | entity + migration |
| `Tenant.IsMirror` | cloud | column + migration |
| `SyncBatchLedger` | cloud | entity + migration (unique `BatchId`) |
| `IChangeCaptureService` | on-prem | Change Tracking reader |
| `SyncPushService` | on-prem | `BackgroundService` |
| `SyncPushController` / `SyncReceiveHandler` | cloud | endpoint + CQRS handler |
| `ITenantWorkFilter` | both | shared guard for hosted services |
| Mirror read-only branch | cloud | `SubscriptionEnforcementMiddleware` |
| Adopt-existing-tenant provisioning | on-prem | startup switch or admin endpoint |

No changes to any POS, Inventory or Finance domain entity. That is the point: the sync layer observes
those modules, it does not modify them.
