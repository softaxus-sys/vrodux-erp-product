// P6: branch-server monitoring and hardening.
// Needs start-cloud3.sh (:5301, AlertAfterMinutes=1), start-branch2.sh (:5302), seed-cloud.sql loaded.
//   node health.cjs status     - heartbeat, status screen API, permissions, clock-drift refusal
//   (stop the branch)  node health.cjs offline   - waits for the "offline" state and alert
//   (start the branch) node health.cjs online    - waits for "back online"
const { tok, mk, crypto } = require("./lib.cjs");
const { execSync } = require("child_process");
const cloud = mk("http://localhost:5301");
const B1 = "089A949F-86F7-41F8-BC10-12FC6538DD6E", KEY = "proto-key-branch1-9f3a";
const ADMIN = "4023E5D8-AD7B-401B-922E-4AD2750BB6B3";
const viewer = tok(ADMIN, ["settings.branches.view"]);
const editor = tok(ADMIN, ["settings.branches.view", "settings.branches.edit"]);
const nobody = tok(ADMIN, ["restaurant.orders.view"]);
let pass = 0, fail = 0;
const ok = (c, m, x) => { if (c) { pass++; console.log("PASS", m); } else { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 600)); } };
const one = q => execSync(`sqlcmd -S SHAHBAZ-QFINITY -d SoftaxisProtoCloud -E -C -h -1 -W -Q "SET QUOTED_IDENTIFIER ON; SET NOCOUNT ON; ${q}"`, { encoding: "utf8" }).trim().split(/\r?\n/)[0]?.trim();
const wait = async (fn, ms = 60000) => { const s = Date.now(); while (Date.now() - s < ms) { try { if (await fn()) return true; } catch {} await new Promise(r => setTimeout(r, 2000)); } return false; };
const mine = async () => (await cloud(viewer, "GET", "/api/sync/branches")).j?.find(b => b.branchId.toLowerCase() === B1.toLowerCase());
const branchCall = (path, method, body, clock) => fetch("http://localhost:5301/api/sync/branch/" + path, {
  method, headers: { "Content-Type": "application/json", "X-Branch-Id": B1, "X-Branch-Key": KEY, ...(clock ? { "X-Branch-Clock": clock } : {}) },
  body: body ? JSON.stringify(body) : undefined });

async function status() {
  ok(await wait(async () => (await mine())?.state === "ok"), "the branch reports in and shows as healthy", await mine());
  const s = await mine();
  ok(s?.versionMatches === true && s.version, "its version is reported and matches head office", s);
  ok(s?.clockDriftSeconds !== null && Math.abs(s.clockDriftSeconds) < 30, "clock difference is measured", s?.clockDriftSeconds);
  ok(s?.lastUpOkAt && s?.lastDownOkAt, "last upload / download times are reported", s);
  ok(one(`SELECT COUNT(*) FROM sync.branch_status WHERE BranchId='${B1}'`) === "1", "the status is stored (survives a cloud restart)");

  const denied = await cloud(nobody, "GET", "/api/sync/branches");
  ok(denied.s === 403, "the status screen needs settings.branches.view", denied);
  const all = (await cloud(viewer, "GET", "/api/sync/branches")).j ?? [];
  const foreign = Number(one(`SELECT COUNT(*) FROM [identity].branches WHERE TenantId <> '4BE5DD59-EEBC-459F-9A42-B19AF2749F8B'`));
  ok(all.every(b => one(`SELECT CAST(TenantId AS varchar(36)) FROM [identity].branches WHERE Id='${b.branchId}'`).toUpperCase() === "4BE5DD59-EEBC-459F-9A42-B19AF2749F8B"),
     `only the caller's own workspace's branches are listed (${all.length} listed, ${foreign} other-workspace branch(es) in the database)`);

  const noEdit = await cloud(viewer, "PUT", `/api/branches/${B1}/server-mode`, { mode: "local" });
  ok(noEdit.s === 403, "switching server mode needs settings.branches.edit", noEdit);
  const noDelete = await cloud(viewer, "DELETE", `/api/branches/${B1}`);
  ok(noDelete.s === 403, "deleting a branch needs settings.branches.delete", noDelete);
  const yes = await cloud(editor, "PUT", `/api/branches/${B1}/server-mode`, { mode: "local" });
  ok(yes.s === 200 || yes.s === 204, "a user with settings.branches.edit can switch it", yes);
  ok(await wait(async () => (await mine())?.serverMode === "local"), "the screen shows the branch running on its own server");

  // Clock: a branch whose clock is an hour out may not upload.
  const ahead = new Date(Date.now() + 3600_000).toISOString();
  const push = await branchCall("push", "POST", { tenantId: "4BE5DD59-EEBC-459F-9A42-B19AF2749F8B", licenseKey: "", batchId: crypto.randomUUID(),
    tableName: "restaurant.Orders", fromVersion: 0, toVersion: 0, rows: [] }, ahead);
  const pushBody = await push.text();
  ok(push.status === 409 && /clock is off by 60 minute/.test(pushBody), "an upload from a branch whose clock is an hour out is refused", pushBody);
  const hb = await branchCall("heartbeat", "POST", { version: "x", clockUtc: ahead, lastUpOkAt: null, lastDownOkAt: null, lastError: null,
    consecutiveFailures: 0, failingSince: null, upRowsTotal: 0, downRowsTotal: 0, upRowsLastPass: 0 });
  ok(hb.ok, "a heartbeat is still accepted, so head office can see the problem");
  const bad = await mine();
  ok(bad?.state === "error" && /clock is off/.test(bad.summary), "the screen says the clock is wrong", bad);
  ok(await wait(async () => (await mine())?.state === "ok", 90000), "after the branch's next real heartbeat it is healthy again");
  done();
}

async function offline() {
  ok(await wait(async () => (await mine())?.state === "offline", 240000), "a silent branch shows as offline", await mine());
  ok(await wait(() => Number(one(`SELECT COUNT(*) FROM notifications.notifications WHERE Event='branch-server.offline'`)) >= 1, 180000),
     "head office gets an offline alert");
  ok(Number(one(`SELECT COUNT(*) FROM notifications.notifications WHERE Event='branch-server.offline'`)) === 1, "…once, not once a minute");
  ok(one(`SELECT CASE WHEN OfflineAlertAt IS NULL THEN 'no' ELSE 'yes' END FROM sync.branch_status WHERE BranchId='${B1}'`) === "yes", "the alert is remembered");
  done();
}

async function online() {
  ok(await wait(async () => (await mine())?.state === "ok", 240000), "the branch is healthy again after it reconnects", await mine());
  ok(await wait(() => Number(one(`SELECT COUNT(*) FROM notifications.notifications WHERE Event='branch-server.online'`)) >= 1, 180000),
     "head office is told it is back");
  ok(one(`SELECT CASE WHEN OfflineAlertAt IS NULL THEN 'clear' ELSE 'set' END FROM sync.branch_status WHERE BranchId='${B1}'`) === "clear", "the offline mark is cleared");
  done();
}

function done() { console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0); }
({ status, offline, online })[process.argv[2] ?? "status"]().catch(e => { console.error(e); process.exit(2); });
