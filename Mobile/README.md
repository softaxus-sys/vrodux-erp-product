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
    jwt.ts             — decode JWT payload (no verification — server already signed it)
    query-client.ts    — shared React Query client
    secure-storage.ts  — Keychain/Keystore wrapper (expo-secure-store)
  store/
    auth.store.ts       — zustand + SecureStore-backed persistence; session, tenant/permission
                          claims, hasPermission()/hasModuleAccess() helpers
  hooks/
    query-keys.ts        — shared "crm" React Query key root
    use-leads.ts          — leads list/detail, status change, convert-to-deal
    use-deals.ts          — pipeline list/detail, stage move
    use-activities.ts     — shared activity feed/create (leads + deals + customers)
  navigation/
    RootNavigator.tsx   — bottom tabs (Dashboard/Leads/Pipeline); each CRM tab only renders when
                          the session's JWT grants module access + a view-tier permission
    LeadsStack.tsx / DealsStack.tsx — per-feature stacks (list → detail)
    types.ts
  screens/
    LoginScreen.tsx
    TwoFactorScreen.tsx  — step 2 of the two-phase 2FA login (Module 14)
    HomeScreen.tsx       — placeholder dashboard; shows session/tenant info, not real KPIs yet
    LeadsListScreen.tsx / LeadDetailScreen.tsx
    DealsListScreen.tsx / DealDetailScreen.tsx
  types/
    auth.ts / crm.ts    — trimmed mirrors of the backend DTOs (kept in sync manually)
```

## What's built

**Auth**: full flow against the real gateway — login, 2FA step-up, JWT decode into tenant/permission
claims, refresh-token rotation with a mutex (dedupes concurrent 401s), secure token storage,
logout/revoke.

**CRM (leads + pipeline)** — the first complete module:
- Leads: search, status filters, hottest-first sort (score desc), infinite scroll, pull-to-refresh,
  call/WhatsApp/email quick actions, guarded status transitions, activity logging + feed.
- Pipeline: search, stage filters, opportunity list with value/weighted-value/forecast category,
  stage transitions (won/lost terminal, loss-reason capture on Lost), contact quick actions,
  activity logging + feed.
- **Convert Lead → Deal** ties the two together (creates the account/contact/deal via the
  dedicated `convertLead` endpoint — never via a plain status PATCH, which would mark a lead
  "converted" without any of that actually happening).
- Both tabs are permission-gated per the three-tier model (`crm.leads`/`crm.leads-team`/
  `crm.leads-assigned`, same for `pipeline`) — a tab simply does not render for a session whose
  JWT lacks every tier's view permission, mirroring the web app's `hasModuleAccess`/
  `hasRawPermission`.

**Explicitly out of scope for this pass** (flagged, not built): Accounts/Customers view, lead
creation form (Add Lead), a real CRM dashboard/summary tile set on the Dashboard tab, lead/deal
team-filing, CRM documents. Revisit if/when the field-sales use case needs them.

## Next module

HR self-service (attendance check-in/out with GPS, leave requests, payslip view) — see the
phased rollout plan discussed in-repo.

## Conventions carried over from FrontendVite

- Same backend envelope (`{ success, data, message, errorCode, traceId }`) and the same
  ASP.NET/FluentValidation field-error extraction, so `ApiError.fieldError(name)` works identically.
- Same JWT claim names (`tenant_id`, `tenant_name`, `modules`, `permission`, `currency`, …) —
  `permission` claims are read directly rather than re-derived from roles+overrides, since the
  backend's `PermissionRepository` chokepoint (CLAUDE.md Module 5h) already computes the effective
  set into the token.
- Same three-tier CRM permission pattern (`RequireAnyPermission` on the backend) mirrored via the
  `CRM_LEADS_VIEW`/`CRM_PIPELINE_VIEW` etc. constants in `crm.api.ts`.
- `@/*` → `src/*` path alias, same as the web app (via `babel-plugin-module-resolver` here, since
  Metro doesn't read `tsconfig.json` paths on its own).
