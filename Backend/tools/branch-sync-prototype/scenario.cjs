const { tok, mk, TENANT, crypto } = require("./lib.cjs");
const { execSync } = require("child_process");
const fs = require("fs");
const DIR = "C:/Users/Shahbaz/AppData/Local/Temp/proto/";
const cloud = mk("http://localhost:5301"), branch = mk("http://localhost:5302");
const B1 = "e183f04c-3e89-451f-8e01-6317c3d35f7e", B2 = "8a1586a8-9fd3-405d-98f6-f7f83a8955b6";
const t = tok();
let pass = 0, fail = 0;
const ok = (c, m, x) => { if (c) { pass++; console.log("PASS", m); } else { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 400)); } };
const sql = (db, q) => execSync(`sqlcmd -S SHAHBAZ-QFINITY -d ${db} -E -C -h -1 -W -Q "SET NOCOUNT ON; ${q}"`, { encoding: "utf8" }).trim();
const n = (db, q) => Number(sql(db, q).split(/\r?\n/)[0]);
const CL = "SoftaxisProtoCloud", BR = "SoftaxisProtoBranch";
const wait = async (fn, ms = 60000) => { const s = Date.now(); while (Date.now() - s < ms) { try { if (await fn()) return true; } catch {} await new Promise(r => setTimeout(r, 1500)); } return false; };

(async () => {
  const step = process.argv[2] || "all";

  if (step === "down") {
    // DOWN: head office creates config; the branch receives only what is its own
    await cloud(t, "POST", "/api/restaurant/floors", { name: "Ground", sortOrder: 1, branchId: B1 });
    await cloud(t, "POST", "/api/restaurant/floors", { name: "Other branch floor", sortOrder: 1, branchId: B2 });
    for (const no of ["T1", "T2", "T3"]) await cloud(t, "POST", "/api/restaurant/tables", { tableNumber: no, section: "Main", capacity: 4, branchId: B1 });
    await cloud(t, "POST", "/api/restaurant/tables", { tableNumber: "X1", section: "Main", capacity: 4, branchId: B2 });
    const imp = await cloud(t, "POST", "/api/restaurant/menu/import", { rows: [
      { category: "Mains", name: "Karahi", price: 1200 }, { category: "Mains", name: "Biryani", price: 600 }, { category: "Drinks", name: "Lassi", price: 250 } ] });
    ok(imp.s === 200 || imp.s === 201, "head office imports a menu", imp);

    ok(await wait(() => n(BR, "SELECT COUNT(*) FROM restaurant.MenuItems") === 3), "menu reaches the branch server");
    ok(await wait(() => n(BR, `SELECT COUNT(*) FROM restaurant.Tables WHERE BranchId='${B1}'`) === 3), "this branch's tables reach the branch server");
    ok(n(BR, `SELECT COUNT(*) FROM restaurant.Tables WHERE BranchId='${B2}'`) === 0, "another branch's tables are NOT sent");
    ok(n(BR, `SELECT COUNT(*) FROM restaurant.Floors WHERE BranchId='${B2}'`) === 0, "another branch's floor is NOT sent");
  }

  if (step === "up") {
    // UP: the branch trades; head office sees it
    const menu = (await branch(t, "GET", "/api/restaurant/menu")).j;
    const items = menu.flatMap(c => c.items);
    ok(items.length === 3, "branch server serves the synced menu locally", items.length);
    const tables = (await branch(t, "GET", `/api/restaurant/tables?branchId=${B1}`)).j;
    const tbl = (tables.items ?? tables)[0];
    const o = await branch(t, "POST", "/api/restaurant/orders", { tableId: tbl.id, waiter: "Ali", covers: 2, orderType: "dine_in", branchId: B1,
      items: [{ menuItemId: items[0].id, quantity: 2 }, { menuItemId: items[1].id, quantity: 1 }] });
    ok(o.s === 200 || o.s === 201, "branch takes an order against the synced menu", o);
    const oid = o.j?.id;
    const pay = await branch(t, "POST", `/api/restaurant/orders/${oid}/payments`, { method: "Cash", amount: o.j?.total ?? 0 });
    ok(pay.s === 200, "branch takes payment", pay);

    ok(await wait(() => n(CL, `SELECT COUNT(*) FROM restaurant.Orders WHERE Id='${oid}'`) === 1), "order reaches head office");
    ok(await wait(() => n(CL, `SELECT COUNT(*) FROM restaurant.OrderItems WHERE OrderId='${oid}'`) === 2), "order lines reach head office");
    ok(await wait(() => n(CL, `SELECT COUNT(*) FROM restaurant.OrderPayments WHERE OrderId='${oid}'`) === 1), "payment reaches head office");
    fs.writeFileSync(DIR + "state.json", JSON.stringify({ oid, tbl: tbl.id, items: items.map(i => i.id) }));
  }

  if (step === "outage") {
    // the cloud is stopped by the caller; the branch must keep trading
    const s = JSON.parse(fs.readFileSync(DIR + "state.json", "utf8"));
    const tables = (await branch(t, "GET", `/api/restaurant/tables?branchId=${B1}`)).j;
    const list = tables.items ?? tables;
    const made = [];
    for (let i = 0; i < 3; i++) {
      const o = await branch(t, "POST", "/api/restaurant/orders", { tableId: list[(i + 1) % list.length].id, waiter: "Sara", covers: 1, orderType: "dine_in", branchId: B1,
        items: [{ menuItemId: s.items[i % 3], quantity: i + 1 }] });
      ok(o.s === 200 || o.s === 201, `order ${i + 1} taken with the cloud unreachable`, o);
      if (o.j?.id) made.push(o.j.id);
    }
    fs.writeFileSync(DIR + "outage.json", JSON.stringify({ made }));
    ok(n(BR, "SELECT COUNT(*) FROM restaurant.Orders") === 1 + made.length, "branch holds all orders locally");
  }

  if (step === "recover") {
    const { made } = JSON.parse(fs.readFileSync(DIR + "outage.json", "utf8"));
    const total = 1 + made.length;
    ok(await wait(() => n(CL, "SELECT COUNT(*) FROM restaurant.Orders") === total, 120000), `all ${total} orders reach head office after the outage`);
    ok(n(CL, "SELECT COUNT(*) FROM restaurant.Orders") === n(BR, "SELECT COUNT(*) FROM restaurant.Orders"), "no duplicates, no gaps (counts match)");
    ok(n(CL, "SELECT COUNT(*) FROM restaurant.OrderItems") === n(BR, "SELECT COUNT(*) FROM restaurant.OrderItems"), "order lines match too");
  }

  if (step === "price") {
    const menu = (await cloud(t, "GET", "/api/restaurant/menu")).j;
    const item = menu.flatMap(c => c.items).find(i => i.name === "Lassi");
    const r = await cloud(t, "PUT", `/api/restaurant/menu/items/${item.id}`, { name: "Lassi", price: 275, categoryId: item.categoryId, description: null, isAvailable: true, prepTimeMinutes: item.prepTimeMinutes ?? 5, allergens: null });
    ok(r.s === 200, "head office changes a price", r);
    ok(await wait(() => n(BR, "SELECT CAST(Price AS INT) FROM restaurant.MenuItems WHERE Name='Lassi'") === 275), "the new price reaches the branch");
  }

  if (step === "security") {
    const base = "http://localhost:5301/api/sync/branch";
    const KEY = "proto-key-branch1-9f3a";
    const hdr = k => ({ "X-Branch-Id": B1, "X-Branch-Key": k, "Content-Type": "application/json" });
    const post = async (k, body) => (await fetch(base + "/push", { method: "POST", headers: hdr(k), body: JSON.stringify(body) })).status;
    const row = { op: "U", key: ["00000000-0000-0000-0000-000000000001"], data: { Id: "00000000-0000-0000-0000-000000000001", TenantId: TENANT } };
    const req = (table, rows, tenant = TENANT) => ({ tenantId: tenant, licenseKey: "", batchId: crypto.randomUUID(), tableName: table, fromVersion: 0, toVersion: 1, rows });
    ok(await post("wrong-key", req("restaurant.Orders", [])) === 401, "wrong branch key is refused (401)");
    ok(await post(KEY, req("restaurant.MenuItems", [row])) === 403, "a branch cannot write head-office data such as the menu (403)");
    ok(await post(KEY, req("restaurant.PlatformConnections", [row])) === 403, "a branch cannot write a secrets table (403)");
    ok(await post(KEY, req("restaurant.Orders", [], "11111111-1111-1111-1111-111111111111")) === 401, "a branch cannot write into another workspace (401)");
    const other = { op: "U", key: ["00000000-0000-0000-0000-000000000002"], data: { Id: "00000000-0000-0000-0000-000000000002", TenantId: TENANT, BranchId: B2 } };
    ok(await post(KEY, req("restaurant.Orders", [other])) === 403, "a branch cannot write another branch's orders (403)");
    const pull = async (k, table) => (await fetch(`${base}/pull?table=${table}`, { headers: hdr(k) })).status;
    ok(await pull("wrong-key", "restaurant.MenuItems") === 401, "pull with a wrong key is refused (401)");
    ok(await pull(KEY, "restaurant.Orders") === 403, "a branch cannot pull branch-owned tables (403)");
    ok(await pull(KEY, "restaurant.PlatformConnections") === 403, "secret tables are never served (403)");
    ok(await pull(KEY, "identity.users") === 403, "unlisted schemas are never served (403)");
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
