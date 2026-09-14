# Vrodux ERP — Mobile (Expo / React Native)

Talks to the same `Softaxis.ApiGateway` the web app (`FrontendVite/`) uses — same JWT auth, same
tenant/permission claims, same REST envelope. See the root `CLAUDE.md` (Modules on Mobile discussion)
for the wider rollout plan and white-label notes.

**Not wired into CI/CD.** `.github/workflows/deploy.yml` only builds `Backend/` and `FrontendVite/`
into Docker images — this folder is never built or shipped by the existing pipeline.

## Setup

```bash
cd Mobile
npm install
cp .env.example .env.local   # point EXPO_PUBLIC_API_URL at your running gateway
npm start
```

Then press `i` (iOS Simulator), `a` (Android Emulator), or scan the QR code with Expo Go on a
physical device.

**Base URL note** — `localhost` on a physical device means the phone itself, not your PC:
- Simulator/emulator on the same machine as the gateway: `http://localhost:5000`
  (Android emulator specifically: `http://10.0.2.2:5000`)
- Physical device on the same Wi-Fi: `http://<your-lan-ip>:5000`

## Structure

```
src/
  lib/
    api-client.ts     — fetch wrapper: envelope unwrap, 401→refresh→retry, error-message extraction
                          (detail→description→message→error→field-errors→title, matches web's
                          rawApiClient precedence — different controllers report failures under
                          different keys, see "Conventions" below)
    auth.api.ts        — login / verify-2fa / refresh / revoke
    crm.api.ts          — leads, deals/pipeline, activities; CRM_*_VIEW/EDIT permission-tier lists
    crm-helpers.ts      — leadHeat, buildLeadSummary, formatCompactValue, cleanPhone (i18n stripped;
                          formatCompactValue is reused as the de facto shared money formatter by
                          every other module below, not CRM-specific despite the filename)
    hr.api.ts           — employee self-service (api/hr/me/*); HR_SELF_* permission-key constants
    approvals.api.ts    — cross-module approvals inbox (leaves/purchase/sales-returns/payroll);
                          APPROVALS_* permission-key constants
    inventory.api.ts    — products + per-warehouse stock; INVENTORY_* permission-key constants
    sales.api.ts        — sales orders + quotations; SALES_* permission-key constants
    purchase.api.ts     — purchase orders + vendors; PURCHASE_* permission-key constants
    finance.api.ts      — invoices + expenses; FINANCE_* permission-key constants
    jwt.ts             — decode JWT payload (no verification — server already signed it)
    query-client.ts    — shared React Query client
    secure-storage.ts  — Keychain/Keystore wrapper (expo-secure-store)
  store/
    auth.store.ts       — zustand + SecureStore-backed persistence; session, tenant/permission
                          claims, hasPermission()/hasModuleAccess() helpers
  hooks/
    query-keys.ts         — shared "crm" React Query key root
    use-leads.ts           — leads list/detail, status change, convert-to-deal
    use-deals.ts           — pipeline list/detail, stage move
    use-activities.ts      — shared activity feed/create (leads + deals + customers)
    use-hr-self.ts         — profile, attendance (today/history/check-in/out), leave, payslips
    use-approvals.ts       — pending leaves/purchase/sales-returns queries + approve/reject mutations,
                          and the payroll process/finance-approve/pay/reject workflow
    use-inventory.ts       — products list/detail, per-product stock
    use-sales.ts           — orders list/detail/status, quotations list/detail/send/respond/convert
    use-purchase.ts        — purchase orders list/detail/status, vendors list/detail
    use-finance.ts         — invoices list/detail/send/pay, expenses list/detail/create
  navigation/
    RootNavigator.tsx    — bottom tabs (Dashboard/Leads/Pipeline/HR/Approvals/Inventory/Sales/
                          Purchase/Finance); each tab only renders when the session's JWT grants
                          module access + the relevant permission(s) — see the tab-count note below
    LeadsStack.tsx / DealsStack.tsx / HrStack.tsx / InventoryStack.tsx / SalesStack.tsx /
    PurchaseStack.tsx / FinanceStack.tsx — per-feature stacks
    types.ts
  screens/
    LoginScreen.tsx
    TwoFactorScreen.tsx  — step 2 of the two-phase 2FA login (Module 14)
    HomeScreen.tsx       — placeholder dashboard; shows session/tenant info, not real KPIs yet
    LeadsListScreen.tsx / LeadDetailScreen.tsx
    DealsListScreen.tsx / DealDetailScreen.tsx
    ApprovalsScreen.tsx  — single-screen inbox: one section per source, inline approve/reject
    hr/
      HrHomeScreen.tsx    — profile + today's check-in/out + menu into the three sub-screens
      AttendanceScreen.tsx — paged history
      LeaveScreen.tsx      — balances, apply form, request history with cancel
      PayslipsScreen.tsx   — paged history, tap a row to expand the breakdown
    inventory/
      ProductsListScreen.tsx — search, low-stock filter, infinite scroll
      ProductDetailScreen.tsx — price/tax/stock stats + per-warehouse on-hand quantity
    sales/
      SalesHomeScreen.tsx — menu into Orders / Quotations (mirrors HrHomeScreen's pattern)
      OrdersListScreen.tsx / OrderDetailScreen.tsx — status filter chips; Confirm/Cancel on pending
      QuotationsListScreen.tsx / QuotationDetailScreen.tsx — delivery trail; Send/Respond/Convert
    purchase/
      PurchaseHomeScreen.tsx — menu into Purchase Orders / Vendors
      PurchaseOrdersListScreen.tsx / PurchaseOrderDetailScreen.tsx — "Send to Vendor" on draft
      VendorsListScreen.tsx / VendorDetailScreen.tsx — call/email quick actions
    finance/
      FinanceHomeScreen.tsx — menu into Invoices / Expenses
      InvoicesListScreen.tsx / InvoiceDetailScreen.tsx — Send (draft) / Mark Paid
      ExpensesListScreen.tsx / ExpenseDetailScreen.tsx / NewExpenseScreen.tsx — submission form
  types/
    auth.ts / crm.ts / hr.ts / approvals.ts / inventory.ts / sales.ts / purchase.ts / finance.ts
                          — trimmed mirrors of the backend DTOs (kept in sync manually); each also
                          carries a `*_STATUS_LABELS` and (where the screens show a colored pill)
                          a matching `*_STATUS_TONE` map, co-located so a new status can't add a
                          label without a badge color or vice versa
  theme/
    colors.ts    — the brand palette, extracted from FrontendVite's `index.css` --primary/
                  --success/--warning/--destructive/--info HSL tokens (shadcn's stock "Blue"
                  theme) and the `#2563eb → #1e3a8a` gradient in `public/favicon.svg`. Light mode
                  only for this pass -- see "Design system" below.
    tokens.ts    — spacing/radius/fontSize/fontWeight/shadow scales
    navigation.ts — `navTheme` (React Navigation `Theme`) + `stackScreenOptions` (shared header
                  look for every `Stack.Navigator`)
    index.ts     — barrel export (`colors`, `spacing`, `radius`, `fontSize`, `fontWeight`,
                  `navTheme`, `stackScreenOptions`)
  components/
    ui/   — the shared design-system primitives every screen is built from (barrel: `ui/index.ts`):
          `Card`, `Button` (primary/secondary/outline/destructive/ghost), `Badge` (tone-colored
          pill), `Chip` (filter pill), `SearchInput`, `SectionCard` (titled card -- the pattern
          every detail screen's old local `Section` component duplicated), `Stat` + `DetailRow`
          (header stat blocks / label-value rows), `MenuCard` (module-home navigation card),
          `ListItemCard` (the pressable-card shell every `FlatList` row sits inside), and
          `LoadingState`/`ErrorState`/`EmptyState`/`EmptyListState`.
    brand/BrandMark.tsx — the "V" tile (gradient tile + glyph, via `expo-linear-gradient`) --
                  mirrors `favicon.svg` so the app opens on the same mark used in the browser tab.
```

## Design system

The app went through two passes: build the data/API layer per module (screens with correct
behavior but system-default styling), then a second pass applying a shared design system pulled
from the web app's actual brand tokens (`theme/colors.ts`'s doc comment names the exact source
files) so the mobile client reads as the same product, not a bare-bones prototype next to it.

- **Every screen is built from the `@/components/ui` primitives**, not ad-hoc `StyleSheet`+`View`
  chrome -- list rows are `ListItemCard`s (rounded, shadowed, spaced -- not a flat divided list),
  detail sections are `SectionCard`s, every status is a color-coded `Badge` driven by that type's
  `*_STATUS_TONE` map, every action is a `Button` variant, filters are `Chip` pills.
- **Icons**: `@expo/vector-icons`'s `Feather` set throughout (bundled with Expo, no extra native
  module) -- the closest visual match to the web app's `lucide-react` icons (Feather is what
  lucide was originally forked from), so the two apps' iconography reads the same family.
- **Navigation is themed globally**: `navTheme` on `<NavigationContainer>` and `stackScreenOptions`
  on every `Stack.Navigator` give a consistent white header + brand-blue back button/title across
  every stack, instead of each screen/stack picking its own (or none). Tab bar icons + active/
  inactive tint colors are set once in `RootNavigator.tsx`.
- **Dark mode** -- `theme/colors.ts` exports `lightColors` + `darkColors` (the latter converted from
  `FrontendVite/src/index.css`'s `.dark` HSL block the same way the light palette was, not invented
  separately). `theme/theme-context.tsx`'s `AppThemeProvider` (wraps the whole tree in `App.tsx`)
  reads `useColorScheme()` and exposes the active palette via `useAppTheme()`.
  - **Why every screen needed touching, not just the token file**: `StyleSheet.create({...})` is
    evaluated once, the instant its module is first imported -- a module-level `const styles = ...`
    that reads `colors.foreground` freezes on whichever scheme was active at that first import and
    never updates again. So every screen's trailing style block is now a `createStyles(colors: AppColors)`
    factory, called at render time via `const styles = useMemo(() => createStyles(colors), [colors])`
    inside each component (including small helper components defined alongside a screen -- each is
    its own React component, invoked via JSX, so it can safely call its own hooks).
  - **Why `useContext` per-component, not one root-level re-render**: relying on a single top-level
    `useColorScheme()` call to cascade a re-render down to every screen would depend on React
    Navigation never memoizing a screen wrapper in between -- a real risk, and not one worth betting
    a whole feature on. `useContext` subscriptions bypass memoization on components in between
    entirely, so each screen/helper reads the *current* palette correctly regardless.
  - Navigation chrome (header, tab bar, `<NavigationContainer theme={...}>`) is themed the same way --
    `theme/navigation.ts`'s `buildNavTheme(colors, isDark)` / `buildStackScreenOptions(colors)` are
    functions now, called from `RootNavigator.tsx` and every `*Stack.tsx` via `useAppTheme()`. The
    status bar (`expo-status-bar`) flips `light`/`dark` icon style with it.
  - System-driven only, matching the web app's default -- no in-app light/dark override toggle (the
    web app's is a per-user backend-synced setting; mobile has no Settings screen to host one yet,
    and per-tenant/per-user appearance sync is its own scope, not attempted here).
- **Per-tenant palette override is also out of scope** -- the web app's `ThemeProvider` can inject
  a different primary color per tenant; mobile ships one fixed brand look. Flagged, not built.
- **App icon + splash screen** are branded now, generated from the same source as
  `FrontendVite/public/favicon.svg` (the rounded #2563EB→#1E3A8A tile + white "V" path, not
  text -- no webfont is guaranteed wherever native tooling rasterizes these). Every slot
  `app.json` declares is real content, not Expo scaffold defaults: `icon.png` (1024, opaque, no
  baked corner-rounding -- iOS applies its own mask), the three Android adaptive-icon layers
  (`android-icon-foreground.png`/`-background.png`/`-monochrome.png`, the V sized to stay inside
  the guaranteed-visible 61%-diameter safe circle under even a full-circle launcher mask --
  verified by compositing + masking the layers, not eyeballed), `splash-icon.png`, and
  `favicon.png` for the web export target.
  - **Splash is wired through `expo-splash-screen`** (was missing entirely -- `splash-icon.png`
    existed in `assets/` but nothing installed or referenced it, so the splash shown was whatever
    Expo Go/the bare native default was). Its config plugin's `dark` variant reuses the exact same
    image (the brand mark doesn't invert with theme -- see `BrandMark.tsx`) against
    `backgroundColor: "#F8FAFC"` / dark `"#020817"`, matching `theme/colors.ts`'s
    `background`/`darkColors.background` exactly, so the splash hands off to `LoginScreen`
    (same background, same `BrandMark`) with no visible seam.
  - **Still only visible in an EAS build, not Expo Go** -- Expo Go always shows its own icon and
    (for the splash) largely its own loading UI regardless of app.json; these assets take effect
    once EAS build config exists (see "Next module"). Config-validated via `npx expo config` /
    `npx expo-doctor` in the meantime, not visually confirmed on a device.
  - Regenerated with a small local Pillow/numpy script (not committed -- a one-off asset build,
    not part of the app) rather than a design tool, so every asset stays byte-for-byte derived
    from `favicon.svg`'s exact path coordinates and gradient stops.

## What's built

**Auth**: full flow against the real gateway — login, 2FA step-up, JWT decode into tenant/permission
claims, refresh-token rotation with a mutex (dedupes concurrent 401s), secure token storage,
logout/revoke.

**AI Assistant** — chat + confirm/reject flow, ported from `ai-assistant-panel.tsx` (the web app's
floating panel, not the full `/ai-assistant` page with its settings/Telegram/voice/automations
modals — those are a separate, lower-priority follow-up). Same `/api/ai/*` REST contract (no
streaming to replicate):
- `screens/AiAssistantScreen.tsx` — message list, agent picker (pill row, sourced from
  `GET /agents`), suggested prompts on a fresh chat, persisted-history seeding
  (`GET /conversation`) so reopening shows what you already chatted, clear-chat with a confirm
  step (`DELETE /conversation`).
- **Pending-action confirm/reject** mirrors the web panel exactly: an assistant reply carrying
  `pendingAction` renders as an amber card naming the prettified action (`crm_create_lead` →
  "create lead") plus every argument as a reviewable `{label, value}` row — a confirmation you
  cannot inspect is not a safeguard. Confirm calls `POST /confirm`; Reject clears it client-side
  with no backend call, same as web.
- **Reachable from anywhere, not a tab.** `components/ai/FloatingAiButton.tsx` renders once at the
  root (`RootNavigator.tsx`'s `AuthenticatedApp`), floating over every authenticated screen
  regardless of which tab/stack is active, opening `AiAssistantScreen` in a `Modal`. Deliberately
  not a tab-bar entry: tabs are the scarce, permission-gated resource (`tab-config.ts` caps the bar
  at 5), while the assistant is "always-on" for every authenticated user (mirrors web's
  `hasModuleAccess` step 2 — `ai-assistant` bypasses the tenant-module/permission check entirely).
  No client-side permission gate on the screen itself; the backend still enforces per-tool
  permissions on every write the assistant attempts (CLAUDE.md Module 49), so exposing the chat
  screen to everyone is safe — asking is never gated, only *doing* is, same as on web.
- **Explicitly out of scope for this pass**: the settings modal (provider/model/tier/fallback
  config), Telegram linking, the voice agent, and scheduled automations — all real web features,
  all separable follow-ups once the core chat flow is confirmed working on-device.

**CRM (leads + pipeline)** — complete for this pass:
- Leads: search, status filters, hottest-first sort (score desc), infinite scroll, pull-to-refresh,
  call/WhatsApp/email quick actions, guarded status transitions, activity logging + feed.
- Pipeline: search, stage filters, opportunity list with value/weighted-value/forecast category,
  stage transitions (won/lost terminal, loss-reason capture on Lost), contact quick actions,
  activity logging + feed.
- **Convert Lead → Deal** via the dedicated `convertLead` endpoint (never a plain status PATCH).
- Both tabs are permission-gated per the three-tier model (`crm.leads`/`crm.leads-team`/
  `crm.leads-assigned`, same for `pipeline`).
- **Explicitly out of scope**: Accounts/Customers view, lead creation form, a real CRM dashboard
  summary, team-filing, CRM documents.

**HR self-service** — complete for this pass (`api/hr/me/*`, gated per-feature on the four
`hr.self.*` keys — view/attendance/leave-request/payslip, each independent):
- Profile + today's attendance card with Check In / Check Out.
- Attendance history (paged).
- Leave: balances, an apply form, request history with cancel for pending requests.
- Payslips: paged history, tap a row to expand basic/allowances/deductions/net.
- Handles the "not linked to an employee record" state (`Employee.NotLinked`) as the normal,
  non-error condition the backend treats it as.
- **Explicitly out of scope / flagged gaps**:
  - **No GPS on check-in/out.** The backend's `CheckInCommand`/`CheckOutCommand` take zero
    parameters today — there is nowhere to send a location even if the app captured one. Adding
    GPS would need a backend change (e.g. `Latitude`/`Longitude` on those commands) before the
    client side is worth building.
  - **Leave dates are plain text inputs** (`YYYY-MM-DD`), not a native date picker — kept
    dependency-light for this pass; swap in `@react-native-community/datetimepicker` when polishing.
  - **`totalDays` is a simple inclusive calendar-day count** computed client-side (no working-day/
    weekend exclusion) — flagged as an assumption, not verified against the web app's own logic.
  - No payslip PDF download (would need `expo-print`/`expo-sharing`).

**HR directory (employees + departments)** — the admin/manager-facing half of HR, distinct from
self-service above: every call takes an explicit employee id (gated `hr.employees.*`), vs.
self-service resolving "me" from the JWT (gated `hr.self.*`). A session can hold either, both, or
neither independently:
- Employees: search + status filter (defaults to Active) + department filter (chips, built from
  whatever departments are actually present in the data), summary stat row (`GET
  /employees/summary`). Detail screen covers Contact, Employment, Salary & bank (only shown when a
  salary is present -- withheld server-side unless the caller holds `hr.employees.view` or a
  payroll permission), Identity & compliance (Emirates ID/passport/labour card/bank routing),
  Skills, Emergency contact, Login account.
- Departments: read-only list (name, code, employee count, description) — the backend supports
  full CRUD (no dedicated `hr.departments.*` key; writes reuse `hr.employees.*`), but the web app
  itself only wires up list + create, and a mobile create form isn't worth building before that
  sees more use elsewhere.
- **`/employees/all` is a single flat, non-paginated fetch** (mirrors the web app exactly — neither
  client calls the paginated `/employees` endpoint) — all filtering above is client-side.
- **The "not linked to an employee record" banner no longer hides directory access.** It used to
  be a full-screen early return covering the whole HR tab; a manager who can see the directory but
  whose own login isn't linked to an employee record would have been locked out of it too. Now
  it's an inline banner in place of the self-service profile card, and the Directory menu section
  renders regardless.
- **Explicitly out of scope for this pass**: employee create/edit (a 20+ field form — desktop-
  appropriate), avatar upload, the linked-account create/link/unlink flow, live payslip/leave-
  balance sub-fetches on the detail screen (each is its own endpoint on web; skipped here to keep
  the detail screen to one request), document upload/list.

**Approvals inbox** — complete for this pass. One screen, four independent sources, each gated on
its own module+permission so a session only ever queries what it can act on:
- **HR leave requests** (`hr.leaves.approve`) — `GET /api/hr/leaves?status=pending`, approve /
  reject (optional notes).
- **Purchase requisitions** (`purchase.approvals.approve`) — approve / reject (reason required,
  matches the backend's non-nullable `Reason` field).
- **Sales returns** (`sales.returns.approve`) — approve / reject (no reason field on this one —
  the backend endpoint doesn't take one).
- **Payroll runs** — the one cross-permission source: `hr.payroll.approve` surfaces `draft` runs
  to Process and `finance_approved` runs to Pay; `finance.payroll.approve` (a Finance-only key,
  deliberately separate — CLAUDE.md Module 44) surfaces `processed` runs to Approve. Reject is
  offered only where the backend actually allows it (`draft`/`processed`, never `finance_approved`
  — `RejectPayrollRunHandler` refuses that transition).
- Pull-to-refresh re-fetches every enabled source at once. A caller with no approval permission in
  any module gets a plain "nothing to approve" screen rather than an empty inbox that looks broken.
- **Explicitly out of scope**: no detail/drill-in screen (each source's fields are shown inline in
  its row — none of the four needed more than that for a first pass), no push notification on a
  new pending item (see "Next module" below), no batch/bulk approve.

**Inventory (product/stock lookup)** — read-only for this pass, a warehouse/field-staff use case:
- Products: search, low-stock filter, infinite scroll, pull-to-refresh.
- Product detail: price/tax/stock stats, description, per-warehouse on-hand quantity (each row
  flagged when it's below that warehouse's reorder level).
- Gated on `inventory.stock.view`. **Explicitly out of scope**: create/edit, activate/deactivate,
  barcode scanning (the backend has a lookup-by-barcode endpoint; no camera/scanner UI built yet).

**Sales (orders + quotations)** — orders reuse Purchase's pre-CQRS pattern; quotations are the
richer CQRS feature (Module 51) with only read + the safe workflow actions surfaced, never the
full section/item document editor:
- Orders: status filter chips, detail with line items/totals, Confirm/Cancel on a pending order.
- Quotations: status filter chips, detail with delivery trail (sent/viewed/responded) and the
  optional-lines total, Send/Resend, Respond (record an off-platform accept/decline with an
  optional comment), Convert to Order once accepted — each calling the matching backend endpoint,
  never a raw status PATCH.
- Gated on `sales.orders.view` / `sales.quotations.view`. **Explicitly out of scope**: creating or
  editing a quotation/order (no section/item builder — that's the most complex screen on web),
  the public share-link management, invoice linking.

**Purchase (vendors + purchase orders)** — same pre-CQRS tech debt as Sales orders on the backend
(CLAUDE.md Module 5p), read-only from the client's perspective either way:
- Vendors: search, detail with call/email quick actions, rating, payment terms, order count.
- Purchase orders: status filter chips, detail with line items/totals, "Send to Vendor" on a draft.
- Gated on `purchase.vendors.view` / `purchase.orders.view`. **Explicitly out of scope**: Receive
  (GRN) and Return — both need a multi-line wizard on web; creating a vendor or a PO.

**Finance (invoices + expenses)**:
- Invoices: status filter chips, detail with line items/totals, Send (draft) / Mark Paid
  (sent/overdue/partial).
- Expenses: status filter chips, a submission form (title, category chips, amount, date
  defaulting to today via a dynamic `TODAY` constant, optional paid-by/payment-method/
  reference/notes), read-only detail (approve/reject for expenses already lives in the
  cross-module Approvals inbox, not duplicated here).
- Gated on `finance.invoicing.view` / `finance.expenses.view` (create additionally needs
  `finance.expenses.create`, checked before showing the "+ New" header button).
- **Explicitly out of scope**: invoice creation/editing, receipt-photo attach on an expense
  (would need `expo-image-picker`, a new dependency — flagged, not added), PDF download/view.

**Finance (accounts + banking)** — read-only, a "check a balance" use case, not an editor:
- Chart of Accounts: summary tiles (assets/liabilities/equity/net profit), search, account-type
  filter chips (built from the data itself, same pattern as the HR department filter), show-
  inactive toggle.
- Bank Accounts: account cards (balance/available balance/status) + a banking summary row →
  account detail (balance stats, IBAN, account number) → paginated transaction list
  (infinite scroll) with Reconcile as the one write action wired up.
- **Permission keys are a named assumption, flagged in code** (`FINANCE_ACCOUNTING_VIEW`/
  `FINANCE_BANKING_VIEW` in `finance.api.ts`) — grepping the web app found live `.create`/`.edit`
  gates but no `.view` gate anywhere in the accounting/banking UI; page access there is gated only
  by the `finance` module guard, not a granular read permission. Rather than guess a `.view` key
  that might not actually exist on the backend (which would hide the feature from *everyone*,
  admins included, if wrong), these two screens are shown to anyone who already reached the
  Finance tab (which already proves module access) — matching the web app's own confirmed
  behavior, not a stricter invented rule.
- **Explicitly out of scope for this pass**: account/bank-account create or edit (both have real
  backend + web forms), transaction date-range filtering (not exposed by this list endpoint at
  all — `BankTxPageParams` has no `from`/`to`), internal transfers, budgets, journals, general
  ledger, tax/VAT, recurring invoices — the rest of the Finance module (see "Next module").

## Tab bar overflow ("More" tab)

There are up to eight module tabs (Leads/Pipeline/HR/Approvals/Inventory/Sales/Purchase/Finance)
behind Dashboard, each independently gated -- a given session usually sees far fewer, but nothing
capped how many could render directly, and React Navigation's bottom-tabs will happily lay out
nine icons in a row (not a comfortable phone UI past ~5).

- `navigation/tab-config.ts` (new) -- single source of truth for every module tab: its icon,
  label, component, permission gate, and priority order. Replaces the permission-check block that
  used to live inline in `RootNavigator.tsx` (now just `getTabLayout()`), so the tab bar and the
  "More" screen can't drift out of sync with each other.
- `getTabLayout()` splits a session's *available* module tabs (already permission-filtered) into
  `direct` (shown in the bar, alongside Dashboard) and `overflow`. Only kicks in once there'd
  actually be more than 4 module tabs -- a session with few permissions renders exactly as before,
  nothing added. Once there's overflow, the bar always shows Dashboard + 3 direct tabs + one
  "More" tab (5 total), never more, regardless of how many modules the session ends up with.
- `screens/MoreScreen.tsx` (new) -- a plain `MenuCard` list of whatever got bumped, each tapping
  through to that tab by name (`navigation.navigate(tab.key)`) exactly like tapping its own
  tab-bar icon would have. No dedicated "back to More" button on the screens it opens: the "More"
  tab is always in the bar, and since each destination is a sibling tab (not nested inside
  MoreScreen's own stack), tapping "More" again always shows this same menu, unchanged.
- Deliberately **not** a drawer nav -- every existing stack/screen/route stays exactly as
  registered; only which tabs get a visible bar button changed. Lower risk than restructuring the
  whole navigation shape for a problem that's really just "too many icons in one row."
- One known cosmetic gap: a module tab reached via "More" has no tab-bar icon of its own, so
  nothing in the bar visually shows as "active" while you're on it (a well-known limitation of the
  hidden-tab-via-sibling pattern, not fixable without a drawer or a custom tab bar -- acceptable
  for now, flag it if it reads as broken rather than just quiet).

## Next module

**Full ERP module parity is the active program** — the web app has ~25 modules across 18 nav
groups (`FrontendVite/src/config/navigation.ts`). No backend work is needed to gate whatever gets
built next — the JWT already carries the tenant's full module list and effective permission-key
set (same claims the web app reads), so extending RBAC to a new module is purely "add the
permission constants + wire `hasModuleAccess`/`hasPermission` into the new screens," exactly like
every module already here does. Queued, roughly in priority order:

1. **Rest of HR**: recruitment (job postings/candidates), performance (reviews) — employees +
   departments are done (see "What's built").
2. **Rest of Finance**: budgets, journals, general ledger, tax/VAT, recurring invoices — accounts
   + banking are done.
3. Project Management (Kanban)
4. POS (retail + restaurant — large, will likely split further)
5. Visa Services, Real Estate
6. Reports, File Manager
7. Settings (users/roles/branches/integrations/security) — admin-heavy, lower priority for a
   mobile-first surface
8. Industry verticals (b2b/education/healthcare/insurance/construction/hospitality) — niche, last

Also still queued from before: push notifications (a real "something is waiting on you" surface
already exists — the approvals inbox — but no APNs/FCM integration exists anywhere in the backend
yet), dashboard KPIs, EAS build config, per-device refresh tokens, barcode scanning for Inventory.

## Conventions carried over from FrontendVite

- Same backend envelope (`{ success, data, message, errorCode, traceId }`) and the same
  ASP.NET/FluentValidation field-error extraction, so `ApiError.fieldError(name)` works identically.
- **Not every controller uses that envelope.** `FinanceControllerBase`/`SalesControllerBase` return
  the DTO directly on success and `{ code, description }` on failure; `PurchaseOrdersController`/
  `VendorsController`/`SalesOrdersController`/`SalesReturnsController` are pre-CQRS controllers that
  return plain `Ok(dto)`/`PagedResult<T>` with no wrapper at all; Inventory/POS's `ApiResponse<T>`
  uses `{ success, data, error, errorCode }`. `api-client.ts`'s `request()` handles all of these
  transparently — enveloped or raw passes through the same code path, and the error-message
  extraction tries `detail → description → message → error → field errors → title` in that order
  (mirrors web's `rawApiClient` exactly) so a failure from any of them still shows something useful.
- Same JWT claim names (`tenant_id`, `tenant_name`, `modules`, `permission`, `currency`, …) —
  `permission` claims are read directly rather than re-derived from roles+overrides, since the
  backend's `PermissionRepository` chokepoint (CLAUDE.md Module 5h) already computes the effective
  set into the token.
- Same three-tier CRM permission pattern (`RequireAnyPermission` on the backend) mirrored via the
  `CRM_LEADS_VIEW`/`CRM_PIPELINE_VIEW` etc. constants in `crm.api.ts`; HR self-service uses a
  flatter per-feature `hr.self.*` pattern with no tiers (`HR_SELF_*` in `hr.api.ts`).
- `@/*` → `src/*` path alias, same as the web app (via `babel-plugin-module-resolver` here, since
  Metro doesn't read `tsconfig.json` paths on its own).
