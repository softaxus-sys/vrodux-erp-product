# Platform (applies to every module)

Use this as a shared "Platform" page and as the common footer block on every module page.

## Multi-tenant & security
- Each customer's data is isolated (tenant isolation enforced across all modules, including raw reports).
- **Roles and permissions** — fine-grained, per module and per action; custom roles; default roles are created for each module; **per-user overrides** (grant or deny) beat role defaults.
- **Two-factor authentication** (authenticator app + backup codes), optional per user, enforceable per workspace.
- **Security settings** that are actually enforced: password length/complexity/expiry, max login attempts, session timeout, single session, IP whitelist.
- **Sessions/devices** — see and sign out your devices.
- Admin-created users verify their email; trial signup is self-serve.

## Plans, trial and billing
- **14-day free trial with unlimited users.** After the trial, the only dimension is the number of users (3 / 10 / 50; Enterprise via sales). **All modules are available on every plan.**
- Subscribe by card via Stripe or PayPal; billing portal; checkout refuses a plan smaller than your active user count; access is restored immediately on payment; data is never deleted on lapse.
- Reminder emails at 7, 3 and 1 days before the trial ends.

## Reports hub
Central place for reports from POS (19), Inventory (17), CRM (8), Library (12) and Import/Export (8); shows only the modules you have and can access; CSV/PDF export.

## File Manager
Browse documents by module → owner → document type; today it lists CRM documents, scoped by who may see each record; download requires its own permission.

## Notifications
Real-time in-app alerts (bell, toast, optional sound and desktop notifications), stored so you see them later; covers CRM assignments, HR leave and payroll approvals, purchase approvals, project assignments, rent/vacancy, trade, quotation responses and more.

## Apps and access
- **Web app**, installable to the home screen (PWA), usable on phones and tablets.
- **Mobile app (Expo/React Native)** — login incl. 2FA, CRM, HR self-service, approvals and more modules; check the Mobile README for the current list before listing features; not yet distributed through app stores from this repo (no EAS build config).
- **Desktop app (Windows)** for tills; installer asks for the server address.
- English and Arabic in the main app (some public pages and emails are English only).
- Video Guides: 19 module walkthrough videos inside Help & Support.
- Currency: company currency set once; USD-based live exchange rates, refreshed daily.
- Super-admin console: tenants, recycle bin, billing setup, Lead Generation admin.

## On-premises
Windows-service deployment exists (self-contained server, installer). Describe only if you plan to sell it; licences are signed keys.

## Do not claim yet
- Per-tier perks like warehouse/branch limits, white-label or API access as enforced limits; push notifications to phones; SMS.
- Web "my devices" screen (mobile has it).
