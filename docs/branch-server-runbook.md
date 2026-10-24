# Branch Server — operator runbook

For the people who set up and look after branch servers. Background and design: [`branch-server-design.md`](branch-server-design.md).
Build status: [`branch-server-progress.md`](branch-server-progress.md).

A **branch server** is the normal Vrodux ERP server installed in a branch, set up as "a branch of a chain". The branch's tills
talk to it, so the branch keeps trading when the internet fails; it syncs with head office (`erp.vrodux.com`, or the chain's own
head-office server) in both directions. Head office owns the menu, prices, users and roles; the branch owns its bills, payments and
shifts. Nothing is ever edited in two places.

---

## 1. Before you start

- A PC for the branch with **SQL Server Express**, on a **UPS**, with an SSD. It must stay on during trading hours.
- The branch exists on head office (Settings → Branches) and has its tables and menu set up there.
- You can sign in to head office with `settings.branches.edit`.
- The branch's internet works for the first connection (it can be down later).
- Head office must be reachable from the branch at the address in the connection code. If branches reach head office at a
  different address from the one you use in the browser, set `BranchSync__PublicBaseUrl` on the head-office server first.

Head office itself must run with `BranchSync__Mode=Cloud` (set once, by Softaxis, on the head-office server).

## 2. Install a new branch server

1. **Head office → Settings → Branch Servers.** Find the branch under "Branches using head office directly" and click
   **Issue key**. Copy the connection code (starts with `VBR1.`). It is shown once only; if you lose it, issue another.
2. **On the branch PC**, run the Vrodux ERP setup:
   - *Server type:* **A branch of a chain**.
   - *Database:* the local SQL Server (setup suggests it).
   - *Head office:* paste the connection code. Setup checks it with head office:
     - "accepted this branch" → continue;
     - "rejected the key" → the key was revoked or replaced; issue a new one;
     - "could not be reached" → you may continue; the server connects when the internet is up.
   - No store, administrator or licence pages appear: they come from head office (the branch is covered by the chain's
     subscription).
3. Setup installs and starts the service. The first start takes a few minutes, then the branch downloads its users, menu, tables
   and settings (allow ~5 minutes for the first full download).
4. **Head office → Branch Servers:** the branch card should turn **Healthy** within a few minutes.
5. Point the branch's tills at the branch server (the desktop app's server address = this PC, port 5000).
6. Sign in on a till with a normal user account from head office — passwords are the same as at head office.

## 3. Switch a branch onto its own server (go-live)

Do this **after closing the day's shifts** at that branch.

1. Make sure the branch card is **Healthy** (connected, version matches, clock OK).
2. On the card, click **Use its own server** and confirm.
3. From now on:
   - bills for this branch are written only at the branch; head office sees them but cannot change them;
   - head office **voids/refunds** become requests the branch applies (`POST /api/restaurant/branch-instructions`; there is no
     screen for this yet — ask Softaxis, or have the branch do it at the till);
   - **QR and Foodpanda** orders for the branch are passed to the branch server; while it is offline they are refused
     (guests are told to ask staff; Foodpanda gets no acceptance).
4. Open a shift at the branch and take a test order. Within a minute it should appear at head office.

**Going back** (branch server retired): stop taking orders at the branch, check the card shows nothing waiting and a recent
upload, click **Move back to head office**, point the tills back at head office.

## 4. The Branch Servers screen

| State | Meaning | What to do |
|---|---|---|
| Healthy | Connected and up to date | — |
| Needs attention | Version differs from head office | Update the branch server (run the newer setup there, choose "Upgrade") |
| Sync failing | Connected recently but the last sync failed; the error is shown | Read the error; common causes below |
| Offline | Not heard from for 10 minutes | Branch keeps trading. Check the PC, power and internet at the branch |
| Never connected | A key was issued but the server has not connected yet | Finish the install; check the address in the code |
| No key | The branch is set to its own server but has no key | Issue a key and enter the new code on the branch server |

An **offline** alert goes to everyone with `settings.branches.edit` (bell + realtime), once per outage, and a "back online" alert
when it returns. Sales made while offline upload automatically when the link comes back — nothing has to be re-entered.

**Common sync errors**
- *"clock is off by N minute(s)"* — the branch PC's clock is wrong. Fix Windows' time (enable automatic time sync). Uploads
  resume by themselves; nothing is lost.
- *"Cannot reach the cloud"* — internet or head-office address. Uploads retry, backing off to every 2 minutes.
- *401 / "Unknown branch or wrong key"* — the key was revoked or replaced. Issue a new key (§5) and enter it on the branch.
- *"the cloud rejected N row(s)"* — a version mismatch between branch and head office. Update the branch server.

## 5. Keys: rotate, revoke

- **Rotate (routine, or after staff changes):** Branch Servers → **New key**. The old key keeps working, so the branch keeps
  syncing. Re-run setup on the branch PC, choose "Reconfigure", pick "A branch of a chain" and paste the new code (or put the
  new key in `BranchSync:BranchKey` in `appsettings.json` and restart the service). The first time the branch connects with the
  new key, the old one stops working automatically.
- **Revoke (PC lost, stolen or retired):** Branch Servers → **Revoke**. The branch stops syncing at once. It can still trade
  locally, so also secure the PC. To bring a replacement online, issue a new key and install it (§2).
- Keys listed in head-office server configuration (`BranchSync:Branches`) cannot be revoked from the screen; the card says
  "Key set in server configuration". Remove them from the configuration instead.

## 6. Recover a dead branch PC

The branch cannot trade while its server is down. Two options:

**A. Replacement PC (preferred).** Install as in §2 with a **new key** (revoke the old one). The new server downloads users,
menu and settings from head office. Bills from the dead PC that had **already uploaded** are safe at head office; anything taken
after its last upload is only on the dead PC's disk — if the disk is readable, restore that database onto the new PC instead of
starting empty, then install over it with "Upgrade".

**B. Fall back to head office for the day.** On Branch Servers click **Move back to head office** and point the tills at head
office (they then need the internet, with each till's own offline queue as the safety net). Switch back to the branch server
once a replacement is running (§3).

Check the card's *Last upload* time to know how much may be missing.

## 7. Upgrades

Upgrade head office first, then each branch server (run the new setup on the branch PC, choose **Upgrade and keep current
settings**). The card shows "Needs attention" while versions differ; sync continues, but upgrade within the same day.

## 8. Things to know

- A user disabled or a password changed at head office reaches the branch within seconds when connected; while the branch is
  offline the old state still applies there.
- Users with **two-factor sign-in** cannot finish signing in at a branch server; give till staff accounts without 2FA.
- If a branch is offline for **more than 7 days**, the next sync re-sends everything once (it is automatic and creates no
  duplicates, but takes longer).
- At a branch server, wallet, house-account and loyalty payments are refused, no points are earned, and customers cannot be
  added or edited — those are head-office records. Add customers at head office; they appear at the branch within a minute.
- Do not run a second copy of the server (e.g. a test install) against the same branch database.
