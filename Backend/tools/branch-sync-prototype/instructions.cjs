const { tok, mk, BRANCH_SECRET, crypto } = require("./lib.cjs");
const { execSync } = require("child_process");
const cloud = mk("http://localhost:5301"), branch = mk("http://localhost:5302");
const B1 = "089A949F-86F7-41F8-BC10-12FC6538DD6E";
const HO_USER = "4023E5D8-AD7B-401B-922E-4AD2750BB6B3";   // the head-office user who asks
const PERMS_HO = ["restaurant.orders.view", "restaurant.orders.void", "restaurant.orders.refund", "restaurant.tables.create", "restaurant.menu.create", "restaurant.menu.view", "restaurant.tables.view", "restaurant.orders.create", "restaurant.orders.edit"];
const t = tok(HO_USER, PERMS_HO);
const noPerm = tok(crypto.randomUUID(), ["restaurant.orders.view"]);
const bt = tok(undefined, undefined, BRANCH_SECRET);
let pass = 0, fail = 0;
const ok = (c, m, x) => { if (c) { pass++; console.log("PASS", m); } else { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 500)); } };
const sql = (db, q) => execSync(`sqlcmd -S SHAHBAZ-QFINITY -d ${db} -E -C -h -1 -W -Q "SET QUOTED_IDENTIFIER ON; SET NOCOUNT ON; ${q}"`, { encoding: "utf8" }).trim();
const n = (db, q) => Number(sql(db, q).split(/\r?\n/)[0]);
const CL = "SoftaxisProtoCloud", BR = "SoftaxisProtoBranch";
const wait = async (fn, ms = 60000) => { const s = Date.now(); while (Date.now() - s < ms) { try { if (await fn()) return true; } catch {} await new Promise(r => setTimeout(r, 1500)); } return false; };
const err = r => r.raw?.errorCode ?? r.j?.code ?? r.j?.errorCode;

(async () => {
  // config + two paid/unpaid bills at the branch
  await cloud(t, "POST", "/api/restaurant/floors", { name: "Ground", sortOrder: 1, branchId: B1 });
  for (const no of ["T1", "T2", "T3"]) await cloud(t, "POST", "/api/restaurant/tables", { tableNumber: no, section: "Main", capacity: 4, branchId: B1 });
  await cloud(t, "POST", "/api/restaurant/menu/import", { rows: [{ category: "Mains", name: "Karahi", price: 1200 }] });
  ok(await wait(() => n(BR, `SELECT COUNT(*) FROM restaurant.Tables WHERE BranchId='${B1}'`) === 3 && n(BR, "SELECT COUNT(*) FROM restaurant.MenuItems") === 1), "config reaches the branch");

  const item = (await branch(bt, "GET", "/api/restaurant/menu")).j.flatMap(c => c.items)[0];
  const tl = (await branch(bt, "GET", `/api/restaurant/tables?branchId=${B1}`)).j; const tables = tl.items ?? tl;
  const mk1 = async (i) => (await branch(bt, "POST", "/api/restaurant/orders", { tableId: tables[i].id, waiter: "Ali", covers: 1, orderType: "dine_in", branchId: B1, items: [{ menuItemId: item.id, quantity: 1 }] })).j;
  const voidMe = await mk1(0), refundMe = await mk1(1);
  const paid = await branch(bt, "POST", `/api/restaurant/orders/${refundMe.id}/payments`, { method: "Cash", amount: refundMe.total });
  ok(paid.s === 200, "branch takes a bill and a paid bill", paid);
  ok(await wait(() => n(CL, `SELECT COUNT(*) FROM restaurant.Orders WHERE Id IN ('${voidMe.id}','${refundMe.id}')`) === 2), "both bills reach head office");

  // refused when the branch runs on the cloud
  const early = await cloud(t, "POST", "/api/restaurant/branch-instructions", { branchId: B1, kind: "void_order", orderId: voidMe.id, reason: "x" });
  ok(err(early) === "Branch.Conflict", "refused while the branch still runs on the cloud (change the bill directly)", early);

  await cloud(t, "PUT", `/api/branches/${B1}/server-mode`, { mode: "local" });
  await new Promise(r => setTimeout(r, 8000));     // let the mode reach the branch

  // permissions and validation
  const denied = await cloud(noPerm, "POST", "/api/restaurant/branch-instructions", { branchId: B1, kind: "void_order", orderId: voidMe.id, reason: "x" });
  ok(err(denied) === "Permission.Denied", "a user without the void permission is refused", denied);
  const badKind = await cloud(t, "POST", "/api/restaurant/branch-instructions", { branchId: B1, kind: "delete_everything", orderId: voidMe.id, reason: "x" });
  ok(badKind.s >= 400, "an unknown kind is refused", badKind.s);
  const noAmount = await cloud(t, "POST", "/api/restaurant/branch-instructions", { branchId: B1, kind: "refund_order", orderId: refundMe.id, reason: "x" });
  ok(noAmount.s >= 400, "a refund without an amount is refused", noAmount.s);
  const wrong = await cloud(t, "POST", "/api/restaurant/branch-instructions", { branchId: B1, kind: "void_order", orderId: crypto.randomUUID(), reason: "x" });
  ok(err(wrong) === "Order.NotFound", "an unknown order is refused", wrong);

  // void
  const v = await cloud(t, "POST", "/api/restaurant/branch-instructions", { branchId: B1, kind: "void_order", orderId: voidMe.id, reason: "Customer left without ordering" });
  ok(v.s === 200 || v.s === 201, "head office asks the branch to void a bill", v);
  ok(await wait(() => n(BR, `SELECT COUNT(*) FROM restaurant.BranchInstructions WHERE OrderId='${voidMe.id}'`) === 1), "the request reaches the branch");
  ok(await wait(() => sql(BR, `SELECT Status FROM restaurant.Orders WHERE Id='${voidMe.id}'`) === "cancelled", 90000), "the branch voids the bill");
  ok(await wait(() => sql(CL, `SELECT Status FROM restaurant.Orders WHERE Id='${voidMe.id}'`) === "cancelled"), "…and head office sees it voided");
  const voidLog = sql(BR, `SELECT TOP 1 CAST(VoidedByUserId AS NVARCHAR(50)) FROM restaurant.OrderVoidLogs WHERE OrderId='${voidMe.id}'`);
  ok(voidLog.toLowerCase() === HO_USER.toLowerCase(), "the void is recorded under the head-office user who asked", voidLog);

  // refund
  const rf = await cloud(t, "POST", "/api/restaurant/branch-instructions", { branchId: B1, kind: "refund_order", orderId: refundMe.id, reason: "Cold food", amount: 100, method: "Cash" });
  ok(rf.s === 200 || rf.s === 201, "head office asks the branch to refund part of a paid bill", rf);
  ok(await wait(() => n(BR, `SELECT COUNT(*) FROM restaurant.OrderRefunds WHERE OrderId='${refundMe.id}'`) === 1, 90000), "the branch records the refund");
  await new Promise(r => setTimeout(r, 8000));
  ok(n(BR, `SELECT COUNT(*) FROM restaurant.OrderRefunds WHERE OrderId='${refundMe.id}'`) === 1, "the refund ran exactly once");
  ok(await wait(() => n(CL, `SELECT COUNT(*) FROM restaurant.OrderRefunds WHERE OrderId='${refundMe.id}'`) === 1), "…and head office sees it");

  // status as head office reads it
  const list = (await cloud(t, "GET", `/api/restaurant/branch-instructions?branchId=${B1}`)).j;
  ok(await wait(async () => ((await cloud(t, "GET", `/api/restaurant/branch-instructions?branchId=${B1}`)).j ?? []).filter(i => i.status === "applied").length === 2), "both instructions show as applied at head office");

  // a request the branch must reject (void an already-voided bill)
  const again = await cloud(t, "POST", "/api/restaurant/branch-instructions", { branchId: B1, kind: "void_order", orderId: voidMe.id, reason: "again" });
  ok(await wait(async () => ((await cloud(t, "GET", `/api/restaurant/branch-instructions?branchId=${B1}&orderId=${voidMe.id}`)).j ?? []).some(i => i.status === "rejected"), 90000), "a request that cannot be applied is reported back as rejected, with the reason");

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
