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
    HomeScreen.tsx       — real cross-module KPI dashboard (see "Dashboard KPIs" below) + the
                          2FA-enrollment nudge banner + workspace/plan info + sign out
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
- **Bug fixed (reported: opened the assistant and had no way back — no close button visible, no
  tab bar since the modal covers it)**: `AiAssistantScreen` is presented as a raw RN `<Modal>`, not
  a React Navigation screen, so unlike every tab/stack screen (whose header React Navigation
  already keeps clear of the status bar for free) it got no safe-area handling of its own. The
  Modal's `presentationStyle="pageSheet"` masked this on iOS (that presentation style handles its
  own safe area natively), but the prop is **iOS-only** and silently ignored on Android, where the
  modal draws truly edge-to-edge — the header, and its only close ("x") button, rendered right
  under the status bar, unreachable. Fixed by reading `useSafeAreaInsets()` and adding
  `insets.top` to the header's padding (and `insets.bottom` to the input row, so the keyboard
  toolbar clears the home indicator too). `NotificationsScreen.tsx` below shares the exact same
  Modal pattern and got the identical fix in the same pass, before it could surface the same bug.
  Every other `<Modal>` in the app (`MovePickerModal`, `RecordPaymentModal`, the visa/real-estate/
  restaurant confirm dialogs) is a small `transparent` centered overlay, not a full-screen page
  sheet with its own header competing with the status bar — confirmed unaffected.

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

**HR recruitment (job postings + applicants)** — gated `hr.recruitment.*`, independent of both
self-service and the directory above:
- Job postings: paginated list (real `page`/`pageSize`/`status` query params — the web app
  over-fetches with `pageSize=500` and filters client-side despite the backend supporting real
  paging; mobile uses the real thing to avoid pulling a tenant's full history over a mobile
  connection, here and in Performance below) + status filter chips (defaults to Open) + summary
  stats → detail screen (description/requirements/responsibilities/salary range/headcount) with
  status-transition buttons (draft→open→on_hold/closed) and the job's own applicant list.
- Applicant detail: contact quick actions, a visual pipeline (applied→screening→interview→
  offer→hired) with "Move to next stage" / "Reject" — mirrors the web drawer's own two actions
  rather than exposing the backend's "jump to any stage" flexibility.
- **Backend DTOs carry `headcount`/`responsibilities`; the web app's own TypeScript type silently
  drops both** (confirmed by reading the backend record directly, not just the frontend client) —
  mobile's `JobPostingDto` includes them rather than copying that gap forward.
- **Explicitly out of scope**: job/applicant create, resume viewing (would need an authenticated
  file fetch + a viewer — flagged, not built; a "resume on file" badge is shown instead), delete.

**HR performance (reviews + goals)** — gated `hr.performance.*`:
- Reviews: paginated list + status filter chips + summary stats (incl. average rating) → detail
  screen with Start Review (pending→in_progress) and Complete Review (five 1–5 star pickers —
  overall/technical/communication/teamwork/leadership — plus strengths/improvements text, mirrors
  the web drawer's own fields exactly) flows.
- Goals: inline progress (±10% steppers) and status editing per goal, with a progress bar. **Goal
  create/delete are explicitly out of scope** — only `updateGoal` is wired up; adding/removing
  goals isn't built.
- **No seeded `hr.performance.delete` permission exists** (confirmed in `PerformanceController.cs`'s
  own code comment) — delete and every goal action ride on `.edit`, mirrored in
  `hr-performance.api.ts`'s constant naming.

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
- **Barcode scanning** — a "Scan" header button opens a full-screen `expo-camera` `CameraView`
  (the one new native dependency added in this pass, since it's a genuine capability gap a phone
  camera fills that the earlier "avoid new native deps" calls elsewhere didn't apply to — there's
  no software substitute for a camera) recognising EAN-13/EAN-8/UPC-A/UPC-E/Code128/Code39/QR,
  calling the same `GET /products/barcode/{barcode}` endpoint the product search bar's placeholder
  text already referenced. A successful scan replaces straight into Product Detail; a miss re-arms
  the camera with an inline error rather than bouncing back to the list, since the likely next
  action is "try again" (bad angle, damaged label), not "give up." A **manual entry fallback**
  (type the digits) covers a camera-permission denial and a barcode the scanner genuinely can't
  read. Camera/microphone permission strings are in `app.json`'s `expo-camera` plugin config;
  `recordAudioAndroid`/`microphonePermission` are both disabled since barcode scanning needs
  neither.
- Gated on `inventory.stock.view`. **Explicitly out of scope**: create/edit, activate/deactivate.

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
  all — `BankTxPageParams` has no `from`/`to`), internal transfers.

**Finance (budgets, journals, tax/VAT, recurring invoices)** — same read-focused posture, same
"no confirmed `.view` key, shown to anyone who already reached the Finance tab" reasoning as
accounts/banking above (`finance-ledger.api.ts` carries the same comment):
- Budgets: paginated list + status filter chips + summary tiles, inline status-change buttons
  (Approve/Activate/Close — `POST /budgets/{id}/status`, the one generic action covering what
  would otherwise be three separate endpoints). **No detail screen**: the backend has no
  `getBudgetById` and no line-item endpoint — the list DTO (name/period/status/variance/
  `lineCount`) is the entire record on the client side.
- Journals: paginated list + status/period filter + summary → detail screen showing the full
  debit/credit line table and Post/Void actions. **No second fetch on open** — `GET /journals`
  already embeds `lines[]` per entry (there is no `GET /journals/{id}`), so the whole row is
  passed through navigation params.
- Tax/VAT: period list (File/Pay inline actions once a period is Open/Filed) + summary tiles →
  tapping a period fetches its transactions (`GET /tax/transactions?period=` — a period is
  required; omitting it reads every invoice/bill the tenant has ever issued, per a comment in the
  web client itself).
- Recurring Invoices: paginated list + active-only filter + summary → detail screen (same
  "list DTO already has `lines[]`, no second fetch" pattern as Journals) with Pause/Resume/
  Generate Now wired up. `runDueRecurring` (a bulk cron-style trigger, not a single-template
  action) is deliberately not exposed on mobile.
- **General Ledger (trial balance, account ledger) and Financial Statements (P&L, Balance Sheet,
  Cash Flow) are deliberately not built in this pass.** Trial balance returns every account as a
  flat, unpaginated array with four numeric columns — a literal port of the web table would be
  illegible on a phone; account ledger has the same wide-table problem (date/ref/debit/credit/
  running balance). Financial Statements are more tractable (grouped `{code, name, amount}[]`
  lines, closer to Budgets' shape) but still deferred to keep this pass to the areas that map
  cleanly onto a phone screen as-is. Flagged as a real gap, not silently dropped — see the
  complexity note in "Next module".

**Project Management (Kanban)** — gated `project-management.projects.*`. Web splits this into 4
routes (project list, board, backlog, issues) sharing a pill-tab strip; mobile mirrors it as a
project home screen with `MenuCard` entries into those same 4 destinations, matching the "home
screen with menu cards" pattern every other module's home screen already uses, rather than a tab
strip in the header:
- **The project list needs no client-side scoping** — `GET /projects` is already filtered
  server-side to the caller's own project memberships unless they're a super admin or hold
  `project-management.projects.delete` (the "admin bypass" — `ProjectAccessGuard.cs`). No "my
  projects" vs "all projects" toggle exists or is needed.
- Board: columns render as horizontally-scrollable panels (the `backlog`-category column is
  hidden here, same as web — it's the Backlog screen's own target), each a vertical list of
  `IssueCard`s (shared with Backlog and the Issues list — `components/project-management/
  IssueCard.tsx`).
- Backlog: one section per non-completed sprint (Start/Complete buttons per sprint's lifecycle)
  plus a Backlog section for unsprinted issues. Completed sprints are excluded entirely, same as
  web — there's no sprint-history screen on either client.
- **No drag-and-drop — a tap-triggered move picker instead.** The web app disables its own
  drag-and-drop entirely (not just visually) when the caller lacks `issues.edit`; dragging doesn't
  translate to touch the same way regardless. Each card's "···" button opens
  `MovePickerModal` (a bottom sheet) listing destination columns/sprints, calling the exact same
  `move`/`move-to-sprint` endpoints the web app's drag handler calls (`sortOrder: 0` — always
  prepends; the web app itself only reorders within one flat list per container, so exact
  drop-position precision isn't essential here either).
- Issue detail: full field set (title/description/type/priority/assignee/story points/due date),
  editable fields gated on `issues.edit`, a sprint-move quick action (reuses `MovePickerModal`),
  and a comment thread (add gated on `issues.create` — comments have no distinct permission key
  on the backend, confirmed by grep). **Backend `IssueDto`/`JobPostingDto`-style gap avoided
  deliberately**: the web app's own recruitment TS type silently drops `headcount`/
  `responsibilities` that the backend actually returns (see the Recruitment section above for the
  same pattern) — checked Project Management's DTOs against the backend directly rather than
  trusting the frontend client's shape uncritically.
- Members: read-only list (name, email, role badge) — add/remove/role-change are admin tasks
  better suited to the web app's own members modal.
- **Explicitly out of scope for this pass**: issue/project create, label editing (labels show as
  read-only chips on the issue detail), epic linking, delete (issue or project), the quick-add-
  issue inline input the web board has at the bottom of each column, CSV/PDF export from the
  Issues list.

**POS — deliberately scoped as "manager visibility," not a checkout terminal.** Every other
module in this app is a mobile-appropriate *subset* of its web equivalent; POS on web is a full
point-of-sale terminal (cash drawer, receipt printer, barcode scanner, live checkout), and there
is no sensible mobile subset of *that* — a phone isn't a cash drawer. Before building anything,
checked how this codebase already answers the analogous question: CLAUDE.md's Module 49 (AI
Assistant) explicitly excludes POS sale/void/refund/session-open/close from the assistant's
toolset with the reasoning **"those move cash in a physical drawer against an open shift and
belong at the terminal."** That reasoning applies identically here, so mobile POS is built as the
thing a phone is actually good for: checking status on the go.
- Home screen: today's dashboard (total sales, transaction count, payment-method mix — `GET
  /transactions/dashboard`, which is itself terminal-timezone-aware: it sends the device's own
  local date + UTC offset, mirroring the web client's exact calculation, so "today" means the
  viewer's own day rather than UTC's) + a live list of every currently-open shift (`GET
  /sessions/active`, auto-refreshed every 60s) → shift detail (opening/expected/closing cash,
  variance, cash pay-in/pay-out movements, that shift's transactions).
- All transactions: paginated, searchable, filterable by type (Sale/Refund/Void) → transaction
  detail (line items, totals, payments, change given).
- Gated on any of `pos.sessions.view` / `pos.transactions.view` / `pos.reports.view` — confirmed
  these are genuinely separate from the void/refund/session-management keys
  (`pos.transactions.void/refund/discount`, `pos.sessions.create/approve`), so "read-only manager
  visibility" is an access-control boundary the backend already draws, not one invented for mobile.
- **Deliberately not built, on purpose, not just "not yet"**: any checkout flow (cart, barcode
  scan, take payment), opening/closing/suspending a shift, voiding or refunding a transaction,
  cash pay-in/pay-out entry, receipt printing. All of these need real hardware (scanner, printer,
  cash drawer trigger) a phone doesn't have anyway, on top of the "shouldn't happen off the
  terminal" reasoning above. POS Customers (a distinct resource from CRM customers — loyalty
  points, wallet balance, house-account credit) is a plausible small follow-up flagged, not built.

**Restaurant POS — "front-of-house + kitchen coordination," not an order-taking terminal.** Same
scoping question as retail POS above, applied to a genuinely bigger backend surface: the web app's
`Softaxis.Restaurant` service has grown well past what CLAUDE.md's Module 19 series documents (20
controllers now, including combos, courses, receipts, printer profiles, delivery, drivers, happy
hour, device registration, and 5 role-scoped web dashboards from an undocumented "Epic 8" pass) —
confirmed by reading the controllers directly rather than trusting the doc's Module 19f as current.
Order-taking itself (structured modifiers, combos, courses, split-bill, tips, discounts, payment)
is real desktop-appropriate complexity — the same call already made for retail POS's checkout flow
— so **Restaurant orders on mobile are read-only**, same posture as POS transactions. Two areas get
real write actions anyway, because they don't touch cash or a physical drawer at all: marking a
kitchen ticket item's prep status (the KDS re-exposed for a phone/tablet on the pass — mirrors
`KitchenController`'s own code comment that the KDS marks orders ready "without going through the
order-drawer UI"), and seating/cancelling a reservation or walk-in.
- Home screen: today's owner-dashboard tiles (sales, orders, active) + a live floor-status strip
  (available/occupied/reserved/cleaning, from `GET /dashboard/branch`, refetched every 60s) + menu
  cards into the five sections below — each only rendered if the session holds that section's key.
- Tables: status summary tiles (occupancy %, covers, table count) + filterable list (by status),
  each row showing capacity and the current waiter if occupied. Read-only — the floor-plan
  designer (create/edit/reposition/merge tables) is desktop-appropriate, same call as Inventory's
  product create being out of scope.
- Live Orders: status filter chips + summary tiles (today's orders/revenue/tips) → order detail
  (items with modifiers and per-item prep status, payments, active discounts, refunds, split
  children) — **no action buttons anywhere on this screen**, matching POS Transactions' own
  read-only stance exactly.
- Kitchen: the one screen with real write actions. Active-ticket cards (table, waiter, wait
  minutes, one row per item) with a one-tap "Mark {next status}" button per item
  (pending→preparing→ready→served, via `PATCH /kitchen/items/{id}/status`) and a "Mark whole order
  ready" button per ticket (`PATCH /kitchen/orders/{id}/ready` — the same command
  `OrdersController.MarkReady` uses). Gated on `restaurant.kitchen.edit`; view-only without it.
- Reservations: Today/All toggle (`GET /reservations?date=`) + summary tiles → Seat/Cancel on a
  `confirmed` reservation, phone number shown for a quick call. No create-reservation form (a
  10+ field form with slot-duration/deposit rules — desktop-appropriate, same call as HR
  employee-create).
- Waitlist: status filter chips (defaults to Waiting) + summary (waiting count, average quoted
  wait) → Seat (opens a bottom-sheet table picker filtered to `available` tables, since
  `SeatWaitlistEntryCommand` requires a table id — unlike reservation-seat, which doesn't) /
  No-show / Cancel on a `waiting` entry.
- Gated on any of `restaurant.reports.view` (dashboards) / `.tables.view` / `.orders.view` /
  `.kitchen.view` / `.reservations.view` at the tab level — each screen re-checks its own specific
  key, same "any-of at the tab, specific inside" pattern as POS and Approvals. Waitlist has no
  dedicated permission group on the backend (`WaitlistController`'s own code comment) and rides on
  the `restaurant.tables.*` keys, same nearest-seeded-key convention used elsewhere in this codebase.
- **Deliberately not built, on purpose**: order creation/editing (menu browsing, modifiers,
  combos, courses), payment/split-bill/tips/refunds, table floor-plan design (create/edit/
  reposition/merge/QR codes), reservation rules configuration, the 5 role-scoped web dashboards
  beyond Owner/Branch (Kitchen dashboard folded into the Kitchen screen's own summary tiles
  instead of a separate fetch; Cashier and Inventory dashboards are POS/stock concerns already
  covered by their own tabs), delivery orders/zones/drivers, happy hour, combos, printer profiles,
  device registration, notification config — all genuinely separate sub-features of this service,
  none of them a mobile-appropriate subset on their own.

**Visa Services** — case management for a UAE visa consultancy, gated on the single
`visa.cases.*` permission group that exists on the backend:
- Home: dashboard tiles (open/overdue/due-this-week cases, open fees) + a 30-day renewal banner +
  menu cards into Cases and Renewals.
- Cases: search + status filter chips + summary tiles → case detail (applicants, a document
  checklist, notes/timeline, reassignment) with the one real workflow surface in this module —
  **status transitions only ever offer a legal move**, via the exact same `CASE_TRANSITIONS` map
  `FrontendVite/src/lib/visa/visa.api.ts` uses to drive its own UI, so mobile can never propose a
  move the backend's status machine would reject. `rejected` prompts for a reason, `submitted` for
  an optional government reference, `issued` for the visa expiry date — mirrors the web drawer's
  own inline modals. Tapping a document opens a status picker (pending → received → verified →
  rejected → expired).
- Renewals: a 30/60/90/180-day window toggle + kind filter (visa/passport/document expiries),
  sorted most-urgent-first, each row opening straight into its case.
- Gated on `visa.cases.view`; every write (status change, document update, note, reassign) needs
  `visa.cases.edit`, checked in the case-detail screen itself, not just the tab.
- **Deliberately not built**: case creation (visa type + fee prefill + a dynamic
  applicant/dependent list) and the government-channel connection screen (encrypted credentials,
  per-provider setup guides) — both desktop-appropriate, same call as Sales/Purchase order
  creation. Invoice linking (the frontend-orchestrated Finance handoff) is a cross-service write
  with no natural mobile trigger and is left out too.

**Real Estate** — portfolio browsing + rent collection, not a leasing back-office. Property/
unit/tenant/contract *creation* are all real multi-field forms (a contract create alone picks a
property → vacant unit → tenant and can seed an advance-rent schedule) — desktop-appropriate,
same call as every other module's order-creation screen. What's genuinely mobile-native: checking
occupancy, looking up a tenant or lease, and the rent-collection actions a property manager
does away from a desk.
- Home: occupancy + overdue/due-this-month tiles + menu cards into the six sections below, each
  only rendered if the session holds that section's key.
- Properties: search + status filter (available/partially occupied/fully occupied), infinite
  scroll, summary tiles → property detail (location, market value, occupancy, its nested unit
  list) — read-only, no floor-plan editing.
- Units: cross-property browse with a status filter (vacant/rented/sold/maintenance) — no detail
  screen, a unit's full record already fits its row (same call as Restaurant's Tables screen).
- Tenants: search + status filter, infinite scroll → tenant detail (contact info, compliance
  fields, notes, call/email quick actions) + that tenant's own lease history
  (`GetContractsQuery(tenantId=)`, a real server-side filter, not a client-side one). **No `GET
  /tenants/{id}` exists on the backend** — the list row already carries every field the detail
  screen shows, so the whole `TenantDto` is passed through nav params instead of a second,
  nonexistent, fetch (same pattern `FinanceStackParamList`'s `JournalDetail` already uses).
  Brokers has the identical gap (no `GET /brokers/{id}`) and gets the same treatment.
- Contracts: status filter (active/expired/terminated/renewed), overdue-first sort, summary tiles
  → contract detail (lease terms, deposit, the full rent installment schedule) with **Record
  Payment**, **Waive**, and **Send Reminder** on each unsettled installment.
- Rent Due: the cross-lease chase queue (`GetRentDueQuery`, overdue always first) with a
  7/14/30/60-day window toggle and the same Record Payment / Remind actions inline, so working the
  queue doesn't require opening each contract in turn — tapping a row still opens the full
  contract for context. **Record Payment and Remind are genuinely separate permission keys**
  (`real-estate.rent.record` / `.rent.remind`) from viewing (`.rent.view`) and from editing the
  lease itself (`.contracts.edit`) — "the person who takes a cheque at the counter is rarely the
  person allowed to change the rent" (`ContractsController`'s own comment) — both gates are
  checked independently in the UI, not folded into one.
- Brokers: search, infinite scroll, summary tiles → broker detail (license, rating, commission,
  call/email quick actions).
- **Deliberately not built**: any create/edit/delete on properties, units, tenants, contracts, or
  brokers; rent-alert settings/logs (an admin config screen, same priority tier as Settings);
  the CRM-linked sales pipeline (site visits → reservations → bookings + payment plans, its own
  `real-estate.sales.*` permission group) — a separate sub-feature big enough to need its own
  scoping pass, same as Restaurant's delivery/happy-hour features were left out.

**Reports** — the generic tabular report engine (POS + Inventory), not the CRM analytical reports.
`FrontendVite/src/modules/reports/config/report-registry.ts` defines 44 reports across three
categories (19 POS, 17 Inventory, 8 CRM); this covers the 36 POS/Inventory ones, all genuinely
runnable, not a trimmed-down subset:
- **CRM's 8 reports are excluded entirely.** They're analytical (funnels, win/loss trends, forecast
  rollups) — the web registry itself gives them `href` deep links into the CRM module instead of
  the tabular runner, because flattening them into `{rows, totalCount}` would throw away the thing
  that makes them readable. There's no CRM reports screen on mobile to deep-link into, so they're
  left out rather than half-built.
- **Filter fidelity, verified by reading the web runner's own code, not assumed**: its
  `buildApiParams()` switch only forwards twelve keys to the backend (`dateRange` as `from`/`to`,
  `paymentMethod`, `status`, `taxPeriod`, `valuationMethod`, `fiscalYear`, `movementType`,
  `itcStatus`, `writeOffReason`→`fromProvince`, `idleDays`, `expiryWindow`→`expiryWindowDays`) —
  every other filter the web registry *displays* (cashier/warehouse/category/branch pickers,
  `invoiceType`, `fbrstatus`, `filerStatus`, `serviceType`, `recoverable`, `urgency`) is rendered
  but never actually reaches the API today, confirmed against the switch statement itself, not
  inferred. `lib/reports.api.ts`'s trimmed registry reproduces only the twelve that work, so mobile
  filters exactly as effectively as web — nothing lost by leaving the rest out.
- Hub: search + two category sections (POS/Inventory, each only shown if the tenant has that
  module — confirmed neither `ReportsController` nor `InventoryReportsController` carries a
  `[RequirePermission]` at all, just `[Authorize]`, so module access is the only real gate on
  web too) filtered to the tenant's resolved country (`resolveCountryCode`, ported from the web
  hub's own function) plus universal reports — country is derived, never user-selectable, same as
  web.
- Runner: date range (two `YYYY-MM-DD` text inputs, defaulting to the last 30 days like the
  backend's own default) + the report's one functional select/number filter, if it has one, as
  Chips or a numeric input → Run → a horizontally-scrollable table (`columns`/`rows`/`totalCount`
  come back identically shaped from both services). Capped at 200 rendered rows with a "narrow the
  date range for the rest" hint rather than paginating — the same "keep it readable on a phone"
  call CLAUDE.md made deferring Trial Balance/Financial Statements entirely from Finance, except
  here the report is fully runnable and the cap is only a rendering limit, not a missing feature.
- **Deliberately not built**: CSV/Excel/PDF/XML export (all four formats the web registry lists
  per report), the cashier/warehouse/category/branch pickers (would need their own lookup-list
  fetches for filters that don't do anything server-side yet anyway, per the fidelity note above).

**File Manager** — browses the CRM document library, the only document store that exists anywhere
in this codebase today (HR holds a single receipt blob per expense, Visa's `CaseDocument` stores a
URL not a file, every other module has no file storage at all — CLAUDE.md Module 26). One screen,
no stack, same as Approvals:
- `GET /api/crm/documents/library` — the tenant-wide search endpoint, already owner-scoped
  server-side by the caller's CRM access tier (an assigned-only rep sees only their own documents;
  a team lead their team's; an admin everything) — mobile does no scoping of its own, it only lays
  out what the API already returned, same principle CLAUDE.md's File Manager module states for web.
- Search (flattens the folder grouping while typing — finding a file by name shouldn't require
  knowing which owner's folder it's in, same call web's File Manager makes) + a related-record-type
  filter (Lead/Opportunity/Account/Contact) + a document-type filter built from whatever categories
  are actually present in the results (same pattern as HR's department filter chips).
  Grouped by owner when not searching, the signed-in user's own folder sorted first.
- Gated on `file-manager.view` for the tab itself, and separately on holding a view tier in any of
  `crm.leads/.pipeline/.customers` (all three — a document can hang off a lead, an opportunity, or
  an account) for whether the library actually has anything to show. A `file-manager.view` holder
  with no CRM access opens the tab and sees "no document libraries available to you yet" rather
  than the tab disappearing outright — same split web's Module 35 fix established.
- **Deliberately not built**: download or in-app preview (the content endpoint streams raw bytes
  with `Content-Disposition: attachment`, not JSON — reading it authenticated from a phone needs
  `expo-file-system`/`expo-sharing`, new native dependencies not added in this pass, same call
  already made for HR's payslip PDF and Finance's receipt-photo attach), upload (there's no generic
  upload target on web either — documents attach from a record's own Documents tab), and
  edit/delete of a document's metadata.

**Settings — "My Account" only, not the admin console.** Web's Settings covers users/roles/
branches/integrations/general company settings — a permission-matrix editor and several real
multi-field admin forms, desktop-appropriate the same way every other module's admin surface has
been left out of this app. What's genuinely mobile-native, and what this covers instead, is the
signed-in user's own account:
- Profile — view name/email/username/phone, Edit toggles inline fields (`GET`/`PUT
  /api/auth/me`).
- Change Password — current + new + confirm, server-side policy errors (length/complexity/
  history) surface as-is rather than being re-validated client-side.
- Two-Factor Authentication — status (enabled + backup codes remaining), a full enroll flow
  (`POST .../setup` → QR image rendered straight from the returned `data:image/png;base64,...`
  via `<Image>`, no new dependency → confirm code → one-time backup codes shown once, selectable
  for copy), and disable (requires a current code). Mirrors the web flow exactly (CLAUDE.md
  Module 14).
- **Gated on nothing at all** — confirmed by reading `AuthController`/`TwoFactorController`
  directly (`[Authorize]` only) and `App.tsx`'s own routing comment ("2FA is the signed-in user's
  own account, so it needs no permission at all"). Every session sees this tab regardless of
  module subscriptions; it's placed last in `MODULE_TAB_ORDER` so it never crowds out an actual
  work tab and simply falls into "More" once a session has anything else.
- **Closed a real dead-code gap while here**: `AuthTokenDto.mustSetUpTwoFactor` ("the tenant now
  requires 2FA and this account hasn't enrolled" — the session stays valid, blocking would lock
  out everyone the moment an admin flips the requirement on) was declared on the type since an
  earlier pass but never read anywhere. `HomeScreen` now shows a dismissible banner when it's set,
  with a "Set up now" button that jumps straight to this tab — the ephemeral flag (not persisted,
  same as `mfaToken`) is cleared on tap.
- **Deliberately not built**: users/roles/permissions-matrix, branches, integrations
  (OAuth + encrypted-credential setup guides), general company settings (logo, currency, tax
  number) — all real desktop-appropriate admin surfaces, same complexity class as the Reports
  module's cashier/warehouse pickers or Real Estate's contract-creation form. Avatar upload
  (would need `expo-image-picker`, a new dependency — same call as Finance's receipt-photo
  attach).

**Industry Verticals (B2B, Education, Healthcare, Insurance, Construction, Hospitality)** — six
tabs, but niche in practice: a tenant picks one industry pack at onboarding, not several, so at
most one or two of these ever show for a given session despite the long list in
`MODULE_TAB_ORDER`. Read-only browse for every one of them except Hospitality's two genuinely
mobile-native workflow actions:
- **B2B / Education / Healthcare / Insurance share one generic engine.** All four live in the CRM
  assembly (`Softaxis.CRM.API`) and follow an identical shape — confirmed by reading all four
  controllers directly, not assumed: `GET /{feature}?status=&search=&page=&pageSize=` returning
  `{items,page,pageSize,totalCount,totalPages}`, create/status-edit/delete all deferred (real
  multi-field forms, same call as everywhere else). Rather than four sets of near-duplicate list
  screens, `hooks/use-vertical-list.ts`'s `usePagedVerticalList` centralizes the infinite-scroll +
  search + status-filter state machine once, and `components/verticals/PagedListView.tsx` owns the
  shared chrome (search bar, status chips, pull-to-refresh, empty/error states) — each of the
  twelve concrete list screens (3 sub-features × 4 packs) is ~60 lines: a query hook call, a
  row renderer, and a `<PagedListView>`.
  - B2B: Proposals → Service Contracts (AMC/SLA/Retainer) → Support Tickets.
  - Education: Admissions → Students → Enrollments (with fee balance shown per enrollment).
  - Healthcare: Patients → Appointments → Treatment Plans.
  - Insurance: Policies → Renewals → Claims.
  - **Status badges use a keyword heuristic** (`lib/verticals-shared.ts`'s `guessStatusTone` —
    "cancel"/"reject"/"expired" → destructive, "complete"/"approved"/"active" → success,
    "pending"/"draft"/"open" → warning, else neutral) rather than a hand-enumerated status map per
    entity. Twelve exact status vocabularies would be a lot of domain-reading for a read-only
    badge with no write action riding on it being exactly right — unlike Visa's `CASE_STATUS_TONE`
    or Restaurant's `ORDER_STATUS_TONE`, which gate real status-transition buttons and do need to
    be exact. Status filter chips are likewise built from whatever values are actually present in
    the loaded page (same pattern as File Manager's document-type filter), not a guessed list.
- **Construction** (its own microservice) — Projects, Sites, Contractors, BOQs, all confirmed
  non-paginated `GetAll` (no controller here takes `page`/`pageSize`) and with no
  `[RequirePermission]` at all (`[Authorize]` only) — gated on module access alone. Client-side
  search + status filter over the full result set, same reasoning as Hospitality's Rooms below.
  **The CRM-linked bidding lifecycle** (`ConstructionSalesController`'s RFQs → Estimates →
  Contracts) is a separate sub-feature, deferred — same call as Real Estate's CRM-linked sales
  pipeline.
- **Hospitality** (its own microservice, also no `[RequirePermission]` anywhere) — Rooms
  (read-only, non-paginated, mirrors Restaurant's Tables screen), Bookings (paginated, **Check In**
  / **Check Out** wired to the real `PATCH .../checkin` / `.../checkout` endpoints — an
  unambiguous two-state front-desk action, not a status field needing a guess), Housekeeping
  (paginated with an extra task-type filter, **Start** / **Mark Complete** / **Verify** wired to
  their own endpoints — a housekeeper walking room to room with a phone is exactly the "workflow,
  not cash" case CLAUDE.md's Module 49 draws the line at, same reasoning already used for
  Restaurant's kitchen tickets and Real Estate's rent collection).
- **Deliberately not built anywhere in this section**: creation forms for any of the twelve
  CRM-vertical sub-features, room/booking/task creation, detail screens (every row already shows
  its own record's full field set, same call as Restaurant's Tables and Real Estate's Units), and
  Construction's bidding pipeline.

## Dashboard KPIs

`HomeScreen.tsx`'s "Overview" section replaces the old session-diagnostics placeholder with real
cross-module KPI tiles — one compact card per module the signed-in user actually has access to,
reusing the same summary/dashboard hooks and endpoints every other screen in this app already calls.
No new aggregation endpoint was built for this (in contrast to `FrontendVite`'s heavier client-side
dashboard aggregation, which its own `CLAUDE.md` Module 13 flags as "an approximation for large
tenants") — the one exception is CRM, described elsewhere in this codebase as the module the mobile
app was built around first and the most field-usable one, which had a real `GET /api/crm/dashboard`
endpoint that had simply never been wired into mobile before now (`crmApi.getDashboard` +
`useCrmDashboard`, new `CrmDashboardSummaryDto` trimmed to the scalar totals the endpoint returns).

Every tile is gated behind the exact same `hasModuleAccess`/`hasPermission` checks each module's own
tab-config.ts entry uses, and every underlying hook takes an `enabled` flag so a query never fires for
a module the user can't see (`useCrmDashboard`, `useHrSummary`, `useAccountingSummary`,
`useBankingSummary`, `usePosDashboard`, `useOwnerDashboard` (Restaurant), `useVisaDashboard`,
`usePropertiesSummary` + `useContractsSummary` (Real Estate), `useB2BSummary`, `useEducationSummary`,
`useHealthcareSummary`, `useInsuranceSummary`, `useProjectsSummary` (Construction), `useRoomsSummary` +
`useBookingsSummary` (Hospitality) — the last four already existed from the Industry Verticals pass
and are simply given a headline card here). Finance's Accounting and Banking summaries are combined
into one card via a small local `combineQueries` helper; Real Estate and Hospitality get their own
bespoke two-query cards (`RealEstateKpiCard`/`HospitalityKpiCard`) since either query can be present on
its own rather than requiring both. Money tiles render through the shared `formatCompactValue(value,
currency)` helper (from `crm-helpers.ts`) so large figures stay compact ("AED 1.2M") the same way they
do everywhere else in the app.

- **Deliberately excluded**: Sales, Purchase and Inventory have no tenant-wide summary/totals
  endpoint on the backend (confirmed by the same controller audit done for their own module sections
  above — only per-row list DTOs exist), so there's nothing to reuse and no aggregation was built for
  them here. Finance's Budgeting/Journals/Tax/Recurring-invoices summaries are left out too — Finance's
  card is deliberately just the two headline summaries (Accounting + Banking), not every sub-ledger.
  A local `SimpleQuery<T>` structural-typing interface (not the full `UseQueryResult<T>`) backs the
  shared `KpiCard`/`combineQueries` components — real query results are passed in directly with no
  wrapping, since they're already structurally compatible.

## Tab bar overflow ("More" tab)

There are up to twenty-two module tabs (Leads/Pipeline/Approvals/HR/Projects/Sales/Purchase/
Inventory/Finance/POS/Restaurant/Visa/RealEstate/B2B/Education/Healthcare/Insurance/Construction/
Hospitality/Reports/FileManager/Settings) behind Dashboard, each independently gated (Settings
unconditionally, see above) -- a given session usually sees far fewer (the six industry verticals
in particular are mutually niche, see their own section above), but nothing capped how many could
render directly, and React Navigation's bottom-tabs will
happily lay out a dozen-plus icons in a
row (not a comfortable phone UI past ~5).

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
- **Bug fixed (was live for one on-device test round)**: `AppTabs()` originally only rendered
  `direct.map(...)` as `Tabs.Screen` components -- `overflow` tabs were listed as tappable
  `MenuCard`s in `MoreScreen.tsx` but were never registered as actual routes anywhere in the
  mounted navigator tree. Tapping one called `navigation.navigate(tab.key)` for a route that
  didn't exist, crashing with "The action 'NAVIGATE' with payload ... was not handled by any
  navigator" -- for every tab that happened to land in `overflow` (most of them, once a session
  holds several module permissions), including POS (last in `MODULE_TAB_ORDER`, so usually the
  first to overflow). Fixed by registering `[...direct, ...overflow]` as real `Tabs.Screen`
  routes and making only the **bar button** conditional (`tabBarButton: () => null` for overflow
  tabs) -- the bar still shows just the direct set, every tab stays reachable via "More".
- **Second bug fixed, on the same fix above**: registering every overflow tab as a real route
  (needed for "More" to navigate to it) reintroduced a different visual bug --
  `@react-navigation/bottom-tabs`'s `BottomTabBar` gives **every** registered route an equal
  `flex: 1` box in the bar's row regardless of what its `tabBarButton` renders (confirmed by
  reading `BottomTabItem.js` directly: the wrapping `<View style={[..., style]}>` around
  `button(...)` is rendered unconditionally, and `style` always includes `styles.bottomItem =
  {flex:1}`). A session with a dozen-plus overflow tabs ended up with the real, visible buttons
  squeezed into a handful of even-width slots on the left, and "More" (registered last) pushed out
  to the far right across a wide gap of invisible-but-space-reserving slots -- i.e. every tab
  "merging to the left with More on the right". Fixed by also setting
  `tabBarItemStyle: { flex: 0, width: 0, minWidth: 0, padding: 0, margin: 0 }` on every overflow
  tab's options -- it merges over (and wins against) the bar's own `{flex:1}` default, collapsing
  the slot to zero width instead of just hiding its content, so the bar re-flows to just the tabs
  actually shown.

## Push Notifications

**Phase 1 — the foundation (device registration, delivery, an in-app feed) plus one real trigger
end-to-end**, not an exhaustive wire-up of every module's approval queues. Confirmed before
building: there was no device-token storage, no push-sending capability, and no notifications
screen anywhere in the app or the backend.

### Why Expo's push service, not raw APNs/FCM
The app registers one **Expo push token** per device and the backend posts to Expo's own
`https://exp.host/--/api/v2/push/send`, which relays to APNs/FCM on our behalf. No native
certificates, no FCM server key, nothing to rotate — this is the standard approach for an
Expo-managed app and matches this app's "no native config beyond what Expo's own plugins need"
posture everywhere else.

### Backend (new — see the Backend repo's own CLAUDE.md for the full module writeup)
- **Identity**: `UserDeviceToken` (per-user, no TenantId column — same shape as `RefreshToken`,
  scoped via `UserId`), `POST /api/account/device-tokens` (register/re-register) and
  `POST /api/account/device-tokens/unregister`. Re-registering an already-known token just updates
  its owner rather than duplicating — a shared/reused device always points at whoever is
  *currently* signed into it.
- **`IPushNotificationSender`/`ExpoPushNotificationSender`** — shared in `BuildingBlocks`, not
  Identity-specific, so any service can send a push once it has the raw tokens (there's no
  service-to-service HTTP call in this codebase's conventions; cross-service reads go through raw
  cross-schema SQL against the same physical database instead — see `PosSessionLedger`/Real
  Estate's rent-alert CC list for the precedent this follows).
- **One real trigger, wired end-to-end**: CRM's existing `LeadIngestedAlertHandler` (in-app bell +
  email for "a lead just arrived") now also sends a push to the lead's owner's registered devices,
  reading `[identity].[user_device_tokens]` cross-schema and cleaning up any token Expo reports as
  permanently dead (`DeviceNotRegistered`). Chosen specifically because it already has exactly one
  unambiguous recipient per lead — unlike the HR/Purchase/Sales/Finance approval queues below.

### Mobile (this app)
- `expo-notifications` + `expo-device` (installed via plain `npm install`, not `expo install`, per
  the documented `EALLOWSCRIPTS` workaround), `expo-notifications` config plugin added to
  `app.json`.
- `src/lib/push.ts` — `registerForPushAsync()` (requests permission if needed, gets the Expo push
  token, `POST`s it to the backend; a no-op on a simulator/emulator or if permission is denied) and
  `unregisterPushAsync()` (best-effort, called before `logout()` in both `HomeScreen.tsx`'s and
  `SettingsScreen.tsx`'s sign-out handlers — mirrors the existing `authApi.revoke` best-effort
  pattern exactly). Registration runs once per authenticated session, from a `useEffect` in
  `RootNavigator.tsx`'s `AuthenticatedApp`.
- **In-app notifications feed** — reuses CRM's existing per-user "bell" endpoint
  (`GET /api/crm/notifications`) rather than building a second, competing cross-module feed; today
  that means every entry shown here originated from the one trigger above. New
  `NotificationBellButton` rendered as every tab's `headerRight` (an "always-on, anchored to the
  header" call, the same posture already used for the AI assistant's floating button) with an
  unread-count badge, opening `NotificationsScreen` as a page-sheet modal (mark-one-read, mark-all-
  read, pull-to-refresh, tap-through to the lead when a notification is lead-related).
- **Tap-to-navigate**: a foreground/background OS notification tap
  (`Notifications.addNotificationResponseReceivedListener`) reads the push payload's
  `{type:"lead", leadId}` and deep-links straight to `LeadDetail` via a `useNavigationContainerRef`
  held at the root — the same destination the in-app bell list's tap-through uses, so both paths
  share one `openLeadDetail` helper instead of two navigation implementations that could drift.

### ⚠️ Known limitation — real device delivery needs a build this app doesn't have yet
Everything above (registration, the token round-trip, the in-app feed, local/foreground
notification handling) can be exercised today. **A real "phone buzzes while the app is closed"
test cannot be** until there's an EAS/dev-client build: this app currently only runs in Expo Go,
and Expo Go on Android has not supported *receiving* a remote push since SDK 53. This is precisely
why EAS build config is the very next queued item — the sequencing here is deliberate, not an
oversight.

### Deliberately not built in this pass
- **HR leave/payroll approvals, Purchase requisition approvals, Sales return approvals, Finance
  payroll sign-off** are **not** wired to push. Each of those is gated on holding a *permission*
  (e.g. `hr.leaves.approve`), not assigned to one person the way a lead has an owner — sending a
  push there means deciding **who** gets notified: the single nearest approver, or everyone holding
  the permission (a broadcast, same shape as the CRM "unowned lead" fallback already documented in
  the backend's own `LeadIngestedAlertHandler`). That's a real product decision, not a technical
  gap, and was left for the next pass rather than guessed at here — `ApprovalsScreen`'s pull-based
  inbox is unchanged and still the way to see these today.
- No badge count on the app icon (`shouldSetBadge: false` in the notification handler) — the header
  bell's own unread count already covers "something is waiting," and app-icon badges need their
  count kept in sync from the OS side too, which is a separate small feature.
- No notification preferences screen (mute a category, quiet hours, etc.) — there's exactly one
  notification type today, so there's nothing yet to let someone turn off selectively.

## Next module

**Full ERP module parity is the active program** — the web app has ~25 modules across 18 nav
groups (`FrontendVite/src/config/navigation.ts`). No backend work is needed to gate whatever gets
built next — the JWT already carries the tenant's full module list and effective permission-key
set (same claims the web app reads), so extending RBAC to a new module is purely "add the
permission constants + wire `hasModuleAccess`/`hasPermission` into the new screens," exactly like
every module already here does.

**Done for this pass**: HR (employees/departments/recruitment/performance), Finance (invoices/
expenses/accounts/banking/budgets/journals/tax/recurring invoices — General Ledger + Financial
Statements deliberately deferred, see the complexity note above), Project Management (Kanban —
project/issue/label create, delete, and epic linking deliberately deferred, see above), POS
(retail shift status + transaction visibility, and Restaurant tables/orders/kitchen/reservations/
waitlist — both deliberately not a checkout/order-taking terminal, see above for each), Visa
Services (case management — status transitions/document checklist/renewals, case and visa-type
*creation* deliberately deferred, see above), Real Estate (properties/units/tenants/contracts/
brokers browsing + rent collection — all *creation* forms and the CRM-linked sales pipeline
deliberately deferred, see above), Reports (the 36 POS/Inventory tabular reports, all genuinely
runnable — CRM's 8 analytical reports and every export format deliberately deferred, see above),
File Manager (the CRM document library, browse-only — download/preview deliberately deferred
pending new native dependencies, see above), Settings (My Account — profile/password/2FA, ungated
— the admin console (users/roles/branches/integrations/general settings) deliberately deferred,
see above), Industry Verticals (B2B/Education/Healthcare/Insurance/Construction/Hospitality —
read-only browse for all six plus Hospitality's check-in/out and housekeeping workflow actions;
creation forms, detail screens, and Construction's CRM-linked bidding pipeline deliberately
deferred, see above). **Full ERP module parity is now reached** for every module the web app
gates behind `hasModuleAccess`/`hasRawPermission`. Queued next:

1. General Ledger + Financial Statements (deferred from Finance — needs a card/drill-down redesign
   rather than a literal port of the web's wide tables)

Also still queued from before: EAS build config, per-device refresh tokens. (Barcode scanning for
Inventory, dashboard KPIs, and push notifications — Phase 1: device registration + one real
trigger, see its own section above — are done.)

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
