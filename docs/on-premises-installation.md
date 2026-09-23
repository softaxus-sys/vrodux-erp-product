# On-Premises Installation Runbook
## What the office prepares, what the engineer does on site, and what comes back

> **Audience:** the deployment engineer installing Vrodux ERP on a customer's own server, and the
> person in the office who prepares the handover pack.
>
> **Read this first:** every step here works today, nightly cloud sync included. The install-time
> settings in §4.6 **seed** the schedule on first run; after that it is managed on screen at
> **Settings → Cloud Sync** — last run, run history, a manual **Sync now**, and a full re-send.
> Failure alerts go to whoever holds `settings.integrations.edit`, and to the addresses in
> `Sync:AlertEmails`.

---

## 0. The handover pack — what the office gives the engineer

One folder (USB stick or zip). Nothing in it should need to be typed twice on site.

| Item | Where it comes from | Notes |
|---|---|---|
| `Deploy/server/` folder, including `output/` | Run `Deploy/server/publish.bat` in the office | Self-contained — the server does **not** need .NET installed |
| `VroduxERP-Setup-<version>.exe` | `npm run electron:build-win` in `FrontendVite/` → `release/` | The staff desktop client |
| **Site sheet** (below) | Filled in by the office | The only per-customer values |
| SQL Server Express installer | Microsoft, offline installer | Only if the server has no SQL Server |
| This runbook | | |

### The site sheet — fill this in before the engineer leaves

```
Customer name        : ______________________________
Tenant GUID          : ______________________________   (from the cloud console)
Tenant slug          : ______________________________
License key          : ______________________________   (long base64 string — paste, never retype)
License expires      : ______________________________
Modules              : pos,inventory,finance            (set on the tenant; the key carries them)
Plan                 : ______________________________

First admin email    : ______________________________
First admin username : ______________________________
First admin password : ______________________________   (temporary — they change it on day one)

JWT secret           : ______________________________   (generated fresh per site — see §1.3)

SMTP host / user / pass (optional, for invites + password resets):
                       ______________________________
```

**The license key is the important one.** It is RSA-signed and carries the tenant GUID, slug, plan,
seat limit and expiry, so the installation adopts the *existing* cloud tenant rather than creating a
new workspace with a different id. Without it the box still runs, but it can never mirror to the
cloud, because the two sides would not share a tenant id.

---

## 1. In the office, before anyone travels

### 1.1 Create the cloud tenant (you have done this)
Super Admin → Tenants → Create:
- Plan and modules as sold
- **Deployment type: `OnPremises`**
- **Is mirror: on**

> Both sides are `OnPremises`. That is deliberate and not a typo — the licence generator refuses a
> `Cloud` tenant, and the mirror is a view of an on-premises installation licensed by the same key.
> See `docs/on-premises-cloud-mirror.md` §3.1.

### 1.2 Generate the license key
Set the tenant's modules **first** (Super Admin → that tenant → Modules), then → **Generate
license** and choose validity days (e.g. 365). The module list is taken from the tenant itself —
there is nothing to type, and nothing to get wrong. Copy the key and the tenant GUID onto the site
sheet.

> **The key is the entitlement.** The installation reads its modules and plan out of the signed
> payload, not out of `appsettings.json`. So **changing what a site runs means re-issuing the key**:
> change the modules in the cloud console, generate a new key, paste it into the box's
> `OnPremises:LicenseKey` and restart the service. The new plan and module list are picked up on
> that start. `OnPremises:Modules` is only a fallback for an old key issued without a module list.

### 1.3 Generate a JWT secret for this site
Every installation must have its **own** secret. The shipped `appsettings.json` contains the
placeholder `__SET_JWT_SECRET_VIA_ENV_OR_DEV_SETTINGS__`, which is a known string — leaving it means
anyone with the source can mint a valid token for that customer.

```powershell
# 64 random bytes, base64 — run in the office, record on the site sheet
[Convert]::ToBase64String((1..64 | ForEach-Object { Get-Random -Maximum 256 }))
```

### 1.4 Build the two artefacts
```bat
REM Server — produces Deploy\server\output\
Deploy\server\publish.bat
```
```bash
# Desktop client — produces FrontendVite/release/VroduxERP-Setup-<version>.exe
cd FrontendVite
npm run electron:build-win
```

---

## 2. Server prerequisites — check before starting

| | Requirement | Why |
|---|---|---|
| OS | Windows Server 2019+ or Windows 10/11 Pro, x64 | The service is published `win-x64` |
| SQL Server | 2019+ — **Express is fine** | Change Tracking (needed later for cloud sync) works on Express; CDC does not |
| Disk | 20 GB free minimum | Database, logs, backups |
| Rights | Local administrator | Installing a service, firewall rule |
| SQL rights | The service account needs **db_owner** on the database | Migrations run at startup, and Change Tracking needs it |
| Network | Static LAN IP, and the port open to staff PCs | Tills and desktops connect to it |
| Power | UPS strongly recommended | It is the shop's system of record |

**The server must have a fixed IP.** Every desktop client is pointed at it by address; a DHCP lease
change means every PC stops working at once.

---

## 3. SQL Server and the database

1. Install SQL Server Express if absent. During setup enable **Mixed Mode** if you intend to use a
   SQL login, and note the instance name (`SQLEXPRESS` by default).
2. Create an empty database:
   ```sql
   CREATE DATABASE SoftaxisErpDb;
   ```
   **Empty is correct — do not restore anything into it.** The service creates every table itself on
   first start, because an installation carrying an `OnPremises:LicenseKey` applies its migrations
   automatically. (A box with no licence key configured will **not** create tables — another reason
   §4.3 is not optional.)
3. Decide how the service authenticates:
   - **Windows auth (simplest):** the service runs as `LocalSystem`, so grant
     `NT AUTHORITY\SYSTEM` the `db_owner` role on `SoftaxisErpDb`.
   - **SQL login:** create one, grant it `db_owner`, and use it in the connection string.
4. Confirm you can connect with whichever account you chose before going further. Every later
   failure looks the same from the outside; proving the database now saves an hour.

---

## 4. Copy and configure the server

1. Copy the `Deploy\server\` folder to the machine — e.g. `C:\Vrodux\server\`.
2. Open `C:\Vrodux\server\output\appsettings.json` in a text editor.

### 4.1 Connection strings — all of them
There are **18** connection-string entries — `IdentityDb`, `POSDb`, `InventoryDb`, `SalesDb`,
`PurchaseDb`, `HrDb`, `FinanceDb`, `CrmDb`, `ConstructionDb`, `RealEstateDb`, `HospitalityDb`,
`RestaurantDb`, `RecipeDb`, `ProjectManagementDb`, `VisaDb`, `SupportDb`, `AiAssistantDb`,
`NotificationsDb`.

**They all point at the same physical database** — one database, a schema per module. Do a
find-and-replace of the server portion rather than editing eighteen lines by hand:

```
Server=<SERVERNAME>\SQLEXPRESS;Database=SoftaxisErpDb;Integrated Security=true;MultipleActiveResultSets=true;TrustServerCertificate=True;
```

> Missing one is a real failure mode: the gateway starts, most of the product works, and the one
> module whose string still points at the office machine fails at startup and takes the whole
> service down with it. Search the file for the old server name afterwards and confirm zero hits.

### 4.2 The JWT secret
```jsonc
"Jwt": {
  "Secret": "<the value from the site sheet>",
  ...
}
```
⚠️ **Changing this later invalidates every stored 2FA secret and every refresh token** — users must
re-enrol their authenticator. Set it once, now, and keep it on the site sheet.

### 4.3 Adopt the cloud tenant
```jsonc
"OnPremises": {
  "LicenseKey": "<the long key from the site sheet>",
  "TenantName": "Customer Name",
  "Modules": "pos,inventory,finance",
  "ContactEmail": "owner@customer.com",
  "Country": "United Arab Emirates",
  "AdminEmail": "owner@customer.com",
  "AdminUsername": "owner",
  "AdminFirstName": "First",
  "AdminLastName": "Last",
  "AdminPassword": "<temporary password from the site sheet>"
}
```

What this does on first start: validates the key's signature, creates the tenant **with the GUID the
key carries**, provisions its roles, and creates the first administrator, pre-verified so they can
sign in immediately (there is no mailbox on a shop counter).

- Leave `LicenseKey` blank and nothing is adopted — you get an unlicensed box that blocks every
  request. Do not skip it.
- If the key is invalid or expired the log says so and **no tenant is created** — it never invents
  one from an unverified key.
- Re-running is safe: it only re-asserts deployment type, license and mirror flag.

**Do not set the `SuperAdmin` section on a customer's server.** That is a platform-level account for
your own cloud; the customer's administrator comes from `OnPremises:Admin*` above.

### 4.4 Email (optional but recommended)
```jsonc
"Email": {
  "SmtpHost": "...", "SmtpPort": "587",
  "SmtpUsername": "...", "SmtpPassword": "...",
  "FromAddress": "...", "FromName": "Customer Name"
}
```
Without it, password-reset and invite emails cannot be sent. Everything else works; account
hand-over falls back to temporary passwords shown on screen.

### 4.5 FrontendUrl — read the caveat
`FrontendUrl` is the address password-reset and invite links point to. **If the site uses only the
desktop client, there is no web address to point at** — the gateway does not serve the web UI, and
the client loads its own bundled copy. Those emailed links will not open anywhere useful.

Practical consequence for a desktop-only site: reset passwords through **Settings → Users → Reset
password** (which shows a temporary password on screen) rather than the "forgot password" email.
The service logs a warning at startup if `FrontendUrl` is unset or points at localhost — that
warning is expected on such a site, not a fault.

### 4.6 Nightly cloud sync
```jsonc
"OnPremises": {
  // ... the keys from 4.3, plus:
  "SyncCloudUrl":       "https://erp.vrodux.com",
  "SyncRunAtLocalTime": "23:30",
  "SyncTimeZoneId":     "Asia/Dubai",
  "SyncEnabled":        "true"
}
```

- **Leave `SyncCloudUrl` blank** for a site that does not mirror. Everything else still works.
- **The time is local wall-clock, in `SyncTimeZoneId`** — not UTC. Pick a time after close but
  before anyone switches the machine off. If the box is off at that moment the run still happens,
  later the same day.
- **These seed the schedule once.** After the first start the settings live in the database, and a
  restart never overwrites them — so a later change must go through the API (§9), not this file.

---

## 5. Install and start the service

Right-click → **Run as administrator**:

```
C:\Vrodux\server\install-service.bat
```

It creates the `VroduxERP` service (auto-start, `LocalSystem`), sets it to restart on failure
(5 s / 10 s / 30 s), and starts it.

**First start takes a few minutes** — it creates every table and seeds roles and permissions. Do not
interrupt it.

### Confirm it is actually up
```powershell
sc query VroduxERP
curl http://localhost:5000/health
```
`/health` must return **200** and list the services. If the service starts and immediately stops,
open **Event Viewer → Windows Logs → Application** — a bad connection string and a missing
`db_owner` both land there with a clear message.

---

## 6. Firewall

Only if staff connect from other PCs (they almost always do):

```
C:\Vrodux\server\open-firewall.bat     (as administrator)
```

Opens **TCP 5000** on the **domain and private** profiles only — deliberately not public. If the
customer's network profile is set to Public, either change the profile or add the rule manually;
otherwise the port is open on the server and unreachable from every till.

Verify from a staff PC, not from the server:
```
curl http://<SERVER-IP>:5000/health
```

---

## 7. First sign-in and hand-over to the customer

From a desktop client or browser on the LAN, sign in as the `OnPremises:AdminEmail` account with the
temporary password.

Immediately, with the owner present:
1. **Change the administrator password.**
2. Settings → General: company name, legal name, address, tax registration number, logo, currency.
   The tax number and logo appear on invoices and quotations — set them before the first document.
3. Settings → Users: create their real staff accounts and assign roles.
4. Settings → Security: agree a password policy and lockout threshold if they want one.

**Hand over the site sheet to the customer's owner**, or destroy the copy of the admin password on
it. It should not stay in a shared folder.

---

## 8. Install the desktop client on staff PCs

On each till and office PC:

1. Run `VroduxERP-Setup-<version>.exe`. It installs per-machine with desktop and Start-menu
   shortcuts.
2. Launch **Vrodux ERP**. It defaults to `http://localhost:5000`, which is only correct on the
   server itself.
3. Point it at the server: **tray icon → Server Settings → Change** → `http://<SERVER-IP>:5000`,
   then it reloads. The address is saved per machine (`vrodux-config.json` in the user's app data),
   so it survives restarts and upgrades.
4. Sign in and confirm the modules the customer bought are present.

> Do this on **one** PC and confirm end to end before rolling out to the rest. A wrong IP, a closed
> firewall and a stopped service all look identical from the client.

---

## 9. Nightly cloud sync

This pushes the day's data to the cloud mirror created in step 1. It works; it is configured in
§4.6 before the service first starts.

### What it does
At the configured local time the installation sends everything that changed since the last
successful run — POS, Inventory, Finance and the identity records that make the mirror readable —
to the cloud workspace with the same tenant id. The first run is a full export; every run after it
sends only changes. The cloud copy is **read-only**: it accepts no edits and runs no background
jobs, so nothing is generated twice.

### Confirm it on site, before you leave
The schedule is at 23:30 by default, so do not wait for it. Sign in as the administrator and run it
by hand:

```bash
# from the server, after signing in and getting a token
curl -X POST -H "Authorization: Bearer <token>" http://localhost:5000/api/sync/run
```

A good first result looks like this — the number of rows depends on how much data exists:

```json
{ "ran": true, "succeeded": true, "tablesProcessed": 73, "rowsSent": 1564, "tablesFailed": 0 }
```

Then check the current state:

```bash
curl -H "Authorization: Bearer <token>" http://localhost:5000/api/sync/settings
```

`lastSuccessAt` should be a moment ago, `consecutiveFailures` 0, `licenceConfigured` true.

### If it does not run
| `skippedReason` or error | Means |
|---|---|
| "no cloud-sync configuration" | §4.6 was left blank — set `SyncCloudUrl` and restart |
| "Cloud sync is switched off" | `SyncEnabled` is false |
| "No licence key is configured" | §4.3 — the push authenticates with the licence |
| "the mirror refused … 401" | The cloud tenant does not match this licence |
| "that workspace is not configured as a cloud mirror" | **Is mirror** was not ticked when the cloud tenant was created |
| "Could not reach the cloud mirror" | Outbound HTTPS is blocked, or the URL is wrong |

### Changing the time later
Open **Settings → Cloud Sync** in the app and change it there — it takes effect on the next night
with no restart. The same screen shows whether the last run worked, the recent run history, and a
**Sync now** button for checking a fix without waiting until 23:30.

If the app is not reachable (mid-install, or you are on the server console), the same thing over the
API:

```bash
curl -X PUT -H "Authorization: Bearer <token>" -H "Content-Type: application/json"   -d '{"enabled":true,"cloudBaseUrl":"https://erp.vrodux.com","runAtLocalTime":"23:30","timeZoneId":"Asia/Dubai"}'   http://localhost:5000/api/sync/settings
```

Note the ordering: install-time settings only **seed** the schedule the first time. Once a row
exists, a restart never overwrites it — so a change made on the screen (or over the API) sticks, and
editing `appsettings.json` afterwards will appear to do nothing.

**If the mirror is wrong rather than merely behind** — after restoring the cloud database, say — use
**Re-send everything** on that screen. It clears every table's position so the next run exports the
whole database again. It deletes nothing on either side (the receiver upserts), but on a busy site
that run takes a long time.

### Alerting
Set `Sync:AlertEmails` in `appsettings.json` to the office addresses that should hear about a broken
push — usually your own support desk rather than the shop's staff, since the person who can re-key a
licence or open a firewall is rarely on site. Administrators at the shop also get an in-app
notification linking straight to the screen.

Alerts are sent **twice per outage, not once per attempt**: on the first failure, and again once it
has failed three times. A channel that repeats itself nightly is one people filter out, exactly when
it next matters.

### What it is not
**The mirror is not a backup.** It is read-only and holds only what was pushed. §10 still applies.

## 10. Backups — do not skip this

The mirror, when it exists, is **not a backup**: it is read-only and holds only what was pushed.
This server is the customer's system of record.

Set up a SQL Server backup job before leaving:
- Full backup nightly, to a **different physical disk** than the database.
- Weekly copy off-site (external drive rotated, or cloud storage).
- **Test a restore once**, on the day, into a scratch database. An untested backup is a belief.

`docs/backup-restore-guide.md` has the commands.

---

## 11. Leaving checklist

Nothing here is optional.

- [ ] `sc query VroduxERP` → RUNNING, start type Automatic
- [ ] `/health` returns 200 **from another PC on the network**
- [ ] Service survives a reboot — actually reboot the server and re-check
- [ ] Administrator password changed by the owner
- [ ] Company details, tax number and currency set
- [ ] At least one staff account created and signed in
- [ ] Desktop client working on every PC, each pointing at the server IP
- [ ] **Cloud sync run by hand and confirmed** — `succeeded: true`, `tablesFailed: 0`
- [ ] Backup job created **and a restore tested**
- [ ] JWT secret, license key and tenant GUID recorded in the office record for this site
- [ ] Admin password removed from any shared copy of the site sheet

### Report back to the office
```
Site            : ____________________
Installed on    : ____________________
Server name/IP  : ____________________
SQL instance    : ____________________
Tenant GUID     : ____________________   (confirm it matches the cloud console)
License expires : ____________________
Backup location : ____________________
Sync run time   : ____________________   (confirmed working on site: yes / no)
```

---

## 12. Troubleshooting

| Symptom | Likely cause | Check |
|---|---|---|
| Service starts then stops | Bad connection string, or no `db_owner` | Event Viewer → Application |
| Service runs but the database has no tables | No `OnPremises:LicenseKey`, so migrations were skipped | §4.3 — set the key and restart, or set `Database:MigrateOnStartup: true` |
| `/health` works locally, not from a PC | Firewall, or Public network profile | `open-firewall.bat`; check the profile |
| "No license key has been issued" on every request | `OnPremises:LicenseKey` blank or wrong | The key must be pasted whole |
| "Your software license has expired" | Key past its expiry | Generate a new one in the cloud console |
| Login says the workspace is unavailable | Tenant adopted with the wrong id, or deleted in the cloud | Compare the tenant GUID against the console |
| One module 500s, the rest work | A connection string still points at the office machine | Search `appsettings.json` for the old server name |
| Password-reset emails go nowhere | No SMTP, or `FrontendUrl` unreachable | §4.4 and §4.5 — use admin reset instead |
| Everything worked, now nothing does after an upgrade | New `appsettings.json` overwrote the site's | **Back up `appsettings.json` before every upgrade** |

### Upgrading a site later
1. **Copy `appsettings.json` somewhere safe.**
2. Stop the service: `sc stop VroduxERP`.
3. Replace `output\` with the new build.
4. Restore the saved `appsettings.json` — or re-apply §4 to the new one if its structure changed.
5. Start: `sc start VroduxERP`. Migrations apply automatically.
6. Re-check `/health` and one real screen.

---

## 13. What the office keeps, per site

One record per customer, treated as credentials — not a shared spreadsheet:
tenant GUID, slug, license key + expiry, JWT secret, server name/IP, SQL instance, install date,
build version, backup arrangement, and (when it ships) the sync time and cloud URL.

You will need the tenant GUID and license key again for every upgrade, every license renewal, and
the first time cloud sync is switched on.
