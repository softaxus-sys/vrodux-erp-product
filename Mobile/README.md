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
    jwt.ts             — decode JWT payload (no verification — server already signed it)
    query-client.ts    — shared React Query client
    secure-storage.ts  — Keychain/Keystore wrapper (expo-secure-store)
  store/
    auth.store.ts       — zustand + SecureStore-backed persistence; session, tenant/permission
                          claims, hasPermission()/hasModuleAccess() helpers
  navigation/
    RootNavigator.tsx   — switches Auth stack ↔ App stack on auth state, waits for hydration
    types.ts
  screens/
    LoginScreen.tsx
    TwoFactorScreen.tsx — step 2 of the two-phase 2FA login (Module 14)
    HomeScreen.tsx      — placeholder landing screen; proves the auth flow end to end
  types/
    auth.ts             — UserDto / AuthTokenDto / TenantClaims, trimmed mirror of the backend DTOs
```

## What's built vs. what's next

**Built:** full auth flow against the real gateway — login, 2FA step-up, JWT decode into
tenant/permission claims, refresh-token rotation with a mutex (dedupes concurrent 401s), secure
token storage, logout/revoke. `hasPermission()` / `hasModuleAccess()` in `auth.store.ts` mirror the
web app's authorization model so module/screen gating works the same way on both clients.

**Not built (by design — this is a scaffold, not phase 1):** any actual module screens (HR, CRM,
etc.), push notifications, offline/sync, per-device refresh tokens, biometric unlock. See the
phased module rollout discussed in-repo before picking what to build next — HR self-service +
CRM + Approvals was the suggested phase-1 slice.

## Conventions carried over from FrontendVite

- Same backend envelope (`{ success, data, message, errorCode, traceId }`) and the same
  ASP.NET/FluentValidation field-error extraction, so `ApiError.fieldError(name)` works identically.
- Same JWT claim names (`tenant_id`, `tenant_name`, `modules`, `permission`, `currency`, …) —
  `permission` claims are read directly rather than re-derived from roles+overrides, since the
  backend's `PermissionRepository` chokepoint (CLAUDE.md Module 5h) already computes the effective
  set into the token.
- `@/*` → `src/*` path alias, same as the web app (via `babel-plugin-module-resolver` here, since
  Metro doesn't read `tsconfig.json` paths on its own).
