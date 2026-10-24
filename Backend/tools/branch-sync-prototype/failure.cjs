// P6 part 2: issued branch keys (issue / rotate / revoke), the installer's code check, and failure testing
// (power loss mid-upload, Change Tracking watermark expiry, a large backlog).
// Orchestrated by run-failure.sh - each phase is one "node failure.cjs <phase>".
const { tok, mk, BRANCH_SECRET } = require("./lib.cjs");
const { execSync, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
// Node on Windows reads "/tmp" as C:	mp, not the shell's /tmp: run-failure.sh passes the real folder.
const T = process.env.PROTO_DIR || "/tmp/proto";
const P = name => path.join(T, name);
const cloud = mk("http://localhost:5301"), branch = mk("http://localhost:5302");
const B1 = "089A949F-86F7-41F8-BC10-12FC6538DD6E", ADMIN = "4023E5D8-AD7B-401B-922E-4AD2750BB6B3";
const editor = tok(ADMIN, ["settings.branches.view", "settings.branches.edit", "restaurant.menu.create", "restaurant.menu.view"]);
const viewer = tok(ADMIN, ["settings.branches.view"]);
const bt = tok(undefined, undefined, BRANCH_SECRET);
const N = Number(process.env.ORDERS ?? 3000);
let pass = 0, fail = 0;
const ok = (c, m, x) => { if (c) { pass++; console.log("PASS", m); } else { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 500)); } };
const sql = (db, q) => execSync(`sqlcmd -S SHAHBAZ-QFINITY -d ${db} -E -C -h -1 -W -Q "SET QUOTED_IDENTIFIER ON; SET NOCOUNT ON; ${q}"`, { encoding: "utf8" }).trim();
const one = (db, q) => sql(db, q).split(/\r?\n/)[0]?.trim();
const n = (db, q) => Number(one(db, q));
const CL = "SoftaxisProtoCloud", BR = "SoftaxisProtoBranch";
const wait = async (fn, ms = 60000) => { const s = Date.now(); while (Date.now() - s < ms) { try { if (await fn()) return true; } catch {} await new Promise(r => setTimeout(r, 1500)); } return false; };
const KEYFILE = P("branch-key.txt"), CODEFILE = P("branch-code.txt"), OLDKEY = P("branch-key-old.txt");
const ping = async key => (await fetch("http://localhost:5301/api/sync/branch/ping", { headers: { "X-Branch-Id": B1, "X-Branch-Key": key } })).status;
const mine = async () => (await cloud(viewer, "GET", "/api/sync/branches")).j?.find(b => b.branchId.toLowerCase() === B1.toLowerCase());
const checkCode = code => {
  const f = P("code-under-test.txt"), o = P("code-check.txt");
  fs.writeFileSync(f, code);
  const r = spawnSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", P("check-branch-code.ps1"), "-CodeFile", f, "-OutFile", o]);
  return { rc: r.status, msg: fs.existsSync(o) ? fs.readFileSync(o, "utf8").trim() : "" };
};
const issue = async () => {
  const r = await cloud(editor, "POST", `/api/sync/branches/${B1}/key`, {});
  if (r.s === 200) { if (fs.existsSync(KEYFILE)) fs.copyFileSync(KEYFILE, OLDKEY); fs.writeFileSync(KEYFILE, r.j.key); fs.writeFileSync(CODEFILE, r.j.connectionCode); }
  return r;
};

const phases = {
  // Cloud running, branch not yet started.
  async keys1() {
    await cloud(editor, "POST", "/api/restaurant/menu/import", { rows: [{ category: "Mains", name: "Karahi", price: 1200 }] });
    ok((await cloud(viewer, "POST", `/api/sync/branches/${B1}/key`, {})).s === 403, "issuing a key needs settings.branches.edit");
    ok((await ping("proto-key-branch1-9f3a")).toString() === "401", "with no configured keys, the old prototype key is refused");
    const r = await issue();
    ok(r.s === 200 && r.j.key.startsWith("vbk_") && r.j.connectionCode.startsWith("VBR1."), "head office issues a key and a connection code", r);
    const decoded = JSON.parse(Buffer.from(r.j.connectionCode.slice(5), "base64url").toString());
    ok(decoded.u === "http://localhost:5301" && decoded.b.toLowerCase() === B1.toLowerCase() && decoded.k === r.j.key, "the code carries the head-office address, branch and key", decoded);
    ok(n(CL, "SELECT COUNT(*) FROM sync.branch_keys WHERE KeyHash LIKE '%vbk_%' OR Hint = ''") === 0, "only a hash of the key is stored");
    ok(await ping(r.j.key) === 200, "head office accepts the issued key");
    const good = checkCode(r.j.connectionCode);
    ok(good.rc === 0 && /accepted this branch/.test(good.msg), "the installer's check accepts the code", good);
    ok(checkCode("hello").rc === 1, "the installer's check rejects text that is not a code");
    const tampered = "VBR1." + Buffer.from(JSON.stringify({ ...decoded, k: decoded.k + "x" })).toString("base64url");
    const t = checkCode(tampered);
    ok(t.rc === 1 && /rejected the key/.test(t.msg), "the installer's check reports a rejected key", t);
    const offline = "VBR1." + Buffer.from(JSON.stringify({ ...decoded, u: "http://localhost:5999" })).toString("base64url");
    ok(checkCode(offline).rc === 2, "an unreachable head office is reported separately (setup may continue)");
  },
  // Branch started with the issued key.
  async keys2() {
    ok(await wait(async () => (await mine())?.state === "ok", 120000), "the branch syncs with the issued key", await mine());
    const s = await mine();
    ok(s?.activeKeys === 1 && s.keyHint && s.keyLastUsedAt, "the screen shows the key and when it was last used", s);
    const r = await issue();
    ok(r.s === 200, "a new key is issued (rotation)");
    ok(await ping(fs.readFileSync(OLDKEY, "utf8")) === 200, "the old key keeps working until the branch uses the new one");
    ok((await mine())?.activeKeys === 2, "both keys are active meanwhile");
  },
  // Branch restarted with the new key.
  async keys3() {
    ok(await wait(async () => (await mine())?.state === "ok" && (await mine())?.activeKeys === 1, 120000), "the branch syncs with the new key, and the old one is retired", await mine());
    ok(await ping(fs.readFileSync(OLDKEY, "utf8")) === 401, "the old key is refused now");
    const rv = await cloud(editor, "DELETE", `/api/sync/branches/${B1}/key`);
    ok(rv.s === 200 && rv.j.revoked === 1, "revoke all keys", rv);
    ok(await ping(fs.readFileSync(KEYFILE, "utf8")) === 401, "the branch is cut off at once");
    ok((await mine())?.state === "not_configured" || (await mine()) === undefined, "the screen shows the branch has no key", await mine());
    await issue();   // for the next phases
  },
  // Branch running with a fresh key, cloud STOPPED: build a backlog.
  async backlog() {
    const item = (await branch(bt, "GET", "/api/restaurant/menu")).j.flatMap(c => c.items)[0];
    ok(!!item, "the branch has its menu while head office is down");
    let made = 0, failed = 0;
    const one1 = async i => {
      const r = await branch(bt, "POST", "/api/restaurant/orders", { waiter: "Ali", covers: 1, orderType: "takeaway", branchId: B1,
        notes: `load ${i}`, items: [{ menuItemId: item.id, quantity: 1 + (i % 3) }] });
      if (r.s === 200 || r.s === 201) made++; else if (failed++ < 3) console.log("create failed", r.s, JSON.stringify(r.raw).slice(0, 200));
    };
    const started = Date.now();
    for (let i = 0; i < N; i += 10) await Promise.all(Array.from({ length: Math.min(10, N - i) }, (_, k) => one1(i + k)));
    ok(made === N, `the branch takes ${N} orders with head office down (${Math.round((Date.now() - started) / 1000)} s)`, { made, failed });
    fs.writeFileSync(P("backlog-count.txt"), String(n(BR, "SELECT COUNT(*) FROM restaurant.Orders")));
    fs.writeFileSync(P("backlog-lines.txt"), String(n(BR, "SELECT COUNT(*) FROM restaurant.OrderItems")));
  },
  // Cloud restarted: wait until the upload is partway through, then the orchestrator kills the branch.
  async partial() {
    const total = Number(fs.readFileSync(P("backlog-count.txt"), "utf8"));
    // Poll fast and pull the plug on the branch the moment the upload is part-way through (simulated power loss).
    let seen = -1; const s = Date.now();
    while (Date.now() - s < 180000) {
      const c = n(CL, "SELECT COUNT(*) FROM restaurant.Orders");
      if (c > 0 && c < total) { seen = c; break; }
      if (c >= total) break;
      await new Promise(r => setTimeout(r, 200));
    }
    if (seen > 0) execSync(`powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${P("kill-port.ps1")}" -Port 5302`);
    ok(seen > 0, `the branch lost power part-way through the upload (head office had ${seen} of ${total})`);
  },
  // Branch restarted after the "power loss".
  async complete() {
    const total = Number(fs.readFileSync(P("backlog-count.txt"), "utf8"));
    const started = Date.now();
    const lines = Number(fs.readFileSync(P("backlog-lines.txt"), "utf8"));
    ok(await wait(() => n(CL, "SELECT COUNT(*) FROM restaurant.Orders") === total && n(CL, "SELECT COUNT(*) FROM restaurant.OrderItems") === lines, 600000),
       `after the restart every order arrives (${Math.round((Date.now() - started) / 1000)} s to finish)`, one(CL, "SELECT COUNT(*) FROM restaurant.Orders"));
    sameData();
  },
  // Force the up and down watermarks to look expired (as after 7+ days offline) and check the re-seed.
  async reseed() {
    const before = { o: n(CL, "SELECT COUNT(*) FROM restaurant.Orders"), m: n(BR, "SELECT COUNT(*) FROM restaurant.MenuItems") };
    sql(BR, "UPDATE sync.table_state SET LastSyncedVersion = 0, SeedCompleted = 1 WHERE TableName IN ('restaurant.Orders', 'down:restaurant.MenuItems')");
    const since = Date.now();
    ok(await wait(() => n(BR, "SELECT COUNT(*) FROM sync.table_state WHERE TableName='restaurant.Orders' AND LastSyncedVersion > 0") === 1, 300000),
       `the branch re-seeds after its watermark expired (${Math.round((Date.now() - since) / 1000)} s)`);
    ok(await wait(() => n(BR, "SELECT COUNT(*) FROM sync.table_state WHERE TableName='down:restaurant.MenuItems' AND LastSyncedVersion > 0") === 1, 120000),
       "the down side re-seeds too");
    ok(n(CL, "SELECT COUNT(*) FROM restaurant.Orders") === before.o && n(BR, "SELECT COUNT(*) FROM restaurant.MenuItems") === before.m,
       "a re-seed creates no duplicates and loses nothing");
    sameData();
  },
};

function sameData() {
  const q = "SELECT CONCAT(COUNT(*), '|', SUM(CAST(Total AS decimal(18,2))), '|', COUNT(DISTINCT OrderNumber), '|', CHECKSUM_AGG(CHECKSUM(Id, OrderNumber, Total))) FROM restaurant.Orders";
  const qi = "SELECT CONCAT(COUNT(*), '|', SUM(Quantity), '|', CHECKSUM_AGG(CHECKSUM(Id, OrderId, Quantity))) FROM restaurant.OrderItems";
  ok(one(CL, q) === one(BR, q), "orders at head office match the branch exactly (count, total, numbers, ids)", { cloud: one(CL, q), branch: one(BR, q) });
  ok(one(CL, qi) === one(BR, qi), "order lines match exactly", { cloud: one(CL, qi), branch: one(BR, qi) });
  ok(n(CL, "SELECT COUNT(*) FROM (SELECT OrderNumber FROM restaurant.Orders GROUP BY OrderNumber HAVING COUNT(*) > 1) d") === 0, "no order number is used twice");
}

(async () => {
  const p = process.argv[2];
  if (!phases[p]) { console.log("phases:", Object.keys(phases).join(", ")); process.exit(2); }
  await phases[p]();
  console.log(`\n[${p}] ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
