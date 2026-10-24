// P5: QR and Foodpanda orders that reach the cloud for a branch on its own server are relayed to it.
// Needs: start-cloud3.sh (:5301), start-branch2.sh (:5302), fake-foodpanda.cjs (:5399), seed-cloud.sql loaded.
// Run: node relay.cjs main   then stop the branch, run  node relay.cjs offline,  restart the branch.
const { tok, mk, BRANCH_SECRET } = require("./lib.cjs");
const { execSync } = require("child_process");
const cloud = mk("http://localhost:5301"), branch = mk("http://localhost:5302");
const B1 = "089A949F-86F7-41F8-BC10-12FC6538DD6E";
const t = tok(), bt = tok(undefined, undefined, BRANCH_SECRET);
let pass = 0, fail = 0;
const ok = (c, m, x) => { if (c) { pass++; console.log("PASS", m); } else { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 600)); } };
const sql = (db, q) => execSync(`sqlcmd -S SHAHBAZ-QFINITY -d ${db} -E -C -h -1 -W -Q "SET QUOTED_IDENTIFIER ON; SET NOCOUNT ON; ${q}"`, { encoding: "utf8" }).trim();
const one = (db, q) => sql(db, q).split(/\r?\n/)[0]?.trim();
const n = (db, q) => Number(one(db, q));
const CL = "SoftaxisProtoCloud", BR = "SoftaxisProtoBranch";
const wait = async (fn, ms = 60000) => { const s = Date.now(); while (Date.now() - s < ms) { try { if (await fn()) return true; } catch {} await new Promise(r => setTimeout(r, 1500)); } return false; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fpOrder = (token, name) => JSON.stringify({ token, code: token.slice(0, 6), expeditionType: "delivery",
  customer: { firstName: "Sara", lastName: "K", mobilePhone: "0300" }, products: [{ name, remoteCode: null, quantity: 2, unitPrice: 600, paidPrice: 1200 }] });
const calls = async () => (await fetch("http://localhost:5399/calls")).json();

async function setup() {
  await cloud(t, "POST", "/api/restaurant/floors", { name: "Ground", sortOrder: 1, branchId: B1 });
  await cloud(t, "POST", "/api/restaurant/tables", { tableNumber: "Q1", section: "Main", capacity: 4, branchId: B1 });
  await cloud(t, "POST", "/api/restaurant/menu/import", { rows: [{ category: "Mains", name: "Karahi", price: 1200 }] });
  const r = await cloud(t, "POST", "/api/restaurant/platforms", { branchId: B1, remoteId: "V1", environment: "sandbox", username: "u", password: "p", autoAccept: false });
  ok(r.s === 200, "Foodpanda connection saved on the cloud", r);
  ok(await wait(() => n(BR, `SELECT COUNT(*) FROM restaurant.Tables WHERE TableNumber='Q1'`) === 1 && n(BR, "SELECT COUNT(*) FROM restaurant.MenuItems") >= 1), "config reaches the branch");
  ok(n(BR, "SELECT COUNT(*) FROM restaurant.PlatformConnections") === 0, "Foodpanda credentials never reach the branch");
}

async function main() {
  await setup();
  const qr = one(CL, "SELECT QrCode FROM restaurant.Tables WHERE TableNumber='Q1'");
  const key = one(CL, "SELECT InboundKey FROM restaurant.PlatformConnections");
  const item = one(CL, "SELECT CAST(Id AS varchar(36)) FROM restaurant.MenuItems WHERE Name='Karahi'");
  const guest = { qrCode: qr, notes: "no chilli", guestDeviceToken: "phone-1", items: [{ menuItemId: item, quantity: 2 }] };

  await cloud(t, "PUT", `/api/branches/${B1}/server-mode`, { mode: "local" });
  await sleep(8000);

  // ── QR ──
  const q = await cloud(null, "POST", "/api/restaurant/public-orders", guest);
  ok(q.s === 200 && q.j?.orderId, "guest places a QR order at the cloud", q);
  const qid = q.j?.orderId;
  ok(n(CL, `SELECT COUNT(*) FROM restaurant.RelayedOrders WHERE Id='${qid}' AND Kind='qr_order'`) === 1, "it is queued for the branch");
  ok(n(CL, `SELECT COUNT(*) FROM restaurant.Orders WHERE Id='${qid}'`) === 0, "the cloud does not write the bill itself");
  ok(q.j?.total > 0, "the guest is told the total", q.j);
  ok(await wait(() => n(BR, `SELECT COUNT(*) FROM restaurant.Orders WHERE Id='${qid}' AND OrderChannel='qr_table'`) === 1), "the bill appears at the branch with the same id");
  ok(n(BR, `SELECT COUNT(*) FROM restaurant.OrderItems WHERE OrderId='${qid}'`) === 1, "…with its line");
  ok(await wait(() => n(CL, `SELECT COUNT(*) FROM restaurant.Orders WHERE Id='${qid}'`) === 1), "…and reaches head office through the normal up-sync");
  ok(await wait(() => one(CL, `SELECT Status FROM restaurant.RelayedOrderResults WHERE Id='${qid}'`) === "applied"), "head office sees the relay as applied");
  const num = one(CL, `SELECT OrderNumber FROM restaurant.RelayedOrderResults WHERE Id='${qid}'`);
  ok(num && num === one(BR, `SELECT OrderNumber FROM restaurant.Orders WHERE Id='${qid}'`), "…with the branch's order number", num);

  const bad = await cloud(null, "POST", "/api/restaurant/public-orders", { ...guest, items: [{ menuItemId: "00000000-0000-0000-0000-000000000001", quantity: 1 }] });
  ok(bad.s >= 400 && bad.s < 500, "an unknown item is refused at once, not relayed", bad);

  // Same table again: the branch says it is occupied; the relay records why.
  const q2 = await cloud(null, "POST", "/api/restaurant/public-orders", { ...guest, guestDeviceToken: "phone-2" });
  ok(q2.s === 200, "a second order for the same table is accepted by the cloud (it cannot see live table status)", q2);
  ok(await wait(() => one(CL, `SELECT Status FROM restaurant.RelayedOrderResults WHERE Id='${q2.j?.orderId}'`) === "rejected"), "the branch rejects it (table occupied) and head office can see that");
  ok(n(BR, `SELECT COUNT(*) FROM restaurant.Orders WHERE Id='${q2.j?.orderId}'`) === 0, "…and no bill was created");

  // ── Foodpanda ──
  const body = fpOrder("tok-accept-1", "Karahi");
  const f = await cloud(null, "POST", `/api/restaurant/platforms/foodpanda/${key}/order/V1`, body);
  const fid = f.j?.remoteResponse?.remoteOrderId;
  ok(f.s === 200 && fid, "Foodpanda posts an order to the cloud and gets an id back", f);
  const again = await cloud(null, "POST", `/api/restaurant/platforms/foodpanda/${key}/order/V1`, body);
  ok(again.j?.remoteResponse?.remoteOrderId === fid, "a resent Foodpanda order gets the same id and is not queued twice", again);
  ok(n(CL, `SELECT COUNT(*) FROM restaurant.RelayedOrders WHERE ExternalRef='tok-accept-1'`) === 1, "…one relay row");
  ok(await wait(() => one(BR, `SELECT ExternalStatus FROM restaurant.Orders WHERE Id='${fid}'`) === "new"), "the Foodpanda bill appears at the branch, waiting to be answered");

  const acc = await branch(bt, "POST", `/api/restaurant/platforms/orders/${fid}/accept`, { prepMinutes: 15 });
  ok(acc.s === 200 && acc.j?.externalStatus === "accepting", "accept at the branch till - pending while the cloud tells Foodpanda", acc);
  const twice = await branch(bt, "POST", `/api/restaurant/platforms/orders/${fid}/accept`, {});
  ok(twice.s === 409, "it cannot be answered twice while pending", twice);
  ok(await wait(async () => (await calls()).some(c => c.token === "tok-accept-1" && c.status === "order_accepted" && c.remoteOrderId === fid)), "the cloud calls Foodpanda with the branch's order id");
  ok(await wait(() => one(BR, `SELECT ExternalStatus FROM restaurant.Orders WHERE Id='${fid}'`) === "accepted"), "the branch marks it accepted");
  ok(one(BR, `SELECT Status FROM restaurant.Orders WHERE Id='${fid}'`) === "sent", "…and sends it to the kitchen");

  // A refusal from Foodpanda puts the order back to "new".
  const f2 = await cloud(null, "POST", `/api/restaurant/platforms/foodpanda/${key}/order/V1`, fpOrder("tok-fail-2", "Karahi"));
  const f2id = f2.j?.remoteResponse?.remoteOrderId;
  ok(await wait(() => n(BR, `SELECT COUNT(*) FROM restaurant.Orders WHERE Id='${f2id}'`) === 1), "a second Foodpanda order reaches the branch");
  await branch(bt, "POST", `/api/restaurant/platforms/orders/${f2id}/accept`, {});
  ok(await wait(() => one(CL, `SELECT r.Status FROM restaurant.PlatformActionResults r JOIN restaurant.PlatformActionRequests q ON q.Id=r.Id WHERE q.OrderId='${f2id}'`) === "failed"), "Foodpanda refuses the accept; the failure comes back");
  ok(await wait(() => one(BR, `SELECT ExternalStatus FROM restaurant.Orders WHERE Id='${f2id}'`) === "new"), "…and the branch puts the order back to waiting");

  const rej = await branch(bt, "POST", `/api/restaurant/platforms/orders/${f2id}/reject`, { reason: "TOO_BUSY", message: "full" });
  ok(rej.s === 200 && rej.j?.externalStatus === "rejecting", "reject at the branch", rej);
  ok(await wait(async () => (await calls()).some(c => c.token === "tok-fail-2" && c.status === "order_rejected" && c.reason === "TOO_BUSY")), "the cloud passes the rejection reason to Foodpanda");

  // Cancellation from Foodpanda, sent before the branch has even created the bill.
  const f3 = await cloud(null, "POST", `/api/restaurant/platforms/foodpanda/${key}/order/V1`, fpOrder("tok-cancel-3", "Karahi"));
  const f3id = f3.j?.remoteResponse?.remoteOrderId;
  const cancel = await cloud(null, "PUT", `/api/restaurant/platforms/foodpanda/${key}/remoteId/V1/remoteOrder/${f3id}/posOrderStatus`, JSON.stringify({ status: "ORDER_CANCELLED", message: "customer" }));
  ok(cancel.s === 204, "Foodpanda cancels an order (even before the branch has it)", cancel);
  ok(await wait(() => one(BR, `SELECT Status FROM restaurant.Orders WHERE Id='${f3id}'`) === "cancelled"), "the branch creates the bill, then cancels it");
  ok(one(BR, `SELECT ExternalStatus FROM restaurant.Orders WHERE Id='${f3id}'`) === "cancelled", "…marked cancelled on Foodpanda");
  const unknown = await cloud(null, "PUT", `/api/restaurant/platforms/foodpanda/${key}/remoteId/V1/remoteOrder/00000000-0000-0000-0000-000000000009/posOrderStatus`, JSON.stringify({ status: "ORDER_CANCELLED" }));
  ok(unknown.s === 404, "a cancellation for an unknown order is refused", unknown);

  // Hand over: settled at the branch at once; Foodpanda is told through the cloud.
  const ho = await branch(bt, "POST", `/api/restaurant/platforms/orders/${fid}/handover`);
  ok(ho.s === 200 && ho.j?.status === "paid", "hand-over at the branch settles the bill there", ho);
  ok(await wait(async () => (await calls()).some(c => c.token === "tok-accept-1" && c.status === "order_picked_up")), "…and the cloud tells Foodpanda it was picked up");

  ok(n(CL, "SELECT COUNT(*) FROM restaurant.RelayedOrders WHERE TenantId IS NULL") === 0 &&
     n(BR, "SELECT COUNT(*) FROM restaurant.RelayedOrderResults WHERE TenantId IS NULL") === 0 &&
     n(CL, "SELECT COUNT(*) FROM restaurant.PlatformActionResults WHERE TenantId IS NULL") === 0, "every new row carries the workspace");
  done();
}

async function offline() {
  const qr = one(CL, "SELECT QrCode FROM restaurant.Tables WHERE TableNumber='Q1'");
  const key = one(CL, "SELECT InboundKey FROM restaurant.PlatformConnections");
  const item = one(CL, "SELECT CAST(Id AS varchar(36)) FROM restaurant.MenuItems WHERE Name='Karahi'");
  await sleep(25000);
  const before = n(CL, "SELECT COUNT(*) FROM restaurant.RelayedOrders");
  const q = await cloud(null, "POST", "/api/restaurant/public-orders", { qrCode: qr, guestDeviceToken: "phone-9", items: [{ menuItemId: item, quantity: 1 }] });
  ok(q.s === 409 && /not taking table orders/.test(JSON.stringify(q.raw)), "branch offline: the guest is told to ask staff", q);
  const f = await cloud(null, "POST", `/api/restaurant/platforms/foodpanda/${key}/order/V1`, fpOrder("tok-offline-9", "Karahi"));
  ok(f.s === 409, "branch offline: Foodpanda gets no acceptance", f);
  ok(n(CL, "SELECT COUNT(*) FROM restaurant.RelayedOrders") === before, "nothing is queued for an offline branch");
  done();
}

function done() { console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0); }
({ main, offline })[process.argv[2] ?? "main"]().catch(e => { console.error(e); process.exit(2); });
