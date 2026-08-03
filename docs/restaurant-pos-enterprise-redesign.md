# Restaurant POS → Enterprise Restaurant Management Platform
## Complete Architecture Redesign (Phases 3–7)

> Companion to the Phase 1/2 analysis delivered in-session (current-state audit + gap analysis vs.
> Toast/Micros/Square/Lightspeed/Revel/Foodics). This document assumes that analysis as read.
> Stack confirmed from the actual codebase: **.NET 10, EF Core (not Dapper), MediatR/CQRS,
> FluentValidation, Serilog, SQL Server, multi-tenant via shadow `TenantId` + global query filter**.
> Frontend: **React + Vite + Tailwind** (not MUI) + `@tanstack/react-query` + Framer Motion.

---

## 0. Executive Summary

The existing `Softaxis.Restaurant` service is a single-branch MVP: 4 anemic entities (`Table`,
`MenuItem`, `Order`, `Reservation`), 5 controllers injecting `RestaurantDbContext` directly (violates
this repo's own mandatory CQRS rule), hardcoded 5% VAT, no shift/cash tie-in, no permissions, no
structured modifiers, no reporting beyond four in-memory "summary" endpoints.

**The key architectural decision driving this whole redesign:** this repo already has a *far* more
mature POS domain sitting one service over (`Softaxis.POS`) — `POSSession`, `CashMovement`,
`TaxRate`, `Voucher`, `Customer`, `PaymentMethodConfig`, `Currency` — all built as proper DDD
aggregates (`AuditableEntity<Guid>`, `Result<T>`, domain events), plus a global `Branch` entity in
Identity and a fully-built HR Attendance/Payroll module. **Rather than re-invent shift management, tax
config, vouchers, customer/loyalty, multi-branch, and clock-in/out inside Restaurant, this design wires
Restaurant into that existing infrastructure.** This is not a nice-to-have — it's the difference between
"two systems that both do cash reconciliation and drift apart" and "one source of truth." Every module
section below states explicitly whether it's **NEW** or **REUSE existing service X**.

Restaurant is also brought up to the same code-quality bar as POS: `Result<T>` return types, domain
events, `AuditableEntity<Guid>`, full CQRS (`Commands/Queries/Dtos` + `Handlers/`), FluentValidation,
and `[RequirePermission]` enforcement (currently **zero** `restaurant.*` permission keys exist at all).

---

## 1. PHASE 3 — Complete Module Design

### 1.1 Restaurant Configuration
**Branches** → **REUSE** `Softaxis.Identity.Domain.Entities.Branch` (already exists: Code, Name, Type,
City, Country, Manager, Currency, Timezone, Status). Every restaurant-schema entity gets a scalar
`Guid? BranchId` (no FK constraint — cross-service reference, same pattern as `Deal.CustomerId` in CRM).
`null` = tenant has a single unbranched location (small-tenant default).

**Floors / Dining Areas / Table Layout Designer** → **NEW**. `Floor` (Id, BranchId, Name, SortOrder) →
`DiningArea` (Id, FloorId, Name, Type: indoor/outdoor/vip/bar/rooftop) → `Table` gets `DiningAreaId`,
`PosX`, `PosY`, `Shape` (round/square/rect), `Rotation`, replacing the current free-text `Section`
column. Frontend: SVG/canvas drag-drop designer (see §4).

**Business Hours** → **NEW** `BusinessHours` (BranchId, DayOfWeek, OpenTime, CloseTime, IsClosed) — used
to gate online-ordering/reservation availability.

**Taxes** → **REUSE** `Softaxis.POS.Domain.Entities.TaxRate` (already supports name/code/rate/appliesTo/
isDefault). `Order` gets `TaxRateId` (nullable — falls back to the branch's default rate) replacing the
hardcoded `SubTotal * 0.05m`.

**Service Charges** → **NEW** `ServiceCharge` (BranchId, Name, Type: percentage/fixed, Value, AppliesTo:
dine_in/takeaway/delivery/all, IsActive). `Order.ServiceChargeAmount` computed from the applicable rule.

**Currencies / Payment Methods** → **REUSE** `Softaxis.POS.Domain.Entities.Currency` /
`PaymentMethodConfig` (already exist — cash/card/wallet/split config).

**Printer Configuration / Kitchen Printers / Receipt Templates** → **NEW** (genuinely missing
everywhere in this repo): `PrinterProfile` (BranchId, Name, Type: receipt/kitchen, ConnectionType:
network/usb/bluetooth, IpAddress, Port, IsDefault), `KitchenStation` (BranchId, Name e.g. "Grill"/"Bar"/
"Dessert", PrinterProfileId), `ReceiptTemplate` (BranchId, Name, HeaderText, FooterText, ShowLogo,
ShowTaxBreakdown, IsDefault). `MenuItem`/`MenuCategory` get `KitchenStationId` to route tickets.

**Kitchen Display Settings** → **NEW**, folded into `KitchenStation` (DisplayName, ColorTag, SortOrder).

**Fiscal Settings** → **REUSE** Finance's `FiscalPeriodsController` (close/reopen periods) — Restaurant
doesn't need its own fiscal calendar; end-of-day just needs to respect the Finance period lock.

**Delivery Zones** → **NEW** `DeliveryZone` (BranchId, Name, PostalCodesJson/PolygonJson, DeliveryFee,
MinOrderAmount, EstimatedMinutes, IsActive).

**Reservation Rules** → **NEW** `ReservationRule` (BranchId, SlotDurationMinutes, MaxCoversPerSlot,
MaxAdvanceDays, MinNoticeMinutes, AutoNoShowMinutes, DepositRequired, DepositAmount).

### 1.2 POS — Fast Billing & Order Taking
- **Split Bills** — **NEW**: split-by-seat/item, not just split-tender-by-method (which already exists
  via `Order.AddPayment`). Add `Order.ParentOrderId` (self-FK) — "split into N sub-bills" clones items
  across N child orders, each independently payable; parent stays a wrapper for the table view.
- **Merge Tables / Transfer Tables / Transfer Orders** — **NEW**: `Table.MergedIntoTableId` (self-FK,
  nullable) for merges; `TableTransferLog` (OrderId, FromTableId, ToTableId, TransferredByUserId,
  CreatedAt) for audit. New endpoints `POST /tables/{id}/merge`, `POST /orders/{id}/transfer-table`.
- **Hold / Recall Orders** — reuse `Order.Status` (`held` is a new value, not a new table); recall =
  `GET /orders?status=held`.
- **Quick Order / Quick Search / Barcode Support** — frontend-only (menu-item search + barcode via the
  existing shared `useHardware()` scanner hook already used in retail POS).
- **Kitchen Tickets** — exists (`KitchenController.GetTickets`), extended with course/station routing.
- **Modifiers** — **NEW** structured model replacing the free-text `OrderItem.Modifiers` string:
  `ModifierGroup` (Name, MinSelect, MaxSelect, IsRequired) → `Modifier` (GroupId, Name, PriceDelta) →
  `MenuItemModifierGroup` (join). `OrderItem` gains `OrderItemModifier` child rows (selected modifiers +
  price delta at time of order — price snapshot, never re-read from the live modifier).
- **Combos / Meal Deals** — **NEW** `Combo` (Name, Price, IsActive) + `ComboItem` (ComboId, MenuItemId
  or CategoryId-for-choose-one, Quantity). Ordering a combo creates one `OrderItem` per component, all
  tagged with a shared `ComboOrderItemId` so KDS can group them and receipts show them as one line.
- **Course Management** — **NEW**: `OrderItem.CourseNumber` (int) + `Order.CurrentCourse`. "Fire next
  course" endpoint bumps `CurrentCourse` and releases held items to the kitchen queue.
- **Happy Hour Pricing** — **NEW** `HappyHourRule` (BranchId, Name, DaysOfWeekMask, StartTime, EndTime,
  DiscountType, DiscountValue, CategoryId?). Applied at order-creation time as a computed line discount
  (not a permanent price change) — auditable and reversible if the order changes after the window closes.
- **Open Price Items** — **NEW**: `MenuItem.AllowOpenPrice` (bool); order line captures the entered price.
- **Discounts** — **REPLACE** the current flat `Order.DiscountAmount` field with an itemized
  `OrderDiscount` table (OrderId, Type: flat/percentage/voucher, Amount, Reason, ApprovedByUserId?,
  CreatedAt). `Order.DiscountAmount` becomes a computed sum — auditable, reason-required, PIN-approval-
  gated above a configurable threshold (see §1.14 Security).
- **Coupons / Gift Cards / Promotions** — **REUSE** `Softaxis.POS.Domain.Entities.Voucher` (already a
  full coupon/gift-card engine: code, percentage/fixed, min-spend, usage limits, validity window).
  `Order` gets `VoucherId`/`VoucherCode`. No new entity needed.
- **Tips** — **NEW** `Order.TipAmount` + `TipAllocation` (SessionId, UserId, Amount, Method:
  individual/pooled) for end-of-shift tip distribution.
- **Service Charge** — see §1.1.
- **Order Notes / Customer Notes** — `Order.Notes` exists; add `Customer.Notes` (already exists on POS
  `Customer` — reuse).
- **Void Items / Void Bills** — **REPLACE** the silent soft-delete with `OrderVoidLog` (OrderItemId or
  OrderId, Reason, VoidedByUserId, ApprovedByUserId?, CreatedAt) — reason is mandatory; approval required
  if the voiding user lacks `restaurant.orders.void` (manager PIN flow, §1.14).
- **Refunds / Returns** — **NEW**: `OrderRefund` (OrderId, Amount, Reason, Method, ApprovedByUserId,
  CreatedAt) — mirrors `OrderPayment` but negative-direction, fully audited.
- **Reprints / Duplicate Bills** — frontend-only (re-render the existing receipt template; log to
  `DigitalReceiptLog` for audit of who reprinted and when).
- **Bill Preview / Receipt Preview** — frontend-only, using `ReceiptTemplate`.
- **Digital Receipt / Email / WhatsApp Receipt** — **NEW** `DigitalReceiptLog` (OrderId, Channel:
  email/sms/whatsapp, RecipientAddress, SentAt, Status) + reuse Identity's existing `IEmailService`
  (Modules 5l/17) for email, and a new lightweight WhatsApp provider (mirrors the CRM Module 7 plug-in
  provider pattern — one class, one DI line).

### 1.3 Table Management
Visual Floor Designer, drag-drop, statuses (Occupied/Reserved/Cleaning/Available), merged tables, table
timers, guest count — covered in §1.1/§1.2 above (`Floor`/`DiningArea`/`Table.PosX/PosY`,
`MergedIntoTableId`). **New**, not yet covered:
- **Waiting Queue / Walk-ins** — `WaitlistEntry` (BranchId, GuestName, GuestPhone, PartySize,
  QuotedWaitMinutes, Status: waiting/seated/no_show/cancelled, ArrivedAt, SeatedAt, TableId?).
- **Reservations: Expected Arrival / No-Shows** — extend existing `Reservation` with
  `ArrivalWindowStart/End`, `NoShowAt`; a background job auto-flags `no_show` past
  `ReservationRule.AutoNoShowMinutes`.
- **Table Timers** — computed client-side from `Table.OccupiedSince` (already exists) — no backend change.
- **Seat Transfer** — covered by the modifier/split-bill model (a seat's items move between order
  splits); no separate entity needed beyond `Order.ParentOrderId`.

### 1.4 Kitchen Management
KDS, kitchen printers, prep queue, priority, cooking/ready/pickup status, course firing, chef notes,
performance, prep time, dashboard — mostly **extensions of existing entities**:
- `OrderItem` gains: `CourseNumber`, `KitchenStationId`, `Priority` (bool "rush"), `ChefNotes`,
  `PrepStartedAt`, `PrepCompletedAt` (drives prep-time analytics — no separate log table needed).
- **Kitchen Performance / Prep Time / Dashboard** → **reporting views**, not new tables (see §2.5):
  `vw_KitchenPrepTimes` computed from `PrepStartedAt`/`PrepCompletedAt`/`CreatedAt`.
- Realtime push: current implementation likely polls via React Query. **Recommend SignalR hub**
  (`RestaurantHub`) for KDS/table-board pushes — polling doesn't scale past a handful of concurrent
  screens and adds latency the kitchen actually feels.

### 1.5 Shift Management — **REUSE `Softaxis.POS` almost entirely**
Do **not** build a parallel shift/cash system. `Order` gains `SessionId` (FK to `POS.POSSession.Id`,
cross-schema scalar) and `CashierId`. Every restaurant payment calls the existing
`POSSession.RecordTransaction(amount, isRefund)` domain method so cash-in-drawer, expected-cash, and
variance are correct across **both** retail and restaurant sales from one shift. Cash Float, Cash
In/Out, Paid Outs, Petty Cash, Safe Drop, Cash Declaration, Variance, Drawer Count, Multiple Drawers,
Multiple Cashiers — **all already implemented** in `POSSession`/`CashMovement`. Restaurant's only new
work: (a) the FK wiring, (b) a "which session is this register/waiter attached to" lookup, (c) blocking
order payment if no open session exists for the branch/register.

### 1.6 Employee Management
- **Clock In/Out, Attendance, Break Time** → **REUSE** the existing, fully-built HR
  `AttendanceController` (full CRUD, confirmed in this repo's HR module) — do not build a second
  attendance table. Add a thin "Clock In/Out" quick-action in the restaurant UI that calls
  `POST /hr/attendance` scoped to the current user.
- **Roles / Permissions** → **REUSE** the tenant-wide RBAC (`Permission`/`Role`/`RolePermission` +
  `[RequirePermission]`) already used by Finance/HR/Inventory/CRM/Sales/Purchase — extend with new
  `restaurant.*` keys (§1.14).
- **Sales by Employee / Cashier Performance** → reporting view over `Order.WaiterUserId`/`CashierId`.
- **Tips / Commission** → `TipAllocation` (§1.2); commission = a Finance/HR follow-up (payroll already
  supports arbitrary allowances — a "commission" line item on the existing payroll slip covers this
  without new Restaurant-side entities).
- **Audit Logs** → reuse Identity's existing generic audit log (`AuditController`/audit table) — wire
  restaurant void/discount/refund/table-transfer actions to write there, same as other modules.
- `Order.Waiter` (free string) → **replaced** with `WaiterUserId` (Guid, FK Identity user, scalar) +
  denormalized `WaiterName` (same "copy the name, don't call cross-service on every read" pattern used
  throughout this codebase, e.g. `Deal.CompanyName`/`Project.LeadName`).

### 1.7 Customers — **REUSE + extend `Softaxis.POS.Domain.Entities.Customer`**
`Customer` already has `LoyaltyPoints`, `TotalPurchases`, `AddLoyaltyPoints`/`RedeemLoyaltyPoints`.
`Order` gets `CustomerId` (currently absent — this is the actual gap, not "no loyalty system exists").
**New, genuinely missing:**
- **Membership tiers** — `Customer.MembershipTier` (string: bronze/silver/gold, or a `MembershipTier`
  lookup table if tenants need custom tiers/perks).
- **Customer Wallet / Store Credit** — `CustomerWalletTransaction` (CustomerId, Type: topup/redeem/
  refund, Amount, OrderId?, CreatedAt); `Customer.WalletBalance` computed or cached.
- **House Accounts / Customer Credit** — `Customer.CreditLimit` + `Customer.CreditBalance`; `Order` can
  be paid via `PaymentMethod = "house_account"`, decrementing available credit — billed at month-end
  (reuse Finance's existing invoicing to generate the statement, don't build a second billing engine).
- **Birthday Offers** — `Customer.DateOfBirth` (currently absent) + a scheduled job that generates a
  `Voucher` (reuse!) targeted at that customer around their birthday.
- **Favourite Orders** — `FavoriteOrder` (CustomerId, Name, ItemsJson) — "reorder my usual" one-tap.

### 1.8 Delivery — **NEW**
- `DeliveryOrder` (OrderId, DeliveryZoneId, DriverId?, Status: assigned/picked_up/enroute/delivered/
  failed, Address, Phone, EstimatedDeliveryAt, DeliveredAt, DeliveryFee, ThirdPartyProvider?,
  ThirdPartyOrderRef?).
- `Driver` — thin profile (BranchId, LinkedUserId?, Name, Phone, VehicleInfo, IsActive); a driver is
  just a restricted-role Identity user, not a parallel identity system.
- **Delivery Tracking / ETA** — status transitions + `EstimatedDeliveryAt`; a public tracking link
  (`GET /delivery/{token}`) for the customer, no auth (mirrors the Careers/webhooks anonymous-endpoint
  pattern already in this codebase — tenant resolved from an unguessable token, not a session).
- **Third-Party Delivery** (Talabat/Careem/Deliveroo/Uber Eats) — plug-in provider model, **same pattern
  as CRM's Module 7 lead-integration framework**: one `IDeliveryProvider` interface, one class + one DI
  line per platform, orders land in the same `DeliveryOrder` table regardless of source.
- **Drive Through** — just another `Order.OrderType` value; no new entity.

### 1.9 Online Ordering — **NEW, thin layer over existing Menu**
- **Digital Menu / Website / Mobile App / QR / Kiosk** all read the **same** `MenuCategory`/`MenuItem`
  data — add `MenuItem.IsOnlineOrderable` (bool) rather than maintaining a second menu.
- **Table QR Ordering** — `Table.QrCode` (unique token) + `TableOrderingSession` (TableId, StartedAt,
  GuestDeviceToken) — a guest scans, opens a public menu scoped to that table, and orders land as a
  normal dine-in `Order` with `OrderChannel = "qr_table"`.
- **Self-Ordering Kiosk** — same public-order API, `OrderChannel = "kiosk"`, plus a manager-approval or
  auto-send-to-kitchen toggle per branch.
- All of these funnel through **one** new anonymous endpoint `POST /api/restaurant/public-orders`
  (tenant resolved from the QR/kiosk token, mirrors the webhook pattern) — not four separate order paths.

### 1.10 Inventory — **REUSE `Softaxis.Recipe` + `Softaxis.Inventory`, don't rebuild**
This repo already has a dedicated `Softaxis.Recipe` service (ingredients/recipes) and a full
`Softaxis.Inventory` service (stock, transfers, valuation, low-stock alerts) — currently **unconnected**
to Restaurant. The fix is integration, not new inventory tables:
- `MenuItem.RecipeId` (nullable, scalar FK to `Softaxis.Recipe`'s `Recipe` entity).
- When an `OrderItem` is marked `served`, call the existing Inventory `POST /stock-movements` API
  (write-off type) for each recipe ingredient × quantity — **reuse** the stock-movement endpoint that
  already exists rather than building a second stock ledger.
- **Food Cost / Recipe Cost** — computed from the Recipe service's ingredient costs (already tracked
  there) joined against sales — a reporting view, not new storage.
- **Low Stock / Expiry Alerts** — already exist in Inventory; Restaurant just needs to read
  `IsLowStock` and auto-flip `MenuItem.IsAvailable = false` when a linked ingredient hits zero (event
  handler subscribing to Inventory's stock-movement events, or a polling reconciliation job if
  cross-service eventing isn't wired yet — flag for confirmation during Phase-3 implementation).
- **Waste / Spoilage / Production / Stock Transfer / Purchase Orders / Suppliers / Vendor Payments** —
  all **already exist** in Inventory/Purchase services; nothing restaurant-specific to add beyond the
  `MenuItem.RecipeId` link above.

### 1.11 Finance — **REUSE `Softaxis.Finance`, add a reporting bridge**
- **Cashbook / Petty Cash / Bank Deposit** — reuse Finance's existing Expenses/Banking modules; a
  restaurant safe-drop just posts a `CashMovement` (already covered §1.5) which end-of-day reconciliation
  reads.
- **End of Day / Z-Report / X-Report** — **NEW reporting endpoint**, computed (not stored) from
  `POSSession` + `Order` + `CashMovement` for the branch/date: Z = session closed, X = mid-shift snapshot.
- **Sales Summary / Tax Summary / Payment Reconciliation** — reporting views (§2.5), sourced from
  `Order`/`OrderPayment`/`TaxRate`.
- Optional: push a summarized daily journal entry into Finance's existing `JournalEntriesController`
  (reuse — don't build a parallel GL).

### 1.12 Reporting — **all new, mostly SQL views over existing + new tables**
Sales, Cash, Shift, Hourly Sales, Peak Hours, Top/Worst Selling Items, Category Sales, Profit, Kitchen,
Employee, Inventory, Waste, Tax, Discount, Void, Refund, Customer, Loyalty reports — see §2.5 for the
concrete view list. **None of these need new base tables** beyond what's specified above; they're
aggregations of `Order`/`OrderItem`/`OrderDiscount`/`OrderVoidLog`/`OrderRefund`/`POSSession`.

### 1.13 Dashboards
Owner / Branch / Kitchen / Cashier / Inventory dashboards — **new endpoints only**, each a thin
aggregation over the reporting views in §2.5, scoped by `BranchId` + role. No new storage.

### 1.14 Security
- **New permission module `restaurant.*`** in `PermissionSeedData.cs` (currently absent entirely):
  `restaurant.tables`, `restaurant.menu`, `restaurant.orders` (+ `.void`, `.discount`, `.refund` as
  extra action keys beyond the standard view/create/edit/delete), `restaurant.kitchen`,
  `restaurant.reservations`, `restaurant.config`, `restaurant.reports`, `restaurant.delivery`.
- **`[RequirePermission]`** applied to every controller (copy the shared attribute pattern already used
  in Finance/HR/Inventory/CRM/Sales/Purchase/ProjectManagement — Restaurant is the one service that
  never got this).
- **Manager Override / PIN Authorization** — **NEW**: add a hashed `Pin` field to the Identity `User`
  entity (mirrors the `TwoFactorSecret` pattern from Module 14) + `POST /api/auth/verify-pin`
  (validates a PIN belongs to *some* user holding a given permission, without a full login). Used by
  void/discount/refund flows above a configurable threshold.
- **Audit Logs** — reuse Identity's generic audit log (see §1.6).
- **Device Registration / Offline Sync** — `DeviceRegistration` (BranchId, DeviceFingerprint,
  RegisteredByUserId, LastSeenAt, IsActive) — a trust anchor for offline queueing (see below); this is
  new infrastructure, scoped to Phase 5 of the roadmap (§5) since it's the highest-risk/most-novel piece.
- **Encryption** — no new requirement beyond what's already standard (TLS, hashed secrets) — flag if
  PCI scope requires tokenized card storage; recommend never storing card PANs (use the payment
  gateway's tokenization, not a local field) when the Payment Gateway integration (§1.17) is built.
- **Fraud / Suspicious Activity Detection** — start simple: a reporting view flagging outlier patterns
  (excessive voids/discounts per cashier per shift) rather than a real-time ML detector — matches this
  codebase's "computed from existing data" approach used elsewhere (e.g. CRM lead scoring).

### 1.15 Multi-Branch — **REUSE Identity's `Branch` + `TenantRoleProvisioner` pattern**
- Central Office = tenant-admin scope (existing pattern: `TenantAmbient` + role scoping already used
  tenant-wide). No new "central office" entity — it's just cross-branch reporting for users holding a
  tenant-wide (not branch-restricted) role.
- **Branch-scoped roles** — extend `TenantRoleProvisioner` (already provisions one role per enabled
  module per tenant, Module 6a) with an optional `BranchId` scope on `Role`/assignment, OR — simpler and
  more consistent with how the rest of this codebase does row-level scoping — add a `UserBranch` join
  (mirrors `ProjectMember` from Module 5g) so a user's queries filter to their assigned branch(es)
  unless they hold a tenant-wide permission. **Recommend the `UserBranch` join** — it's the exact
  pattern this repo already validated for ProjectManagement (Module 5g) and doesn't touch the Identity
  Role model.
- **Central Purchasing / Inter-Branch Transfer** — already exist in `Softaxis.Purchase`/`Softaxis.Inventory`
  (`StockTransfersController`); just needs `BranchId` plumbed through, no new entities.
- **Central Reporting** — the same reporting views (§2.5), unfiltered by `BranchId` for tenant-wide roles.

### 1.16 Hardware
- **Receipt/Kitchen Printers, Cash Drawer** — `PrinterProfile` (§1.1) is the config; actual printing/
  drawer-open already goes through the existing shared `useHardware()` frontend hook (confirmed in
  `restaurant-pos-view.tsx`: `openDrawer`, `printRaw`, `printerStatus`) — **reuse**, extend it to accept
  a `PrinterProfile`/station target instead of a single implicit printer.
- **Barcode/QR Scanner, Customer Display, Weight Scale, Card Terminal, Touch Screen, KDS** — all
  frontend/hardware-integration concerns layered on the same hook; no new backend entities beyond
  `PrinterProfile`/`KitchenStation` above.

### 1.17 Integrations
- **Payment Gateway** — new, tenant-configurable (extend `PaymentMethodConfig`, already exists, with
  gateway credentials — encrypted at rest via the existing `ISecretProtector`/Data-Protection pattern
  from CRM's Module 7/11, don't invent a second encryption mechanism).
- **SMS / Email / WhatsApp** — reuse Identity's `IEmailService` for email; new lightweight SMS/WhatsApp
  providers following the exact plug-in model from CRM Module 7 (`ILeadProvider`-style interface).
- **Accounting / ERP** — already the same platform (Finance service) — reuse, no integration needed.
- **Delivery Platforms** — plug-in provider model, §1.8.
- **Loyalty** — internal (§1.7); external loyalty network integration is a Phase-5 (enterprise) item, not
  Phase-1.

---

## 2. PHASE 4 — Database Design

### 2.1 Modify existing tables (schema `restaurant`)

| Table | New / changed columns |
|---|---|
| `Tables` | `BranchId Guid?`, `DiningAreaId Guid?` (replaces `Section` string), `PosX float`, `PosY float`, `Shape nvarchar(20)`, `Rotation int DEFAULT 0`, `MergedIntoTableId Guid?` (self-FK, nullable), `QrCode nvarchar(64)` (unique, nullable) |
| `Orders` | `BranchId Guid?`, `SessionId Guid?` (→ `pos.POSSessions.Id`), `CashierId Guid?`, `CustomerId Guid?` (→ `pos.Customers.Id`), `TaxRateId Guid?` (→ `pos.TaxRates.Id`), `TipAmount decimal(18,2) DEFAULT 0`, `ServiceChargeAmount decimal(18,2) DEFAULT 0`, `VoucherId Guid?`, `VoucherCode nvarchar(30)`, `ParentOrderId Guid?` (self-FK, split bills), `OrderChannel nvarchar(20) DEFAULT 'dine_in'` (dine_in/takeaway/delivery/online/kiosk/qr_table), `WaiterUserId Guid?` (replaces free-text reliance; `Waiter` column kept as denormalized display name), `CurrentCourse int DEFAULT 1`, `RowVersion rowversion` (optimistic concurrency — fixes the raw-SQL workaround documented in Phase 1) |
| `OrderItems` | `CourseNumber int DEFAULT 1`, `KitchenStationId Guid?`, `Priority bit DEFAULT 0`, `ChefNotes nvarchar(500)`, `PrepStartedAt datetime2`, `PrepCompletedAt datetime2`, `ComboOrderItemId Guid?` (groups combo components), `IsVoided bit DEFAULT 0` (distinct from `IsDeleted` — a void is a business event, a delete is data hygiene) |
| `Reservations` | `BranchId Guid?`, `ArrivalWindowStart datetime2`, `ArrivalWindowEnd datetime2`, `NoShowAt datetime2`, `DepositAmount decimal(18,2)`, `DepositPaid bit DEFAULT 0` |
| `MenuItems` | `RecipeId Guid?` (→ Recipe service), `KitchenStationId Guid?`, `AllowOpenPrice bit DEFAULT 0`, `IsOnlineOrderable bit DEFAULT 1` |
| `MenuCategories` | `KitchenStationId Guid?` (default station for items in this category, overridable per-item) |

### 2.2 New tables (schema `restaurant`, all get the standard shadow `TenantId` + `IsDeleted` +
`CreatedAt`/`UpdatedAt` via `TenantIsolation`/`AuditableEntity<Guid>` conventions already used repo-wide)

| Table | Key columns | Notes |
|---|---|---|
| `Floors` | BranchId, Name, SortOrder | |
| `DiningAreas` | FloorId, Name, Type | |
| `BusinessHours` | BranchId, DayOfWeek, OpenTime, CloseTime, IsClosed | |
| `ServiceCharges` | BranchId, Name, Type, Value, AppliesTo, IsActive | |
| `PrinterProfiles` | BranchId, Name, Type, ConnectionType, IpAddress, Port, IsDefault, IsActive | |
| `KitchenStations` | BranchId, Name, PrinterProfileId, ColorTag, SortOrder, IsActive | |
| `ReceiptTemplates` | BranchId, Name, HeaderText, FooterText, ShowLogo, ShowTaxBreakdown, IsDefault | |
| `ReservationRules` | BranchId, SlotDurationMinutes, MaxCoversPerSlot, MaxAdvanceDays, MinNoticeMinutes, AutoNoShowMinutes, DepositRequired, DepositAmount | |
| `DeliveryZones` | BranchId, Name, PostalCodesJson, DeliveryFee, MinOrderAmount, EstimatedMinutes, IsActive | |
| `ModifierGroups` | Name, MinSelect, MaxSelect, IsRequired | |
| `Modifiers` | GroupId (FK), Name, PriceDelta | |
| `MenuItemModifierGroups` | MenuItemId, ModifierGroupId | join table |
| `OrderItemModifiers` | OrderItemId, ModifierId, Name (snapshot), PriceDelta (snapshot) | price/name snapshotted at order time |
| `Combos` | Name, Price, IsActive | |
| `ComboItems` | ComboId, MenuItemId?, CategoryId? (choose-one), Quantity | |
| `HappyHourRules` | BranchId, Name, DaysOfWeekMask, StartTime, EndTime, DiscountType, DiscountValue, CategoryId? | |
| `OrderDiscounts` | OrderId, Type, Amount, Reason, ApprovedByUserId?, CreatedAt | replaces flat `Order.DiscountAmount` |
| `OrderVoidLogs` | OrderItemId?, OrderId, Reason, VoidedByUserId, ApprovedByUserId?, CreatedAt | |
| `OrderRefunds` | OrderId, Amount, Reason, Method, ApprovedByUserId, CreatedAt | |
| `DigitalReceiptLogs` | OrderId, Channel, RecipientAddress, SentAt, Status | |
| `TableTransferLogs` | OrderId, FromTableId, ToTableId, TransferredByUserId, CreatedAt | |
| `WaitlistEntries` | BranchId, GuestName, GuestPhone, PartySize, QuotedWaitMinutes, Status, ArrivedAt, SeatedAt, TableId? | |
| `TableOrderingSessions` | TableId, QrCode (unique), StartedAt, GuestDeviceToken, EndedAt | for QR self-order |
| `TipAllocations` | SessionId, UserId, Amount, Method | |
| `FavoriteOrders` | CustomerId, Name, ItemsJson | (`CustomerId` → `pos.Customers.Id`) |
| `CustomerWalletTransactions` | CustomerId, Type, Amount, OrderId?, CreatedAt | (`CustomerId` → `pos.Customers.Id`) |
| `DeliveryOrders` | OrderId, DeliveryZoneId, DriverId?, Status, Address, Phone, EstimatedDeliveryAt, DeliveredAt, DeliveryFee, ThirdPartyProvider?, ThirdPartyOrderRef? | |
| `Drivers` | BranchId, LinkedUserId?, Name, Phone, VehicleInfo, IsActive | |
| `UserBranches` | UserId, BranchId, Role (owner/manager/staff) | mirrors `ProjectMember` (Module 5g) |
| `DeviceRegistrations` | BranchId, DeviceFingerprint, DeviceName, RegisteredByUserId, LastSeenAt, IsActive | |

Cross-service references (`pos.Customers.Id`, `pos.TaxRates.Id`, `pos.Voucher.Id`, `pos.POSSessions.Id`,
`identity.Branch.Id`, `recipe.Recipe.Id`) are **scalar Guid columns with no DB-level FK constraint** —
consistent with every other cross-service reference already in this codebase (`Deal.CustomerId`,
`MenuItem` → future `RecipeId`, etc.), since each service owns its own database/schema boundary.

### 2.3 Indexes & constraints
- Unique: `Tables.QrCode` (where not null), `TableOrderingSessions.QrCode`, `KitchenStations.Name` per
  branch, `ModifierGroups`/`Combos` names per tenant (not globally unique).
- Non-unique, high-value: `Orders(BranchId, Status, CreatedAt)` (board/queue queries), `Orders(SessionId)`
  (shift close aggregation), `OrderItems(KitchenStationId, Status)` (KDS per-station queries),
  `Reservations(BranchId, ReservationDate)`, `WaitlistEntries(BranchId, Status)`,
  `DeliveryOrders(Status, EstimatedDeliveryAt)`.
- FK-style (app-enforced, not DB constraint, per the cross-schema convention above) validated in command
  handlers: `Order.CustomerId` must exist in POS Customers; `Order.TaxRateId` in POS TaxRates; etc.
- `Orders.RowVersion` (SQL Server `rowversion`) — concurrency token, **replaces** the raw-SQL bypass
  documented in Phase 1 (`RecordPayment` currently uses `ExecuteSqlAsync` to dodge an optimistic-
  concurrency rowcount bug). With a proper `RowVersion` + `DbUpdateConcurrencyException` handling
  (retry-with-reload, standard EF pattern), the raw-SQL workaround can be removed entirely.

### 2.4 Views (replace in-memory LINQ aggregation flagged in Phase 1)
`TablesController.GetSummary`/`OrdersController.GetSummary`/etc. currently pull every row into memory
and `.Count()` in C#. Replace with SQL views (or at minimum `GroupBy` pushed to SQL via
`.Select(...).GroupBy(...)` translated server-side):

- `vw_RestaurantSalesDaily` (BranchId, Date, OrderCount, GrossSales, Discounts, Tax, NetSales)
- `vw_RestaurantSalesByCategory` (BranchId, CategoryId, Date, Qty, Revenue)
- `vw_RestaurantSalesByEmployee` (BranchId, WaiterUserId, Date, OrderCount, Revenue, TipTotal)
- `vw_RestaurantVoidsAndDiscounts` (BranchId, UserId, Date, VoidCount, VoidValue, DiscountCount, DiscountValue) — feeds the fraud-signal report in §1.14
- `vw_KitchenPrepTimes` (KitchenStationId, MenuItemId, Date, AvgPrepMinutes, P90PrepMinutes)
- `vw_TableTurnover` (BranchId, TableId, Date, TurnCount, AvgOccupiedMinutes)
- `vw_TaxSummary` (BranchId, TaxRateId, Date, TaxableAmount, TaxCollected)

### 2.5 Stored procedures
Given the CQRS/EF Core pattern used throughout this repo, **prefer EF LINQ translated to SQL over hand-
written stored procs** — every other service in this codebase does aggregation via `IQueryHandler` +
LINQ, not sprocs. The only candidate for a stored proc is the **Z-report close** (multi-table read +
`POSSession.Close()` write in one transaction) — but this repo's existing `Result<T>`/handler pattern
already handles that transactionally in C#; recommend **no new stored procedures**, to stay consistent
with the rest of the codebase and keep logic in source control/testable C#, not opaque SQL.

---

## 3. PHASE 5 — API Design

All new/changed endpoints follow the mandatory pattern from this repo's `CLAUDE.md`: controllers take
only `ISender sender`, no inline DTOs, `[RequirePermission("restaurant.<key>.<action>")]` per action.

| Controller | Method + Route | Permission | Notes |
|---|---|---|---|
| `FloorsController` | `GET/POST/PUT/DELETE /api/restaurant/floors` | `restaurant.config.*` | new |
| `DiningAreasController` | `GET/POST/PUT/DELETE /api/restaurant/dining-areas` | `restaurant.config.*` | new |
| `TablesController` | `POST /tables/{id}/merge`, `POST /tables/{id}/unmerge`, `PATCH /tables/{id}/layout` (PosX/Y/Rotation) | `restaurant.tables.edit` | new |
| `OrdersController` | `POST /orders/{id}/transfer-table`, `POST /orders/{id}/split`, `POST /orders/{id}/void-item` (reason + optional PIN), `POST /orders/{id}/refund`, `POST /orders/{id}/tip`, `POST /orders/{id}/fire-course` | `restaurant.orders.edit` / `.void` / `.refund` | new |
| `ModifiersController` | `GET/POST/PUT/DELETE /api/restaurant/modifier-groups`, nested `/modifiers` | `restaurant.menu.*` | new |
| `CombosController` | `GET/POST/PUT/DELETE /api/restaurant/combos` | `restaurant.menu.*` | new |
| `HappyHourController` | `GET/POST/PUT/DELETE /api/restaurant/happy-hour-rules` | `restaurant.config.*` | new |
| `WaitlistController` | `GET/POST /api/restaurant/waitlist`, `PATCH /{id}/seat`, `PATCH /{id}/no-show` | `restaurant.tables.edit` | new |
| `DeliveryController` | `GET/POST /api/restaurant/delivery-orders`, `PATCH /{id}/status`, `GET /delivery/{token}` (anonymous tracking) | `restaurant.delivery.*` | new |
| `PublicOrdersController` | `POST /api/restaurant/public-orders` (QR/kiosk/online, anonymous, tenant resolved from token) | `[AllowAnonymous]` | new |
| `PrinterProfilesController` / `KitchenStationsController` / `ReceiptTemplatesController` | standard CRUD | `restaurant.config.*` | new |
| `ReservationsController` | `PATCH /{id}/no-show`, `PATCH /{id}/deposit` | `restaurant.reservations.edit` | extends existing |
| `ReportsController` (new) | `GET /reports/sales-daily`, `/sales-by-category`, `/sales-by-employee`, `/voids-discounts`, `/kitchen-prep-times`, `/table-turnover`, `/tax-summary`, `/z-report`, `/x-report` | `restaurant.reports.view` | new, thin wrappers over §2.4 views |
| `DashboardController` (new) | `GET /dashboard/owner`, `/branch`, `/kitchen`, `/cashier`, `/inventory` | role-scoped | new |
| Auth (`AuthController` in Identity) | `POST /api/auth/verify-pin` | n/a (used internally by void/discount/refund) | new, small |

**OpenAPI**: this repo's gateway already generates Swagger/OpenAPI per service (confirmed pattern from
NU1903 OpenApi package references seen across services) — no new tooling needed, just annotate the new
controllers/DTOs consistently (they already will be, since DTOs live in `Application/<Feature>/Dtos`
per the mandatory architecture).

---

## 4. PHASE 6 — Frontend Redesign

Stack reality check: **Tailwind, not MUI** (per §0). Redesign principles, mapped to this repo's existing
conventions (dark-mode via `bg-card`/`text-primary` tokens, Framer Motion drawers, `sonner` toasts,
`@tanstack/react-query`):

- **Floor Designer** — new `FloorDesignerCanvas` component: draggable table shapes on an SVG/canvas
  grid, persists `PosX/PosY/Rotation` on drop (debounced PATCH). Read-only mode for cashiers, edit mode
  gated by `restaurant.config.edit`.
- **Table board** — extend the existing `TableCard` grid (already in `restaurant-pos-view.tsx`) with
  merge/transfer affordances (long-press or right-click menu), waitlist panel, and a live table timer.
- **KDS** — extend `kitchen-display-view.tsx` with per-station tabs/columns (Grill/Bar/Dessert), course
  grouping, rush-priority highlighting, and a SignalR-driven live feed instead of polling.
- **Order drawer** — extend `OrderDrawer` (already 633 lines) with: structured modifier picker (chips,
  not free text), combo builder, course-fire button, split-bill flow (visual "assign items to guest 1/2/3"
  UI — this is the single highest-value UX addition per your original spec), void/discount reason modal
  (state-based, per this repo's own "never `window.confirm`" rule already documented in `CLAUDE.md`),
  manager-PIN modal for threshold-gated actions.
- **Touch-friendly / tablet-friendly** — large tap targets (min 44px), numeric keypad for PIN/open-price
  entry, swipe gestures for hold/recall.
- **Dark mode** — already the default theming approach repo-wide (`prefers-color-scheme` + `data-theme`
  overrides per the Artifact/theming conventions already used); apply the same tokens, don't invent new
  ones.
- **Keyboard shortcuts** — cashier-mode: number-pad quantity entry, `F` to fire course, `Esc` to close
  drawer, `/` to focus quick-search — standard POS ergonomics, implemented as a `useHotkeys`-style hook.
- **Minimal clicks** — "Apply to All" pattern already used elsewhere in this codebase (HR payroll bulk-
  allowance UI) is a good model for "apply happy-hour to all eligible items" / "mark all present" style
  bulk actions in the order drawer.
- **New screens**: Floor Designer, Waitlist board, Delivery tracking board, Reservation calendar (week
  view), Reports/Dashboards pages (Owner/Branch/Kitchen/Cashier/Inventory — 5 new dashboard pages
  mirroring the existing per-module dashboard pattern), Printer/Station config (Settings), Modifier/Combo
  builder (Menu management).

---

## 5. PHASE 7 — Implementation Roadmap

### Phase 1 — Critical Features (foundation + table stakes)
- **Features**: Migrate Restaurant service to CQRS/DDD (Result<T>, AuditableEntity, MediatR handlers,
  FluentValidation — pays down the tech debt flagged in Phase 1 before building on top of it);
  `restaurant.*` permissions + `[RequirePermission]`; `BranchId` wiring across all entities; reuse-wiring
  to POS Session/TaxRate/Voucher/Customer; structured modifiers; split-bill; hold/recall; void with
  reason + PIN approval; itemized discounts; tips; RowVersion concurrency fix (removes the raw-SQL
  workaround).
- **Database**: all of §2.1 (modify existing) + `ModifierGroups/Modifiers/MenuItemModifierGroups/
  OrderItemModifiers`, `OrderDiscounts`, `OrderVoidLogs`, `UserBranches`.
- **APIs**: modifier/void/discount/split/transfer endpoints; `verify-pin`; permission enforcement on
  every existing endpoint.
- **UI**: modifier picker, split-bill flow, void/discount modals, PIN modal, branch selector.
- **Reports**: none new yet (Phase 4 territory) — but the `RowVersion`/permission work unblocks all later
  reporting by making the underlying data trustworthy.
- **Permissions**: full `restaurant.*` seed + sync to Administrator roles (mirrors every other module's
  audit pattern, Modules 5i–5p).
- **Testing**: concurrency test (two waiters editing one order), permission-denial tests per role,
  void/discount audit-trail integration tests.
- **Risks**: migrating live `Order.Waiter` (string) → `WaiterUserId` needs a backfill matching existing
  free-text names to Identity users where possible (may not always match — keep `Waiter` as a fallback
  display field, same "denormalize + keep the string" pattern used elsewhere in this codebase).
- **Estimated effort**: 4–6 weeks, 1–2 backend + 1 frontend engineer.

### Phase 2 — Operations (floor/kitchen/delivery/reservations)
- **Features**: Floor/DiningArea + layout designer; Combos; Course management; Happy hour; Kitchen
  stations/printers + KDS station routing; Waitlist; Reservation rules + no-show automation; Delivery
  orders + zones + driver tracking; QR table ordering; Online-order public endpoint.
- **Database**: `Floors/DiningAreas`, `Combos/ComboItems`, `HappyHourRules`, `PrinterProfiles/
  KitchenStations/ReceiptTemplates`, `WaitlistEntries`, `ReservationRules` + `Reservations` extensions,
  `DeliveryZones/DeliveryOrders/Drivers`, `TableOrderingSessions`.
- **APIs**: all controllers listed in §3 except reports/dashboards.
- **UI**: Floor Designer, KDS station tabs, Waitlist board, Delivery tracking board, Reservation
  calendar, QR ordering public page.
- **Reports**: table-turnover, kitchen-prep-times (views only, feeding Phase 4's report UI).
- **Permissions**: `restaurant.delivery.*`, extend `restaurant.tables`/`.kitchen`/`.reservations`.
- **Testing**: KDS realtime-push load test, no-show automation job test, delivery status-machine tests.
- **Risks**: SignalR introduces a new realtime dependency — confirm gateway/infra supports websockets at
  scale before committing the KDS redesign to it (fall back to short-poll if not, still an improvement).
- **Estimated effort**: 6–8 weeks.

### Phase 3 — Inventory (recipe costing, stock tie-in)
- **Features**: `MenuItem.RecipeId` linkage; stock deduction on serve (call existing Inventory API);
  auto-86 on zero stock; food-cost/recipe-cost reporting.
- **Database**: `MenuItems.RecipeId` column only (no new tables — everything else already exists in
  Recipe/Inventory services).
- **APIs**: none new on the Restaurant side beyond calling existing Inventory endpoints; possibly one new
  Inventory-side webhook/event for "ingredient depleted" if cross-service eventing isn't already wired.
- **UI**: recipe picker on MenuItem edit form; food-cost column in menu management; 86'd-item banner.
- **Reports**: food-cost/margin report (join Order sales against Recipe cost).
- **Permissions**: reuse existing `inventory.*` keys for the underlying calls.
- **Testing**: stock-deduction accuracy test (order N of item X → verify N × recipe-quantity deducted).
- **Risks**: cross-service call latency on every "serve" action — consider async/eventual consistency
  (fire-and-forget with a retry queue) rather than blocking the waiter's "serve" tap on an Inventory
  round-trip.
- **Estimated effort**: 3–4 weeks.

### Phase 4 — Analytics (reporting, dashboards, finance bridge)
- **Features**: all §2.4 views; full Reports controller; 5 role-scoped dashboards; Z/X report; tax
  summary; void/discount fraud-signal report; optional Finance journal-entry bridge.
- **Database**: the 7 views in §2.4 (or equivalent LINQ-translated queries).
- **APIs**: `ReportsController`, `DashboardController`.
- **UI**: 5 dashboard pages, reports pages with CSV/PDF export (reuse existing `ExportMenu`/`csv.ts`/
  `pdf.ts` utilities already in this codebase — don't rebuild export).
- **Reports**: this phase *is* the reports.
- **Permissions**: `restaurant.reports.view`, role-gated dashboard access.
- **Testing**: report-number reconciliation against raw order data (spot-check totals match).
- **Risks**: none major — this phase is additive/read-only over data made trustworthy in Phase 1.
- **Estimated effort**: 3–5 weeks.

### Phase 5 — Enterprise Features (multi-branch, loyalty depth, integrations, offline)
- **Features**: `UserBranches` scoping + central reporting; Customer wallet/house-accounts/birthday
  offers/favourites; Payment gateway integration; SMS/WhatsApp providers; third-party delivery platform
  adapters; Device registration + offline sync/queueing.
- **Database**: `UserBranches`, `CustomerWalletTransactions`, `FavoriteOrders`, `DeviceRegistrations`.
- **APIs**: branch-scoping middleware/guard (mirrors `IProjectAccessGuard` from Module 5g); wallet/house-
  account endpoints; delivery-provider plug-ins.
- **UI**: branch switcher, wallet/house-account UI in customer profile, device-registration settings
  page, offline indicator + sync-queue viewer.
- **Reports**: cross-branch central reports.
- **Permissions**: branch-scoped role provisioning extension.
- **Testing**: offline-then-reconnect sync-conflict tests; branch-isolation tests (user assigned to
  Branch A can't see Branch B's tables/orders).
- **Risks**: offline sync is the highest-risk item in the entire roadmap — conflict resolution (two
  offline devices modifying the same order) needs explicit design sign-off before implementation starts;
  recommend a dedicated design spike at the start of this phase rather than estimating it blind.
- **Estimated effort**: 8–12 weeks (offline sync alone could be 4+ weeks in isolation).

---

## 6. Implementation Backlog (Epic → Feature → User Story → Task)

Full task-level breakdown for **Phase 1 (Critical)** below — this is what a sprint-planning session
would actually load into Jira first. Phases 2–5 are broken to **Epic → Feature → representative User
Story** depth; task-level breakdown for those should happen at the start of each phase (standard
practice — task-breaking a backlog 6 months out produces stale tickets, not useful ones).

### EPIC 1: Restaurant Service — CQRS/DDD Migration (Phase 1)
**Feature 1.1: Domain layer rebuild**
- Story: As a developer, I need `Order`/`Table`/`MenuItem`/`Reservation` rebuilt as `AuditableEntity<Guid>`
  aggregates returning `Result<T>`, so the service matches this repo's mandatory architecture.
  - Task: Add `Softaxis.Restaurant.Application` project (Commands/Queries/Dtos folders per feature)
  - Task: Rewrite `Order` aggregate with `Result<T>` factory methods + domain events (`OrderCreated`,
    `OrderVoided`, `OrderPaid`)
  - Task: Rewrite `Table`, `MenuItem`, `Reservation` to the same standard
  - Task: Add `RowVersion` to `Order`; remove the raw-SQL `ExecuteSqlAsync` workaround in
    `OrdersController.RecordPayment`, replace with proper `DbUpdateConcurrencyException` retry handling
- Story: As a developer, I need every controller converted to `ISender`-only + `RestaurantControllerBase`,
  so it stops injecting `DbContext` directly.
  - Task: Create `RestaurantControllerBase` (mirror `PurchaseControllerBase`/`SalesControllerBase`)
  - Task: Migrate `TablesController`, `MenuController`, `OrdersController`, `KitchenController`,
    `ReservationsController` to MediatR handlers
  - Task: Move inline `record` DTOs into `Application/<Feature>/Dtos`

**Feature 1.2: Permissions**
- Story: As a tenant admin, I need granular `restaurant.*` permissions so I can restrict who can void,
  discount, or refund.
  - Task: Add `restaurant.tables/menu/orders/kitchen/reservations/config/reports/delivery` to
    `PermissionSeedData.cs` (+ `.void`/`.discount`/`.refund` extra actions on `orders`)
  - Task: Migration `AddRestaurantPermissions` + `SyncAdministratorPermissionsAsync` coverage
  - Task: Add `RequirePermissionAttribute` to `Softaxis.Restaurant.API` (copy shared pattern)
  - Task: Apply `[RequirePermission]` to every action across all 5 controllers
  - Task: Frontend `<Can>` gating on void/discount/refund/config buttons

**Feature 1.3: Manager PIN approval**
- Story: As a cashier without void permission, I need to request a manager's PIN so I can still void an
  item under supervision.
  - Task: Add hashed `Pin` field + `SetPin`/`VerifyPin` to Identity `User` (mirror `TwoFactorSecret`)
  - Task: `POST /api/auth/verify-pin` endpoint
  - Task: Wire void/discount/refund flows to prompt for PIN when the acting user lacks the permission
  - Task: `OrderVoidLogs`/`OrderRefunds` capture `ApprovedByUserId`

### EPIC 2: Branch & Session Integration (Phase 1)
**Feature 2.1: Branch wiring**
- Story: As a multi-branch tenant, I need tables/orders/reservations scoped to a branch.
  - Task: Migration adding `BranchId` to `Tables`/`Orders`/`Reservations`/`MenuItems`
  - Task: `UserBranches` table + branch-access guard (mirror `IProjectAccessGuard`)
  - Task: Frontend branch switcher
**Feature 2.2: POS Session tie-in**
- Story: As a shift manager, I need restaurant sales included in the cash-drawer reconciliation.
  - Task: Add `SessionId`/`CashierId` to `Orders`
  - Task: Call `POSSession.RecordTransaction` on every restaurant payment/refund
  - Task: Block order payment when no open session exists for the register
  - Task: Migration + backfill note (existing paid orders have no session — leave `SessionId` null,
    exclude from historical Z-report reconciliation, flag in docs)

### EPIC 3: Structured Ordering (Phase 1)
**Feature 3.1: Modifiers** — Stories/Tasks: `ModifierGroup`/`Modifier` CRUD, `MenuItemModifierGroup`
assignment UI, `OrderItemModifier` capture on order creation (price/name snapshot), migrate existing
free-text `Modifiers` string to a "legacy notes" fallback field (don't lose historical data).
**Feature 3.2: Split bills** — Stories/Tasks: `ParentOrderId` migration, `POST /orders/{id}/split`
handler, "assign items to guest" frontend flow, payment-per-split UI.
**Feature 3.3: Discounts/Voids/Refunds overhaul** — Stories/Tasks: `OrderDiscounts`/`OrderVoidLogs`/
`OrderRefunds` tables + handlers, migrate `Order.DiscountAmount` to computed-from-sum, reason-required
UI modals (replacing any implicit "just click and it's gone" flow), audit-log wiring.
**Feature 3.4: Tips & Hold/Recall** — Stories/Tasks: `TipAmount` field + capture UI, `Order.Status =
"held"` value + recall list endpoint/UI.

*(Phases 2–5 backlog — Epic/Feature level; task-break at each phase kickoff)*

### EPIC 4: Floor & Table Operations (Phase 2)
Features: Floor/DiningArea CRUD + designer canvas · Table merge/transfer/unmerge · Waitlist management ·
Reservation rules + no-show automation.

### EPIC 5: Kitchen & Menu Depth (Phase 2)
Features: Kitchen stations + printer routing · Combos/meal deals · Course management · Happy-hour pricing
· KDS realtime (SignalR) redesign.

### EPIC 6: Delivery & Online Channels (Phase 2)
Features: Delivery zones/orders/driver tracking · Third-party delivery adapters · QR table ordering ·
Kiosk/online public ordering endpoint · Digital/email/WhatsApp receipts.

### EPIC 7: Inventory Integration (Phase 3)
Features: Recipe linkage on MenuItem · Stock deduction on serve · Auto-86 on depletion · Food-cost
reporting.

### EPIC 8: Analytics & Reporting (Phase 4)
Features: Reporting views (sales/category/employee/void/discount/kitchen/turnover/tax) · Z/X report ·
Owner/Branch/Kitchen/Cashier/Inventory dashboards · CSV/PDF export wiring.

### EPIC 9: Enterprise Scale (Phase 5)
Features: Branch-scoped roles + central reporting · Customer wallet/house-accounts/birthday/favourites ·
Payment gateway integration · SMS/WhatsApp providers · Device registration · Offline sync (design spike
first, then implementation).

**Status: Branch scoping, Wallet & House Accounts, Payment Gateway + SMS/WhatsApp, and Device
Registration are all shipped** (see `CLAUDE.md` for the implementation log — `UserBranch`/
`IBranchAccessGuard`, `Customer.WalletBalance`/`CreditLimit`, `PaymentGatewayConfig`/
`NotificationProviderConfig`, `DeviceRegistration`). **Offline sync itself is intentionally still
just a design spike** (below) — no implementation code exists for it, by design, per the effort
estimate and risk flag in §5 above.

---

## 7. Offline Sync — Design Spike (Epic 9, Phase 5)

**Discussion/analysis only — no implementation in this pass.** Per §5's own risk flag ("offline sync
is the highest-risk item in the entire roadmap... recommend a dedicated design spike at the start of
this phase rather than estimating it blind"), this section is that spike. It does not change any
code; it exists so the next person picking this up doesn't have to re-derive the reasoning below.

### 7.1 Scope — what actually needs to survive a connectivity drop?
- **Taking orders** (new table order, adding items) — the highest-value case. A dine-in restaurant
  can't tell a table "come back when the wifi's up."
- **Kitchen status transitions** (sent → ready → served) — nice to queue, not critical; KDS is
  inherently a live-sync surface already (SignalR, Module 5's KDS redesign).
- **Payments** — the highest-*risk* case, more so now than when §1.14 was first written: a payment
  can touch recipe/inventory deduction (Epic 7), wallet/house-account balances (Epic 9's Wallet
  slice), and the POS session cash-drawer total (Epic 2), all of which assume the state being
  validated against is current.
- **Menu/table reads** — must be cached locally regardless of what else gets built, or the screen
  just goes blank offline.

### 7.2 The one decision that matters most

| | Full bidirectional sync | Selective offline tolerance |
|---|---|---|
| What it means | Every mutation (order, item, payment, discount, void, status change) queues offline and replays with general conflict resolution | Only a curated set of *additive, commutative* operations queue offline; anything touching a shared balance or state transition just waits for connectivity |
| Complexity | CRDT/Automerge-class problem — genuinely hard, multi-month even for a focused team | Replays through the *same* command handlers already validating things online |
| Fits this codebase? | No — nothing here is built for it, and retrofitting it touches almost every handler | Yes — matches the additive audit-trail pattern already used for `OrderDiscount`/`OrderVoidLog`/`OrderRefund` (Module 19c) |

**Recommendation: selective offline tolerance, not full sync.** Real conflict-free replication is
disproportionate to the actual failure mode (a wifi blip during service), and the money-adjacent
operations here (wallet, house account, recipe deduction) are exactly the ones where "resolve the
conflict automatically" is the wrong instinct.

### 7.3 Conflict scenarios, worked through concretely
1. **Two devices both add items to the same order while offline.** Safe to merge — item-add is
   additive/commutative, and it already replays through the existing `AddOrderItemsCommand` handler
   unchanged. No new merge logic needed.
2. **An order queued offline references a table since closed/reassigned by another device.** Not
   safe to auto-merge — reject the replay and surface it for a human to re-seat. A real business
   conflict, not a data conflict.
3. **A payment queued offline against an order whose total changed in the meantime** (an item voided,
   a discount changed). The dangerous case. Payments must **never** blind-replay — the amount has to
   be re-validated against the *current* server total at reconnect time; any mismatch goes to a
   manual-review queue instead of auto-applying. Same class of narrow consistency gap already
   accepted and documented in `CustomerPaymentSupport` (Epic 9, Wallet slice) for the *online*
   concurrent-edit case — offline queuing would only widen that window, not create a new problem.
4. **A device was offline while its POS session/shift got closed elsewhere.** Already enforced online
   via `OrderPaymentSupport.EnsureSessionStillOpenAsync` (Epic 2) — replay must go through that same
   check, not bypass it because the write originated offline.
5. **Voids/discounts needing manager-PIN approval** (Feature 1.3, flagged, not yet built) — replay
   must not silently skip whatever authorization gate would have applied live.

**Policy, stated plainly:** additive operations merge automatically by replaying through existing
handlers; anything that reads-then-writes a shared balance or does a state transition either blocks
until online or lands in a conflict inbox for a human — never an automatic resolution.

### 7.4 Phasing, if/when this gets greenlit
- **Phase A — read-only tolerance.** Cache menu/table/current-order data locally so the screen
  doesn't go blank. No writes queue at all; every action shows "reconnecting…". Low risk, ~1 week,
  and alone fixes most of the pain of a short wifi drop.
- **Phase B — additive-write queuing only.** Queue *create order* and *add items* while offline;
  replay through the existing command handlers verbatim. Everything else (payments, discounts,
  voids, status changes) stays online-only with a clear waiting state. This is the actual 80/20.
- **Phase C — state-transition queuing + a conflict inbox.** Only after B has run in production long
  enough to know how often conflicts actually occur; needs a new `SyncConflictLog` entity + a
  staff-facing resolution screen.
- **Payments, wallet redemption, and house-account charges stay online-only, indefinitely.** Not
  "Phase D" — this boundary is recommended to never move. The failure mode (double-charging a
  wallet, exceeding a credit limit against stale data) isn't worth the UX gain.

### 7.5 Sketch of the client-side/backend pieces (not built — for whenever Phase B is scoped)
- Client-side only: `SyncQueueEntry` in IndexedDB — `{LocalId, DeviceFingerprint, CommandType,
  Payload, CreatedAtLocal, Status: pending/synced/conflict}`. `DeviceRegistration`'s
  `DeviceFingerprint` (already shipped) is the natural key to tag queued operations with.
- Backend: recommend adding an optional `ClientOperationId` (Guid, client-generated) to whichever
  commands become queueable, so replaying the same operation twice (e.g. an ack interrupted mid-
  flight) doesn't double-apply. The one schema change worth doing opportunistically whenever Phase B
  actually starts — not proposed for this pass.
- Backend: `SyncConflictLog` (per tenant) for Phase C — records what failed to replay and why.

### 7.6 Open questions needing a decision before Phase A even starts
1. **What failure mode is actually being protected against** — seconds-to-minutes of wifi flakiness
   (Phase A/B genuinely covers it), or a venue with no reliable connectivity for hours at a time? The
   second is a different, much bigger project (a real local-first data store with true merge
   semantics), not an extension of A/B.
2. **PWA or native app?** Service-worker-based queuing and a wrapped app with local SQLite are
   different implementation paths with very different effort.
3. **Who resolves a sync conflict in practice?** A manager reliably on-site to triage a conflict
   inbox, or does it need to be fully automatic? Per §7.3, full-automatic isn't safely achievable for
   anything money-adjacent, so this answer affects whether Phase C is worth building at all.

---

## Appendix: Reuse Map (what NOT to rebuild)

| Need | Reuse from | Do NOT build |
|---|---|---|
| Shift/cash management | `Softaxis.POS.POSSession`/`CashMovement` | a second session/cash-drawer model |
| Tax rates | `Softaxis.POS.TaxRate` | a restaurant-specific tax table / hardcoded 5% |
| Vouchers/coupons/gift cards | `Softaxis.POS.Voucher` | a second discount-code engine |
| Customer/loyalty base | `Softaxis.POS.Customer` | a parallel restaurant customer table |
| Branches | `Softaxis.Identity.Branch` | a restaurant-local branch entity |
| Clock in/out, attendance | `Softaxis.HR` `AttendanceController` | a restaurant-local attendance table |
| Recipe/ingredient cost | `Softaxis.Recipe` | a restaurant-local recipe engine |
| Stock/low-stock/valuation | `Softaxis.Inventory` | a restaurant-local stock ledger |
| GL/journal/cashbook | `Softaxis.Finance` | a restaurant-local ledger |
| Permission model, `[RequirePermission]` | shared attribute pattern (Finance/HR/CRM/etc.) | a new auth scheme |
| Secret encryption (gateway credentials) | `ISecretProtector` (CRM Module 7/11) | a new encryption utility |
| Provider plug-in model (delivery/SMS/WhatsApp) | CRM Module 7's `ILeadProvider` pattern | bespoke per-integration wiring |
| Export (CSV/PDF) | `src/lib/csv.ts` / `pdf.ts` / `ExportMenu` | a new export utility |
| Row-level branch/project scoping | `ProjectMember`/`IProjectAccessGuard` pattern (Module 5g) | a bespoke scoping mechanism |
