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
    api-client.ts     — fetch wrapper: envelope unwrap, 401→refresh→retry (mirrors FrontendVite's)
    auth.api.ts        — login / verify-2fa / refresh / revoke
    crm.api.ts          — leads, deals/pipeline, activities; CRM_*_VIEW/EDIT permission-tier lists
    crm-helpers.ts      — leadHeat, buildLeadSummary, formatCompactValue, cleanPhone (i18n stripped)
    hr.api.ts           — employee self-service (api/hr/me/*); HR_SELF_* permission-key constants
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
  navigation/
    RootNavigator.tsx    — bottom tabs (Dashboard/Leads/Pipeline/HR); each tab only renders when
                          the session's JWT grants module access + the relevant permission(s)
    LeadsStack.tsx / DealsStack.tsx / HrStack.tsx — per-feature stacks
    types.ts
  screens/
    LoginScreen.tsx
    TwoFactorScreen.tsx  — step 2 of the two-phase 2FA login (Module 14)
    HomeScreen.tsx       — placeholder dashboard; shows session/tenant info, not real KPIs yet
    LeadsListScreen.tsx / LeadDetailScreen.tsx
    DealsListScreen.tsx / DealDetailScreen.tsx
    hr/
      HrHomeScreen.tsx    — profile + today's check-in/out + menu into the three sub-screens
      AttendanceScreen.tsx — paged history
      LeaveScreen.tsx      — balances, apply form, request history with cancel
      PayslipsScreen.tsx   — paged history, tap a row to expand the breakdown
  types/
    auth.ts / crm.ts / hr.ts — trimmed mirrors of the backend DTOs (kept in sync manually)
```

## What's built

**Auth**: full flow against the real gateway — login, 2FA step-up, JWT decode into tenant/permission
claims, refresh-token rotation with a mutex (dedupes concurrent 401s), secure token storage,
logout/revoke.

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

## Next module

Approvals inbox (cross-module: payroll finance-approval, PO approvals, leave approvals) or push
notifications — see the phased rollout plan discussed in-repo.

## Conventions carried over from FrontendVite

- Same backend envelope (`{ success, data, message, errorCode, traceId }`) and the same
  ASP.NET/FluentValidation field-error extraction, so `ApiError.fieldError(name)` works identically.
- Same JWT claim names (`tenant_id`, `tenant_name`, `modules`, `permission`, `currency`, …) —
  `permission` claims are read directly rather than re-derived from roles+overrides, since the
  backend's `PermissionRepository` chokepoint (CLAUDE.md Module 5h) already computes the effective
  set into the token.
- Same three-tier CRM permission pattern (`RequireAnyPermission` on the backend) mirrored via the
  `CRM_LEADS_VIEW`/`CRM_PIPELINE_VIEW` etc. constants in `crm.api.ts`; HR self-service uses a
  flatter per-feature `hr.self.*` pattern with no tiers (`HR_SELF_*` in `hr.api.ts`).
- `@/*` → `src/*` path alias, same as the web app (via `babel-plugin-module-resolver` here, since
  Metro doesn't read `tsconfig.json` paths on its own).
