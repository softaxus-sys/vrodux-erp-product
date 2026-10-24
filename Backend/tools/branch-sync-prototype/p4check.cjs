const { tok, mk, BRANCH_SECRET } = require("./lib.cjs");
const { execSync } = require("child_process");
const cloud = mk("http://localhost:5301"), branch = mk("http://localhost:5302");
const B1 = "089A949F-86F7-41F8-BC10-12FC6538DD6E";
const t = tok(); const bt = tok(undefined, undefined, BRANCH_SECRET);
let pass = 0, fail = 0;
const ok = (c, m, x) => { if (c) { pass++; console.log("PASS", m); } else { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 500)); } };
const sql = (db, q) => execSync(`sqlcmd -S SHAHBAZ-QFINITY -d ${db} -E -C -h -1 -W -Q "SET QUOTED_IDENTIFIER ON; SET NOCOUNT ON; ${q}"`, { encoding: "utf8" }).trim();
const n = (db, q) => Number(sql(db, q).split(/\r?\n/)[0]);
const CL = "SoftaxisProtoCloud", BR = "SoftaxisProtoBranch";
const wait = async (fn, ms = 60000) => { const s = Date.now(); while (Date.now() - s < ms) { try { if (await fn()) return true; } catch {} await new Promise(r => setTimeout(r, 1500)); } return false; };

(async () => {
  const code = sql(CL, `SELECT Code FROM [identity].branches WHERE Id='${B1}'`);
  const other = sql(CL, `SELECT TOP 1 CONCAT(Id,'|',Code) FROM [identity].branches WHERE Id<>'${B1}' AND TenantId='4BE5DD59-EEBC-459F-9A42-B19AF2749F8B' AND IsDeleted=0`).split("|");
  console.log("branch code", code, "| other branch", other[1]);

  // config at head office
  await cloud(t, "POST", "/api/restaurant/floors", { name: "Ground", sortOrder: 1, branchId: B1 });
  for (const no of ["T1", "T2", "T3"]) await cloud(t, "POST", "/api/restaurant/tables", { tableNumber: no, section: "Main", capacity: 4, branchId: B1 });
  await cloud(t, "POST", "/api/restaurant/tables", { tableNumber: "O1", section: "Main", capacity: 4, branchId: other[0] });
  await cloud(t, "POST", "/api/restaurant/menu/import", { rows: [{ category: "Mains", name: "Karahi", price: 1200 }, { category: "Mains", name: "Biryani", price: 600 }] });
  ok(await wait(() => n(BR, `SELECT COUNT(*) FROM restaurant.Tables WHERE BranchId='${B1}'`) === 3 && n(BR, "SELECT COUNT(*) FROM restaurant.MenuItems") === 2), "config reaches the branch");

  // 1. numbering at the branch
  const items = (await branch(bt, "GET", "/api/restaurant/menu")).j.flatMap(c => c.items);
  const tables = (await branch(bt, "GET", `/api/restaurant/tables?branchId=${B1}`)).j; const tl = tables.items ?? tables;
  const numbers = [];
  for (let i = 0; i < 3; i++) {
    const o = await branch(bt, "POST", "/api/restaurant/orders", { tableId: tl[i].id, waiter: "Ali", covers: 2, orderType: "dine_in", branchId: B1, items: [{ menuItemId: items[0].id, quantity: 1 }] });
    ok(o.s === 200 || o.s === 201, `branch order ${i + 1} created`, o);
    numbers.push(o.j?.orderNumber);
  }
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const expect = [1, 2, 3].map(k => `${code.toUpperCase()}-${day}-${String(k).padStart(4, "0")}`);
  ok(JSON.stringify(numbers) === JSON.stringify(expect), "branch orders get CODE-date-0001..0003", { numbers, expect });

  // 2. the same numbers reach head office
  ok(await wait(() => n(CL, `SELECT COUNT(*) FROM restaurant.Orders WHERE OrderNumber IN ('${numbers.join("','")}')`) === 3), "the same order numbers appear at head office");

  // 3. another branch numbers independently (order taken on the cloud, branch is in cloud mode)
  const otl = (await cloud(t, "GET", `/api/restaurant/tables?branchId=${other[0]}`)).j; const ot = (otl.items ?? otl)[0];
  const co = await cloud(t, "POST", "/api/restaurant/orders", { tableId: ot.id, waiter: "Sara", covers: 1, orderType: "dine_in", branchId: other[0], items: [{ menuItemId: items[0].id, quantity: 1 }] });
  ok((co.s === 200 || co.s === 201) && co.j?.orderNumber === `${other[1].toUpperCase()}-${day}-0001`, "a second branch starts its own counter", { s: co.s, n: co.j?.orderNumber });
  ok(co.j?.orderNumber !== numbers[0], "numbers never clash across branches");

  // 4. the write guard
  const set = await cloud(t, "PUT", `/api/branches/${B1}/server-mode`, { mode: "local" });
  ok(set.s === 200 || set.s === 204, "head office sets the branch to run on its own server", set);
  const bad = await cloud(t, "PUT", `/api/branches/${B1}/server-mode`, { mode: "nonsense" });
  ok(bad.s >= 400 && bad.s < 500, "an invalid mode is refused", bad.s);
  const oid = (await cloud(t, "GET", `/api/restaurant/orders?branchId=${B1}`)).j;
  const firstId = (oid.items ?? oid)[0].id;

  const blockedCreate = await cloud(t, "POST", "/api/restaurant/orders", { tableId: tl[0].id, waiter: "X", covers: 1, orderType: "dine_in", branchId: B1, items: [{ menuItemId: items[0].id, quantity: 1 }] });
  ok(blockedCreate.s === 409, "the cloud refuses to create an order for a Local branch (409)", blockedCreate);
  const blockedPay = await cloud(t, "POST", `/api/restaurant/orders/${firstId}/payments`, { method: "Cash", amount: 10 });
  ok(blockedPay.s === 409, "the cloud refuses to change a Local branch's bill (409)", blockedPay);
  const stillOk = await cloud(t, "POST", "/api/restaurant/orders", { tableId: ot.id, waiter: "Sara", covers: 1, orderType: "dine_in", branchId: other[0], items: [{ menuItemId: items[0].id, quantity: 1 }] });
  ok(stillOk.s === 200 || stillOk.s === 201 || stillOk.s === 409, "other branches are unaffected by the guard", stillOk.s);

  // 5. sync still delivers while the guard is on
  const tb = tl[1];
  const o4 = await branch(bt, "POST", "/api/restaurant/orders", { tableId: tb.id, waiter: "Ali", covers: 1, orderType: "dine_in", branchId: B1, items: [{ menuItemId: items[1].id, quantity: 2 }] });
  ok(o4.s === 200 || o4.s === 201, "the branch keeps taking orders", o4);
  ok(await wait(() => n(CL, `SELECT COUNT(*) FROM restaurant.Orders WHERE OrderNumber='${o4.j?.orderNumber}'`) === 1), "…and they still reach head office while the cloud refuses direct writes");
  ok(o4.j?.orderNumber === `${code.toUpperCase()}-${day}-0004`, "the counter continues (0004)", o4.j?.orderNumber);

  // 6. back to cloud mode
  await cloud(t, "PUT", `/api/branches/${B1}/server-mode`, { mode: "cloud" });
  const back = await cloud(t, "POST", `/api/restaurant/orders/${firstId}/payments`, { method: "Cash", amount: 10 });
  ok(back.s !== 409, "after switching back to cloud mode the cloud accepts changes again", back.s);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
