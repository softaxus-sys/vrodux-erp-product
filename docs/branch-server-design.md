# Branch Server — branches that keep trading when the internet is down

> **Progress and how to resume: see [`branch-server-progress.md`](branch-server-progress.md).**

## Design for a multi-branch chain (restaurant first) that reports to erp.vrodux.com

> **Status: proposal. Nothing in this document is built.** It describes what to add, in phases, and
> what each phase costs. Estimates are rough ranges for one developer who knows this codebase, not
> commitments. Section 12 lists the decisions the owner must make before work starts.

---

## 0. Summary

**Goal.** Every branch talks to the cloud (erp.vrodux.com) for head-office reporting and central
control. When the branch's internet drops, the branch **keeps operating exactly as before** — every
till, tablet, kitchen screen and printer in that branch still works, including with several tills
sharing one set of open bills — and catches up with the cloud afterwards.

**The shape.** Each branch runs a small **branch server**: the same `VroduxERP` Windows Service we
already ship for on-premises customers, on a PC or mini-server in the branch. All devices in the
branch talk to it over the LAN. It syncs with the cloud in both directions, but **each kind of data has
exactly one owner**, so there is nothing to merge:

| Direction | What | Owner |
|---|---|---|
| **Up** (branch → cloud) | Orders, payments, shifts, kitchen tickets, voids/refunds, stock movements, FBR status | The branch |
| **Down** (cloud → branch) | Menu, prices, modifiers, tax settings, users, roles, branches, tables/floors, loyalty config | The cloud (head office) |

**Why this is feasible here.** Most of the pieces exist (section 1). What is missing is two-way sync,
branch-safe numbering, and the rules for things that only the cloud can receive (Foodpanda, QR
ordering).

**Why not the other approach.** Letting every till queue its own actions in its browser (what we have
today) cannot share open bills between tills in a branch. The alternative — a full multi-master database
replication — turns every shared record into a conflict to resolve. Ownership partitioning avoids it.

---

## 1. What already exists and what does not

| Need | Status |
|---|---|
| Self-hosted server that runs with no internet | **Exists** — `Deploy/server`, `VroduxERP` Windows Service, SQL Server Express |
| Offline licence check | **Exists** — RSA-signed key, validated locally (`EvaluateOnPrem`) |
| One-way push of changed rows to a cloud copy | **Exists** — Change Tracking + `SyncPushService` (see `on-premises-cloud-mirror.md`), nightly, single store, **read-only** cloud |
| Idempotent replay of queued actions | **Exists** — client-ref unique indexes (POS offline, restaurant offline sync) |
| Per-till offline queue in the browser | **Exists** — restaurant and retail, per device |
| Branch concept in the data (`BranchId` on orders, shifts, tables, warehouses, menu overrides) | **Exists** — Module 87 (restaurant multi-branch) |
| GUID primary keys | **Exists** — no cross-branch key clashes |
| Down-sync of configuration | **Missing** |
| Continuous (not nightly) sync | **Missing** |
| Several branches pushing into one cloud tenant | **Missing** — the mirror assumes one store, one writer |
| Branch-safe order and receipt numbers | **Missing** — see 5 |
| Cloud-side guard: "this branch's operational data is owned by its branch server" | **Missing** |
| Relay of cloud-only inbound traffic (Foodpanda, QR ordering) to the branch | **Missing** |
| Monitoring: which branches are behind, for how long | **Missing** |

---

## 2. Principles

1. **One writer per row.** Every table in scope is owned either by the branch or by the cloud. A row
   is never edited in both places. This is what removes the conflict problem; everything below
   depends on it.
2. **Sync failure never blocks trading.** A branch with no internet is a branch with a delayed upload.
3. **Idempotent by construction.** Every message can be replayed. The normal failure is a link that
   drops mid-batch.
4. **Convergent.** Progress is checkpointed per batch, so a poor link converges over several attempts.
5. **The branch server is the same software.** No second code base. A branch server is the product in
   "branch mode", so every feature works in a branch the way it works in the cloud.
6. **A silent sync failure is the feature failing.** Alerting and a visible "last synced" are part of
   the build.

---

## 3. Topology

```
 BRANCH (system of record for its own operations)           CLOUD erp.vrodux.com (head office)
┌──────────────────────────────────────────────┐          ┌──────────────────────────────────────┐
│ Tills · tablets · kitchen screens · printers │          │ ApiGateway (multi-tenant)            │
│              │ LAN                           │          │   Tenant X                            │
│              ▼                               │          │     Branch A (Mode = Local)           │
│ Branch server (VroduxERP service)            │  HTTPS   │     Branch B (Mode = Local)           │
│   SQL Server Express                         │ ◀──────▶ │     Branch C (Mode = Cloud)           │
│   Sync agent                                 │          │   Sync endpoints (up / down)          │
│     UP   : pushes owned rows, continuously   │          │   Head-office reports, menu, users    │
│     DOWN : pulls config changes, continuously│          │   Foodpanda / QR-ordering receiver    │
└──────────────────────────────────────────────┘          └──────────────────────────────────────┘
```

Each **branch has a mode**:

- `Cloud` — the branch's devices talk directly to erp.vrodux.com (today's behaviour, plus the
  per-till offline queue as a fallback).
- `Local` — the branch's devices talk to the branch server. The cloud holds a synced copy of that
  branch's operational data and refuses direct operational writes for it (7).

A chain can mix modes, so branches can be moved one at a time.

---

## 4. Ownership map

### 4.1 Owned by the branch (flows up)

Restaurant: orders, order items, modifiers, payments, discounts, voids, refunds, kitchen tickets,
splits, tips, delivery legs created at the branch, offline-sync ledger.
POS: shifts (`pos_sessions`), transactions, cash movements, stock movements for the branch's
warehouse, house-account charges and payments made at the branch.
Compliance: FBR invoice status/numbers for the branch's bills.
Inventory: the branch warehouse's stock quantities and movements (rows keyed by the branch's own warehouse). The catalogue (products, categories, brands, units, warehouses) is cloud-owned; a branch's opening stock is sent down once, insert-only. See CLAUDE.md Module 89 step 3b.

### 4.2 Owned by the cloud (flows down)

Menu, categories, modifier groups, branch price overrides, tax profiles and FBR account, branches,
floors, dining areas and tables, users, roles, permissions, branch assignments, loyalty rules,
payment methods, currencies, receipt/printer settings, the licence.

### 4.3 The awkward ones — decisions needed (section 12)

| Data | Why it is awkward | Proposed rule |
|---|---|---|
| **Customers** | Created at any branch, edited at head office | Cloud-owned. A branch creates a customer as a **pending** record pushed up; the cloud confirms/dedupes and sends the final record back down |
| **Wallet and loyalty balances** | One balance, spent at any branch | **Cloud-owned and online-only.** A branch that is offline refuses wallet, house-account and loyalty payments (as the till does today). Optional later: a per-branch spending allowance |
| **House-account credit limits** | Same shared balance | Same rule as wallet |
| **Stock of a shared item** | Branch warehouses are separate; central purchasing is not | Branch warehouse stock is branch-owned; purchases/transfers are cloud-initiated and arrive down as documents |
| **Table layout** | Edited by head office, used by the branch | Cloud-owned, flows down; live table *status* is branch-owned |

---

## 5. Identity, numbering and time

- **Primary keys** are GUIDs, so rows created at different branches never clash.
- **Order numbers and receipt numbers** are human-visible and must be unique per tenant. Today they
  are produced by one server. Proposal: prefix with a short **branch code** and a per-branch,
  per-business-date counter held on the branch server (`HB2-20261024-0042`), so no coordination is
  needed. Existing cloud-mode branches keep their format.
- **Business date and time zone** are per branch, stored on the branch row. Sync uses UTC instants;
  a bill belongs to the branch's business date.
- **Tenant id** is the same on the branch server and in the cloud (as in the mirror design).
- **Shift ids and "client refs"** are generated on the branch server, so a replay is a no-op.

---

## 6. Sync mechanics

### 6.1 Up (branch → cloud)

Reuse the mirror's capture/push services, extended:

- SQL Server **Change Tracking** on the in-scope tables (already the mirror's mechanism).
- Run **continuously** (every few seconds while connected, bounded batches) instead of nightly.
- The cloud endpoint **upserts by primary key**, in dependency order, and records a per-branch,
  per-table high-water mark. A replay changes nothing.
- The cloud treats these rows as **read-only** (7). They are written only by the sync endpoint.
- Large one-time loads (first connection, re-seed) use the mirror's existing reseed path.

### 6.2 Down (cloud → branch)

- Cloud-owned config tables get a **change feed** (Change Tracking or a version column), filtered to
  the rows relevant to that branch (its branch id, plus tenant-wide rows).
- The branch agent **pulls** (the branch initiates every connection, so no inbound firewall rules and
  no public address are needed at the branch) and applies changes in dependency order inside one
  transaction per batch.
- Config written locally is refused; the branch server runs with a "config is read-only here" guard
  (the same kind of guard the mirror needs on the cloud side).
- Deletions are soft deletes already, so they flow as ordinary changes.

### 6.3 Users and sign-in

The branch server must authenticate staff with no internet:

- Users, password hashes, roles, permission grants/denies, branch assignments and the licence all flow
  **down**. A password change at head office reaches the branch within seconds when online.
- The branch server issues its **own** access tokens, signed with a branch key, carrying the same
  claims the cloud issues. Tokens are never exchanged between the branch and the cloud; only data is.
- Super-admin and tenant-admin actions that change users are done in the cloud, not at the branch.
- Two-factor and lockout counters are branch-local while the branch is offline and reconciled by
  last-writer-wins on those counters only (the one place a merge is accepted, because it is a counter).

### 6.4 Cloud-only inbound traffic

Some things can only reach the cloud, because the internet cannot reach the branch:

| Traffic | Proposal |
|---|---|
| **Foodpanda** orders and cancellations | Cloud receives (public webhook), stores, and queues the order for the branch. The branch agent **pulls** it. Accept/reject/handover calls go from the branch back through the cloud. While a branch is offline it receives nothing new — Foodpanda's own timeout handling applies, so the branch should be shown as unavailable on the platform |
| **QR table ordering / public ordering** | Same: cloud receives, branch pulls. The QR page needs a clear "restaurant is offline" state |
| **FBR reporting** | The **branch server** reports directly (`FbrReporter` already queues and retries). No cloud involvement, so an outage does not delay it beyond the internet link |
| **Payment gateway callbacks** | Cloud-only; offline branches take cash/terminal-card only |

### 6.5 Conflict policy (the exceptions)

Because of ownership there are no row conflicts. The only places where two sides might write the same
thing are the "awkward ones" in 4.3, each with an explicit rule (cloud wins; branch writes are
proposals). Counters use last-writer-wins. Anything else detected writing the wrong side is **rejected
and logged**, never merged.

---

## 7. Cloud-side guard

Add `Branch.ServerMode` (`Cloud` | `Local`).

- When `Local`, the cloud **rejects operational writes** for that branch (new orders, payments, shift
  changes, stock movements) from any user or API. It accepts them **only** through the sync endpoint.
  This is the enforcement that keeps "one writer" true; policy alone will eventually be broken by
  someone fixing a bill at head office.
- Head-office users can still **read** everything and can issue **requests** (for example "void this
  order", "refund this payment") that are sent down to the branch as a pending instruction and applied
  by the branch, so the branch remains the writer.
- Switching a branch's mode is a deliberate, audited action (see cutover, 9).

---

## 8. Branch server operations

- **Install:** the existing server installer in "branch mode": asks for the cloud address, the tenant,
  the branch, and a **branch key** issued from the cloud (one per branch, revocable).
- **First connection:** the agent downloads the full config snapshot, then starts normal sync.
- **Devices:** the desktop client's server address already points to any server; for a `Local` branch
  it points to the branch server's LAN address. No client change is needed for that.
- **Backups:** nightly local backup (documented in `backup-restore-guide.md`) plus the cloud copy
  already acts as an off-site backup of operational data.
- **Monitoring:** a head-office screen listing each branch: last successful up/down sync, queue depth,
  version, licence expiry, and an alert when a branch has been silent for N minutes (reuse the
  health-alert pattern from the integrations work).
- **Upgrades:** the branch server must run a compatible version. The cloud rejects sync from a branch
  too far behind and tells head office; upgrades are done branch by branch.
- **Clock:** the branch server needs a sane clock; sync records and checks drift.

---

## 9. Cutover for an existing customer

1. Install the branch server in the branch alongside the current setup; let it pull the config.
2. Run it in shadow for a day: it syncs up, nobody uses it.
3. At a quiet time: close shifts, wait for the queue to empty, set the branch to `Local`.
4. Point the branch's devices at the branch server. Open fresh shifts.
5. Keep the previous per-till offline mode available as the second fallback.

Rolling back is the reverse and is safe while the cloud copy is complete.

---

## 10. Failure modes

| Failure | Behaviour |
|---|---|
| Branch internet down | Branch trades normally; uploads and config updates wait. Foodpanda/QR orders do not arrive. Wallet, house-account and loyalty payments are refused |
| Link drops mid-upload | Replayed from the checkpoint; no duplicates |
| Branch server PC dies | Branch is down. Mitigation: a spare PC with the latest backup, or switch the branch back to `Cloud` mode and use per-till offline. A real **UPS** and SSD matter here |
| Branch server clock wrong | Drift flagged; sync refused beyond a limit |
| Head office changes price while branch is offline | Applied when the branch reconnects; bills already rung up keep their price |
| Head office user disabled while branch offline | Still able to sign in at the branch until it reconnects (accepted; shorten with a "last seen" expiry per branch if needed) |
| Two branches use the same human-visible number | Prevented by the branch code prefix |
| Cloud outage | Branches are unaffected. They accumulate and catch up |
| Licence expiry | Same offline-licence rules as other on-premises installs |

---

## 11. Phases and rough effort

| Phase | Deliverable | Effort |
|---|---|---|
| **P0 — Spike** | Branch server in branch mode against a test cloud; prove down-sync of config and up-sync of orders for one branch end to end | 1–2 weeks |
| **P1 — Up-sync for restaurant** | Continuous push of restaurant + POS operational tables from several branches into one tenant; cloud upsert, per-branch checkpoints, read-only guard; head-office reports read the synced data | 3–4 weeks |
| **P2 — Down-sync of config** | Change feed for menu, prices, tax, tables, users/roles/permissions, settings; branch applies them; config read-only at the branch | 3–4 weeks |
| **P3 — Identity & licensing** | Branch tokens, offline sign-in, branch key issuance/revocation, branch-mode installer | 2–3 weeks |
| **P4 — Numbering, ownership guard, instructions** | Branch-code numbering, `Branch.ServerMode` and cloud write guard, head-office "instructions" flow (void/refund from head office) | 2–3 weeks |
| **P5 — Cloud-only inbound relay** | Foodpanda and QR-ordering relay to the branch, availability state | 2 weeks |
| **P6 — Operations** | Monitoring screen, alerts, upgrade/compat checks, backup docs, runbook, load/failure testing | 2–3 weeks |

**Total: roughly 15–21 weeks of focused work**, and the figure is dominated by testing the failure cases
(P6 and the cross-phase testing), not by writing the happy path. P0 first, then decide; it settles the
biggest unknowns cheaply.

**Cheaper intermediate step (about 2–3 weeks):** keep the current per-till offline mode, add the
head-office "last synced / queue depth per till" monitoring, and give each branch a 4G backup link and
a UPS. It does not give shared bills between tills offline, but it is what a single-till branch needs.

---

## 12. Decisions (settled 2026-10-24)

Settled by Softaxis following common POS practice (Toast, Square, Lightspeed), at the owner's request.

1. **Several tills per branch — yes, the normal case.** The branch server exists for this: tills share open bills and the
   kitchen screen locally. A single-till branch can stay on head office with the till's own offline queue.
2. **Wallet, house account and loyalty — refused at a branch server.** They are one head-office balance spent at any branch;
   spending a local copy risks double-spending and is overwritten by the next sync. Stored value needs the issuer online in
   Square / Toast offline mode too. **Built:** `BranchServerMode` refuses wallet, house-account and loyalty tenders (restaurant
   and retail), skips earning points, and the till gets a clear message. A future option is an online pass-through to head
   office; a per-branch offline allowance was rejected (complexity, fraud risk).
3. **Customers — created and changed at head office.** Branches pick from the synced list (new ones arrive within a minute
   when online). **Built:** every POS customer command (create, edit, top-up, loyalty adjust, credit limit/terms/hold, house
   payment) is refused on a branch server. A "pending customer" flow (create at the branch, confirm at head office) is a later
   option if branches need to register walk-ins while offline.
4. **Fixing a bill afterwards — head office asks, the branch applies** ("instructions", §7). Built.
5. **Hardware — Softaxis specifies, the customer buys and owns it:** Windows PC with SSD, 8 GB+ RAM, SQL Server Express,
   a UPS, wired network. Softaxis keeps a setup checklist and supports the software; a spare PC or the head-office fallback
   (runbook §6) covers a hardware failure.
6. **Pricing — a paid add-on per branch** (monthly per branch server), on top of the workspace plan.
7. **Scope — restaurants first.** Retail POS tables already sync, but retail branches are supported only after a restaurant
   pilot has run for a month.
8. **Hosting — head office stays at erp.vrodux.com** (or a chain's own head-office server); the branch key is the only
   credential a branch holds, revocable from Settings → Branch Servers. Built.


---

## 13. Not in scope

- Multi-master replication or automatic merging of edited rows.
- Branch-to-branch direct communication.
- Offline operation of cloud-only features (Foodpanda, QR ordering, online payments).
- Moving HR, Finance, CRM and the other modules to branch servers. Only restaurant and POS data are
  covered; other modules stay in the cloud unless a branch needs them offline.
- Replacing the per-till offline queue. It stays as the last fallback.

---

## 14. Risks

- **Volume of tables in scope.** Restaurant plus POS plus inventory touch many tables; the first
  version should cover only what a branch needs to trade, and extend deliberately.
- **Schema drift between branch and cloud.** Both run the same migrations; version checks are essential.
- **Support burden.** A server in every branch is operations work. Monitoring (P6) and the packaging
  decision (12.6) should be settled before selling this.
- **Testing.** The expensive part is simulated outages, clock errors, power loss mid-sync and
  re-seeds. Budget for it explicitly.
