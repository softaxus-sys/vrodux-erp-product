# Branch Server — build progress and how to resume

> **Read this first if you are picking the work up in a new session / with a different Claude account.**
> The design is in [`branch-server-design.md`](branch-server-design.md) (and a printable PDF:
> `Vrodux-ERP-Branch-Server-Design.pdf`, built by `node docs/build-branch-server-pdf.js`).
> This file says what has actually been built, what is verified, what is left, and how to run the tests.
>
> Last updated: 2026-10-24. **Nothing below is committed** — it is all uncommitted work on branch `dev`
> (the owner commits/pushes; never push without asking). See "Uncommitted files" at the end.

## The goal (one paragraph)

A multi-branch restaurant chain (customer: Habibi 2/3/4 + Zeestry, moving from ePosmatic) reports to
`erp.vrodux.com`, and when a branch's internet fails the branch must keep trading with several tills and a
kitchen screen sharing open bills. Solution: a **branch server** (the same Vrodux server software) in each
branch, syncing with the cloud in both directions. **Every table has exactly one owner** (branch or head
office), so there is nothing to merge. Branch-owned data flows UP; head-office-owned data flows DOWN.

## Phase status

| Phase | What | Status |
|---|---|---|
| P0 | Spike: down-sync of config + up-sync of orders, outage and catch-up | **Done, verified** (29 checks) |
| P3 | Identity: users/roles/permissions flow down, offline sign-in, own signing secret | **Done, verified** (26 checks) |
| P4 | Branch-prefixed order numbers + cloud write guard (`ServerMode`) | **Done, verified** (17 checks restaurant + 9 checks POS shifts) |
| P4b | Head-office "instructions" (void/refund a bill that lives on a Local branch) | **Done, verified** (`node instructions.cjs`: 19 of 19). |
| P1 | Production hardening of up-sync (see "Gaps") | Partly done by P0 |
| P5 | Relay of cloud-only traffic (Foodpanda, QR ordering) to the branch | **Done, verified** (`node relay.cjs main` 37/37, `node relay.cjs offline` 3/3). |
| P6 | Monitoring screen, alerts, backoff, keys, installer, runbook, failure testing | **Done, verified** — part 1 (`health.cjs` 22/22) + part 2 (`run-failure.sh` 34/34, browser check of Branch Servers page). See "P6 part 1" and "P6 part 2" at the end. |

Estimate for what is left: roughly 3–5 weeks (leftovers below: column-level ownership, read-only config at the branch, 2FA at a branch, head-office void/refund screen, QR/Foodpanda offline messaging; plus the owner decisions).

## What exists in code

All under `Backend/`.

**Shared sync engine (reused from the on-premises "cloud mirror")** — `src/BuildingBlocks/Softaxis.BuildingBlocks.Infrastructure/Sync/`
- `BranchSyncCatalog.cs` — **the ownership map**: every table in schemas `restaurant`, `pos`, `identity` is classified
  `Branch` (flows up), `Cloud` (flows down) or `NotSynced` with a reason. Also `Redactions` (columns that never leave
  the cloud: 2FA secrets, reset tokens, licence key, connection strings) and `Scopes` (how tables with no `TenantId`
  — `tenants`, `user_roles`, `role_permissions`, … — are limited to one workspace). **A table missing from the
  catalogue fails a test**, on purpose. `MixedOwnership` lists tables with both head-office and branch fields
  (`restaurant.Tables`, `pos.customers`) that still need column-level rules.
- `Branch/BranchSync.cs` — options (`BranchSync` config section), `BranchSyncClient` (HTTP, branch → cloud),
  `BranchSyncStatus`.
- `Branch/BranchSyncEngine.cs` — one pass = push owned tables UP, pull cloud tables DOWN; `BranchSyncWorker`
  background service (every `IntervalSeconds`); `AddBranchSync` / `PrepareBranchSyncAsync` (enables SQL Change
  Tracking on the tables this side reads).
- `Branch/BranchPullFilter.cs` — runs on the cloud on every page served to a branch: workspace scope, other branches'
  rows dropped, redactions applied.

**Cloud endpoint** — `src/ApiGateway/Softaxis.ApiGateway/Sync/BranchSyncController.cs`
`POST api/sync/branch/push`, `GET api/sync/branch/pull`, `GET api/sync/branch/ping`. Auth = headers
`X-Branch-Id` + `X-Branch-Key`, matched against config `BranchSync:Branches[]` (BranchId, TenantId, Key).
Only active when `BranchSync:Mode=Cloud`. Wired in `ApiGateway/Program.cs` (`AddBranchSync`, `PrepareBranchSyncAsync`).

**Config switches** (env vars use `__`): `BranchSync__Mode` = `Cloud` | `Branch` | empty (off).
Branch: `TenantId, BranchId, CloudBaseUrl, BranchKey, IntervalSeconds, StartupDelaySeconds`.
Cloud: `Branches__0__BranchId / TenantId / Key`. **A branch server must have its OWN `Jwt__Secret`**
(different from the cloud's) so a compromised branch PC cannot mint cloud tokens.

**Identity** (`src/Services/Identity`): in Branch mode `MigrateAndSeedAsync` returns right after migrating
(no role/tenant seeding — config arrives by sync). *P4 additions:* `Branch.ServerMode` ("cloud"|"local"),
`SetBranchServerModeCommand` + handler, `PUT api/branches/{id}/server-mode`, migration `AddBranchServerMode`.

**Restaurant** (`src/Services/Restaurant`): *P4 additions:* `Common/OrderNumbering.cs` (branch-code order numbers
`HB2-20261024-0042` via a `restaurant.OrderCounters` table, assigned in `RestaurantDbContext.SaveChangesAsync`),
`Order.HasBranchNumber/SetBranchNumber`, migration `AddOrderCounters`, `Common/LocalBranchGuard.cs`
(cloud refuses writes for a `local` branch), applied in `OrderBranchBehavior`, `CreateOrderHandler`,
`PlacePublicOrderHandler`, `IngestPlatformOrderHandler`; registered in `InfrastructureExtensions`.

**Tests / harness**
- `tests/Softaxis.BuildingBlocks.Tests` — catalogue tests. Run:
  `SYNC_TEST_DB="Server=SHAHBAZ-QFINITY;Database=SoftaxisErpDb;Integrated Security=true;TrustServerCertificate=True" dotnet test tests/Softaxis.BuildingBlocks.Tests`
  (without the env var the live-database check is skipped). **5/5 passed before P4; add `restaurant.OrderCounters` to the
  catalogue as `NotSynced` (see "Next steps" #1) or the live check will fail.**
- `tools/branch-sync-prototype/` — the two-server harness (see below).

## How to run the two-server prototype

Needs: SQL Server `SHAHBAZ-QFINITY` (Windows auth), Node, ports 5301 (cloud) and 5302 (branch) free.
**Never kill by image name** — the owner's own gateway also runs as `Softaxis.ApiGateway.exe`; stop only the process whose
path contains `gwbranch` (PowerShell: `Get-Process Softaxis.ApiGateway | ? { $_.Path -like '*gwbranch*' }`).

1. Publish (avoids file locks from the running dev gateway):
   `dotnet publish Backend/src/ApiGateway/Softaxis.ApiGateway -c Release -o /tmp/gwbranch`
2. `CREATE DATABASE SoftaxisProtoCloud; CREATE DATABASE SoftaxisProtoBranch;`
3. Start the cloud: `bash start-cloud2.sh` (files in `Backend/tools/branch-sync-prototype/`; copy them to `/tmp/proto/`
   — `env.sh` is sourced from there). Wait for `/health` on :5301 (~90 s on first start; migrations run).
4. Copy test data into the CLOUD db: `sqlcmd -S SHAHBAZ-QFINITY -E -i seed-cloud.sql` (copies the tenant `4BE5DD59-EEBC-459F-9A42-B19AF2749F8B`, its branches, roles, role_permissions and the acting admin user `4023E5D8-AD7B-401B-922E-4AD2750BB6B3` from `SoftaxisErpDb`, matching columns by name; audit logs have a FK to the acting user).
   `4BE5DD59-EEBC-459F-9A42-B19AF2749F8B`, its `branches`, `roles`, `role_permissions`, plus the acting admin user
   `4023E5D8-AD7B-401B-922E-4AD2750BB6B3` (audit logs have a FK to the acting user). The branch gets its copy by sync.
5. Start the branch: `bash start-branch2.sh` (:5302). Branch id used: `089A949F-86F7-41F8-BC10-12FC6538DD6E`, key `proto-key-branch1-9f3a`.
6. Scenarios: `node scenario.cjs down|up|price|security|outage|recover` (P0) and `node identity.cjs make-users|check|offline-login|disable|password` (P3).
   For the outage test stop the cloud process (port 5301), run `outage`, restart the cloud, run `recover`.
7. Clean up: stop only the `gwbranch` processes; drop both prototype databases.

The test harness mints JWTs signed with a **test-only** secret (`test-only-multibranch-secret-…`) via `lib.cjs`; no real
credentials are used or needed.

## Verified so far (evidence)

- **P0** (29 checks): menu/floor/tables created at head office reach the branch; another branch's tables are NOT sent;
  a price change arrives incrementally; the branch takes an order + payment and head office receives order, lines and
  payment; with the cloud stopped the branch took 3 more orders, and after restart all 4 arrived with identical counts
  (no duplicates, no gaps); wrong key → 401; a branch cannot write head-office tables / secret tables / another workspace /
  another branch's orders; cannot pull branch-owned or secret tables or unlisted schemas.
- **P3** (26 checks): users, roles, permissions, branches, teams, settings reach the branch; only this workspace's rows
  (a second workspace's users/roles/assignments are not sent); 2FA secrets, reset tokens, licence key and connection
  strings never reach the branch; a cashier signs in at the branch (wrong password refused), token carries the role's
  permissions only; a branch token is refused by the cloud and a cloud token by the branch; disabling a user or changing
  a password at head office takes effect at the branch within seconds; sign-in works with the cloud stopped.

## Next steps (pick up here)

> **Status of item 1:** a–d are DONE and verified with `node p4check.cjs` (branch orders numbered `CODE-date-0001…`,
> same numbers at head office, a second branch counts independently, the cloud returns 409 for creating or changing an
> order on a `local` branch while sync still delivers, switching back to `cloud` re-enables cloud writes, an invalid mode is
> refused). Both migrations applied cleanly on a fresh database. The catalogue test's live-table check fails against
> `SoftaxisErpDb` only until `AddOrderCounters` has run there (it runs when the dev gateway next starts).
> **Item e (POS shift guard) is DONE too**: `POS.Infrastructure/Services/LocalBranchBehavior.cs`, registered in
> `AddPOSInfrastructure`. On the cloud it refuses open/close/suspend shift, cash movement, sale and refund for a `local`
> branch. POS answers HTTP **400** with `errorCode: "Branch.Conflict"` (POS maps error codes differently from Restaurant's
> 409) — verified for open/close/suspend/cash-movement (`node posguard.cjs`, 9/9). **Sale and refund refusals are
> implemented but not exercised** (their validators run first and need real products). **Next: item 2 (P4b).**

1. **Finish P4.**
   a. (done) Add to `BranchSyncCatalog.All`: `new("restaurant.OrderCounters", SyncOwner.NotSynced, "Local order-number counter; never synced.")`.
   b. Build: `dotnet publish Backend/src/ApiGateway/Softaxis.ApiGateway -c Release -o /tmp/gwbranch` and fix compile errors
      (P4 code was written but never compiled — expect small fixes; e.g. `OrderBranchBehavior` was restructured with a
      `Fail(Error)` helper, and `LocalBranchGuard` needs `using` for `Softaxis.Restaurant.Infrastructure.Common` in the
      handlers that use it).
   c. Run the catalogue tests (above).
   d. Test with the harness: (i) orders created at the branch get `CODE-yyyyMMdd-0001, 0002…` numbers and the same number
      appears at head office; two branches don't collide; (ii) `PUT /api/branches/{id}/server-mode {"mode":"local"}` on the
      cloud, then on the **cloud** `POST /api/restaurant/orders` for that branch → 409 `Branch.Conflict`, and changing an
      existing branch order on the cloud → 409, while sync still works (it writes with raw SQL and bypasses handlers);
      with mode `cloud` everything behaves as before. (iii) apply both migrations (`AddOrderCounters` – Restaurant,
      `AddBranchServerMode` – Identity); both auto-apply on startup.
   e. (done) POS shift guard — see the note above.
2. **P4b — instructions** (design §7): head office can read a Local branch's bills and *request* "void/refund this order";
   the request is stored in the cloud, the branch pulls it, applies it itself and reports the result. Needs a new
   table + pull endpoint + a branch-side executor that sends the existing void/refund commands with a system identity.
3. **P5 — relay**: DONE (see "P5 — order relay" at the end).
4. **P6 — hardening / operations**: DONE (see "P6 part 1" and "P6 part 2" at the end).
   **Remaining branch-server work (not part of any phase yet):** live table status + customers flowing up (column-level ownership),
   config read-only at the branch, 2FA sign-in at a branch, a head-office screen for void/refund requests, a "restaurant offline"
   banner on the QR page, marking the branch unavailable on Foodpanda while offline, till labels for "accepting"/"rejecting",
   and moving `BranchPresence` to the database if the cloud ever runs more than one process.
5. **Design decisions (§12): SETTLED 2026-10-24** — see the design doc. Built from them: a branch server refuses wallet,
   house-account and loyalty (no earning either) and every customer command (`BranchServerMode`; `node decisions.cjs` 16/16).
   Restaurants first; branch server is a paid add-on per branch; customer-owned hardware to a Softaxis spec.

## Known gaps / decisions to remember

- **Two-factor accounts cannot finish signing in at a branch** (secret is encrypted with the cloud's key; redacted). Safe, but
  the message is not friendly. Options: head office only for those users, or re-encrypt per branch.
- A user disabled at head office can still sign in at an **offline** branch until it reconnects (accepted; shorten with a "last seen" limit).
- `restaurant.Tables` and `pos.customers` have mixed ownership — classified as cloud-owned; live table status written at the branch
  does not flow up. Needs column-level rules before go-live.
- Rows without a `BranchId` (order lines) are not checked for branch ownership on arrival (they hang off a parent that is).
- Order-number date prefix is UTC (a label only; the counter uses the same date, so no clashes). Switching a branch to Local
  mid-day can repeat a number — switch after closing the day's shifts.
- Customers built the product's `identity` sync with `audit_logs` NOT synced; branch audit entries stay on the branch for now.
- The existing nightly **cloud mirror** (single-store, read-only cloud copy) is separate and unchanged; the branch-server code reuses
  its capture/receive machinery but has its own endpoints and rules.

## Gotchas learned while building

- Bash heredocs with certain characters failed in this environment ("unexpected EOF"); write files with the editor tool instead.
- The dev gateway locks build output; publish to `/tmp/gwbranch` (a different config/output) instead of building in place.
- `SyncTableCatalog` (mirror) vs `BranchSyncCatalog` (branch server) are different lists — don't confuse them.
- Receiving side applies rows with raw SQL (`SyncReceiveStore.ApplyAsync`): idempotent per batch id, defers rows whose parent
  hasn't arrived, rejects unknown columns (schema drift between the two sides).
- The Windows-service/IDE dev gateway runs on :5000 and must be left alone.

## Uncommitted files (all on `dev`)

New: `Backend/src/BuildingBlocks/.../Sync/BranchSyncCatalog.cs`, `.../Sync/Branch/*`,
`Backend/src/ApiGateway/.../Sync/BranchSyncController.cs`, `Backend/tests/Softaxis.BuildingBlocks.Tests/*`,
`Backend/tools/branch-sync-prototype/*`, `Backend/src/Services/Restaurant/.../Common/OrderNumbering.cs`,
`.../Common/LocalBranchGuard.cs`, `.../Migrations/*AddOrderCounters*`,
`Backend/src/Services/Identity/.../Branches/Commands/SetBranchServerMode/*`, `.../Migrations/*AddBranchServerMode*`,
`docs/branch-server-design.md`, `docs/branch-server-design.html`, `docs/build-branch-server-pdf.js`,
`docs/Vrodux-ERP-Branch-Server-Design.pdf`, this file.
Modified: `ApiGateway/Program.cs`, `Softaxis.ERP.slnx`, `Identity/.../Extensions/InfrastructureExtensions.cs`
(branch-mode seeding guard), `Identity/.../Entities/Branch.cs`, `BranchConfiguration.cs`, `BranchesController.cs`,
`Restaurant/.../OrderBranchBehavior.cs`, `CreateOrderHandler.cs`, `PublicOrderingHandlers.cs`, `PlatformHandlers.cs`,
`RestaurantDbContext.cs`, `Order.cs`, `InfrastructureExtensions.cs`, `TenantCurrency.cs` (separate currency-fallback change).

## P4b — head-office instructions (how it works, what was written)

Head office cannot change a Local branch's bill (the cloud refuses), so it **asks**:
- `POST api/restaurant/branch-instructions {branchId, kind: "void_order"|"refund_order", orderId, reason, amount?, method?}`
  on the cloud creates a `restaurant.BranchInstructions` row (cloud-owned, flows DOWN). Needs `restaurant.orders.void` /
  `restaurant.orders.refund`. Refused unless the branch is `local` and the order has already synced up from that branch.
- The branch's `BranchInstructionExecutor` (hosted service, Branch mode only) finds instructions with no result, writes a
  `restaurant.BranchInstructionResults` row (`applying`, branch-owned, flows UP) **first**, then applies the normal
  `VoidOrderCommand` / `RefundOrderCommand` as the requester (`InstructionIdentity`, an AsyncLocal override read by
  `CurrentUserService`), then marks the result `applied` or `rejected` with the reason. A crash mid-way leaves `applying` and
  is never retried automatically (a refund must not run twice).
- `GET api/restaurant/branch-instructions?branchId=&orderId=` lists them with their result (`pending` until the branch picks it up).
- Files: Domain `Entities/BranchInstructions.cs`; Application `BranchInstructions/BranchInstructionContracts.cs`,
  `Abstractions/InstructionIdentity.cs`; Infrastructure `Handlers/BranchInstructions/*` (create, list, executor),
  `Persistence/Configurations/BranchInstructionConfigurations.cs`, migration `AddBranchInstructions`; API
  `Controllers/BranchInstructionsController.cs`, `Middleware/CurrentUserService.cs` (override); catalogue entries added.

### P4b bugs (fixed 2026-10-24)

`node instructions.cjs` (in `Backend/tools/branch-sync-prototype/`, same two-server setup as the other scenarios) result:
14 pass, 5 fail. **Refund instruction works end to end** (applied exactly once, head office sees it). **Void instruction fails** in the
branch executor with `DbUpdateConcurrencyException` ("expected 1 row, affected 0") — the known EF gotcha: a new child row added
through a navigation (`Order.VoidLogs`) must also be added explicitly with `db.OrderVoidLogs.Add(...)`. The existing
`VoidOrderHandler` (`Restaurant.Infrastructure/Handlers/Orders/VoidOrderHandler.cs`, calls `o.VoidWholeOrder(...)`, line ~42) lacks it
(PlatformHandlers has it). Fix: add the explicit `db.OrderVoidLogs.Add(...)` there (check this also fixes normal till voids).
Second bug in `BranchInstructionExecutor`: after a command throws, the SAME DbContext still holds the failed entities, so
`result.Finish(...)`/SaveChanges throws again and the result row stays `applying` forever. Fix: run each command in its own
`IServiceScope` (fresh DbContext, set `TenantAmbient` + `InstructionIdentity` inside it) and do the result bookkeeping on the clean pass context.
**Fixed:** `VoidOrderHandler` now adds the void log explicitly (this also fixes ordinary till voids, which hit the same error), and the executor runs each command in its own scope. `node instructions.cjs`: 19 of 19 pass. Then P5 was built (below).

## P5 — order relay (QR / kiosk and Foodpanda to a Local branch)

Those orders only ever reach the cloud (public ordering page, Foodpanda webhooks), but a Local branch owns its bills.
Same split as P4b: a cloud-owned row flows DOWN, the branch acts, a branch-owned result row flows UP.

- **New tables** (migration `AddOrderRelay`, catalogue entries added):
  `restaurant.RelayedOrders` (cloud → branch; kinds `qr_order`, `platform_order`, `platform_cancel`; JSON `Payload`;
  `ExternalRef` = Foodpanda token), `restaurant.RelayedOrderResults` (branch → cloud; applied/rejected + branch order number),
  `restaurant.PlatformActionRequests` (branch → cloud; accept/reject/handover asked at the till),
  `restaurant.PlatformActionResults` (cloud → branch; done/failed).
- **Ids:** the cloud picks the order id and hands it out at once (to the guest / as Foodpanda's `remoteOrderId`); the branch
  creates the bill with that id (`Order.UseRelayedId`, QR via the AsyncLocal `RelayContext`). Replay is safe: if a bill with
  that id exists the relay is recorded as applied.
- **QR (`PlacePublicOrderHandler`):** for a Local branch the cloud validates items and computes the total, queues the command,
  returns `orderNumber = "Sent to the restaurant"`. The cloud cannot see live table status, so "table occupied" is decided at the
  branch; such an order is recorded `rejected` (visible at head office, the guest is NOT told — there is no guest tracking page).
- **Foodpanda (`IngestPlatformOrderHandler`):** parsed + duplicate-checked on the cloud (synced orders AND queued relays by token).
  Auto-accept is done on the cloud (it holds the credentials) before queuing; the branch builds the bill with
  `PlatformOrderBuilder` (shared with the normal path) from the raw body. Cancellations (`PlatformOrderStatusHandler`) are relayed
  as `platform_cancel`, also when the bill has not reached the cloud yet.
- **Till actions on a branch:** accept/reject record a `PlatformActionRequest` and show `accepting` / `rejecting`;
  `PlatformActionExecutor` (cloud, every 3 s, all tenants) calls Foodpanda and writes the result; `RelayExecutor` (branch) then
  marks accepted + sends to kitchen / voids as rejected, or puts the order back to `new` if Foodpanda refused. Hand-over settles the
  bill at the branch at once and tells Foodpanda through the cloud.
- **Branch offline:** `BranchPresence` (in memory on the cloud, updated on every pull) — a branch silent for
  `BranchSync:RelayOfflineAfterSeconds` (default 120) gets nothing queued: QR guests are told to ask staff, Foodpanda gets 409
  (no acceptance). After a cloud restart branches count as offline until their next pull (seconds). Single cloud process assumed.
- **Pre-existing bug fixed on the way:** `PublicOrderingTenantResolver` set the tenant inside an `async` helper, so the AsyncLocal
  value was lost — QR orders were saved with `TenantId = NULL` and the public menu read ran with no workspace filter (every
  workspace's menu). Split into `FindTableAsync` + synchronous `Enter`. Verified: a normal QR order now carries its workspace.
- **Test:** `fake-foodpanda.cjs` (:5399, sign-in always works, status calls recorded, a token containing "fail" is refused),
  `start-cloud3.sh` (cloud pointed at the fake, 20 s offline window), `start-branch2.sh`, then `node relay.cjs main` (37/37);
  stop the branch and run `node relay.cjs offline` (3/3). Catalogue tests 5/5 against the test cloud DB.
- **Not done:** an "offline" banner on the QR page itself (it shows the API's message), marking the branch unavailable on
  Foodpanda's side while offline, and the till UI's label for the new `accepting` / `rejecting` statuses (shows the raw word).

## P6 part 1 — monitoring and hardening

- **Branch: back-off + quiet logs** (`BranchSyncEngine.RunOnceAsync`, `BranchSyncWorker.NextDelay`). While the cloud is unreachable
  the wait doubles from `IntervalSeconds` up to `BranchSync:MaxBackoffSeconds` (default 120). One warning when it starts failing,
  another only if the reason changes or every 50th failed pass, one info line when it recovers. Verified: ~100 s outage → 1 warning
  (was one every pass); 5 attempts over 3.7 min; "reachable again after 5 failed pass(es)".
- **Branch: heartbeat** — every call carries `X-Branch-Clock` + `X-Branch-Version`; `POST api/sync/branch/heartbeat` every
  `HeartbeatSeconds` (30), every pass while failing: version, clock, last up/down OK, last error, failure count, row totals.
- **Cloud: status store** — `sync.branch_status` (raw SQL, `BranchStatusStore`, created on startup in Cloud mode). Survives
  restarts; also holds `OfflineAlertAt`.
- **Cloud: clock guard** — a push whose `X-Branch-Clock` differs from the cloud by more than `MaxClockDriftSeconds` (900) gets
  409 "clock is off by N minute(s)"; heartbeats are still accepted so the problem is visible. Version differences are shown as a
  warning, not refused (the receiver already rejects unknown columns).
- **Cloud: status API** — `GET api/sync/branches` (`BranchMonitorController`, `settings.branches.view`, own workspace only, 404 when
  not the cloud). One state per branch (`ok | warning | error | offline | never | not_configured`) + a plain sentence
  (`BranchHealth.Describe`), last seen/upload/download, version vs cloud, clock drift, last error, and waiting work (relayed orders
  and instructions not yet answered, online orders the branch refused today).
- **Cloud: alerts** — `BranchHealthAlerter`: a branch silent for `AlertAfterMinutes` (10) → bell + realtime "A branch server is
  offline" to holders of `settings.branches.edit` (module `system`, event `branch-server.offline`); once per outage; "back online"
  when it returns. Never-connected branches are not alerted.
- **Frontend** — Settings → **Branch Servers** (`/settings/branch-servers`, `modules/settings/branch-servers`): a card per branch
  server with state, summary, times, version, clock, waiting work and last error (refreshes every 30 s); the other branches listed
  with "Use its own server"; switching mode asks for confirmation (it is the first UI for `PUT /branches/{id}/server-mode`).
  en + ar strings.
- **🔴 Fixed: branch changes had no permission check.** `BranchesController` (Identity) let any signed-in user of a workspace create,
  edit, delete a branch or switch its server mode. The handlers now require `settings.branches.create|edit|delete` (super admins
  bypass); reads stay open (every branch switcher needs them). The Branches page hides those buttons without the permission.
  Identity's non-generic `HandleResult` now maps `*.Forbidden` → 403 (it returned 400).
- **Test:** `seed-cloud.sql` (now also copies `user_roles`), `start-cloud3.sh` (now `AlertAfterMinutes=1`), `start-branch2.sh`, then
  `node health.cjs status` (15/15); stop the cloud ~2 min and check `branch.log` for the single warning and the recovery line;
  stop the branch → `node health.cjs offline` (4/4); start it → `node health.cjs online` (3/3).
- **Not verified (part 1):** the "only own workspace" check
  ran with a single workspace in the test DB; `BranchPresence` / alerts assume one cloud process.

## P6 part 2 — keys, installer branch mode, runbook, failure testing

- **Branch keys issued from head office** (`BranchKeyStore`, table `sync.branch_keys`, created on startup in Cloud mode). Only a
  SHA-256 hash is stored; the key is shown once. `POST /api/sync/branches/{id}/key` (issue / rotate) and `DELETE …/key` (revoke all),
  both `settings.branches.edit` and own-workspace only. **Rotation without downtime:** a new key leaves the old one working; the first
  time the branch connects with the new key, older keys are revoked automatically. Revoke cuts the branch off at once (auth cache
  cleared). Keys in configuration (`BranchSync:Branches`) still work alongside. Monitoring and alerts include DB-keyed branches.
- **Connection code** — `VBR1.` + base64url of `{u: head-office address, t: workspace, b: branch, k: key}`; the address is
  `BranchSync:PublicBaseUrl` if set, else the request's host. Branch Servers page: Issue key / New key / Revoke, the code shown once
  with copy, key hint + last-used, "old key still valid…" during rotation.
- **Installer branch mode** (`Deploy/installer/VroduxERP.iss`): new "Server type" page (single store / branch of a chain); branch mode
  skips Store, Administrator and Licence (the branch inherits the chain's subscription — the synced tenant is a cloud tenant, so the
  cloud subscription check applies) and asks for the connection code on a "Head office" page. `scripts/check-branch-code.ps1` decodes it
  and pings head office: OK / rejected key / not a head-office server stop or continue clearly; unreachable may continue.
  `configure-appsettings.ps1` writes the `BranchSync` section (Mode=Branch, ids, address, key) and its own JWT secret; a single-store
  reinstall clears branch mode. The wizard compiles (ISCC 6.7.3 on a copy without the payload); both configure paths verified on a copy
  of `appsettings.json`. **The real installer was not run on a PC.**
- **Runbook:** [`branch-server-runbook.md`](branch-server-runbook.md) — install, go-live, the screen's states, common errors, key
  rotation/revocation, dead-PC recovery, upgrades.
- **Failure testing** (`run-failure.sh` → `failure.cjs`, cloud with NO configured keys = `start-cloud4.sh`, branch reads its issued key
  = `start-branch3.sh`) — **34/34 pass**:
  - keys: permission, hash-only storage, installer check (accept / not a code / rejected key / unreachable), sync with an issued
    key, rotation (old key valid until first use of the new one, then refused), revoke cuts off at once;
  - backlog: 3,000 orders taken at the branch with head office down (6 s);
  - power loss: branch killed when head office had 2,500 of 3,000 orders; after restart everything arrived in 14 s — orders and
    lines identical on both sides (count, totals, ids, numbers checksummed), no number used twice;
  - watermark expiry (as after 7+ days offline): up and down re-seed in 3 s, no duplicates, nothing lost.
  - Browser: Branch Servers page signed in with a test token against the test head office — healthy card, New key → code dialog,
    rotation note, Revoke → toast and the branch drops to "using head office directly". No page errors.
- **Harness gotchas:** Node on Windows reads `/tmp` as `C:\tmp` (the shell's `/tmp` is elsewhere) — `run-failure.sh` passes
  `PROTO_DIR`; copy `Deploy/installer/scripts/check-branch-code.ps1` into the test folder too; the order API answers **201**.
  `.claude/launch.json` has `frontend-gateway-5301` for the page check.
