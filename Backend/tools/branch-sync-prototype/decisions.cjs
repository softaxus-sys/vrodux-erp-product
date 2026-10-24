// Design decisions 2 and 3 (§12): a branch server refuses wallet / house-account / loyalty and does not create or change
// customers - those are head-office balances and records. Head office itself is unaffected.
// Needs start-cloud4.sh + start-branch3.sh running with an issued key (run-failure.sh's keys1 phase, or failure.cjs keys1).
const crypto = require("crypto");
const { mk } = require("./lib.cjs");
const { execSync } = require("child_process");
const cloud = mk("http://localhost:5301"), branch = mk("http://localhost:5302");
const TENANT = "4BE5DD59-EEBC-459F-9A42-B19AF2749F8B", ADMIN = "4023E5D8-AD7B-401B-922E-4AD2750BB6B3", B1 = "089A949F-86F7-41F8-BC10-12FC6538DD6E";
const b64 = o => Buffer.from(JSON.stringify(o)).toString("base64url");
const PERMS = ["restaurant.orders.view", "restaurant.orders.create", "restaurant.orders.edit", "restaurant.menu.view", "restaurant.menu.create",
  "restaurant.tables.view", "pos.customers.view", "pos.customers.create", "pos.customers.edit", "pos.sessions.create", "pos.sessions.view"];
function tok(secret) {
  const now = Math.floor(Date.now() / 1000);
  const p = { sub: ADMIN, "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier": ADMIN, username: "t", tenant_id: TENANT,
    tenant_slug: "softaxis", modules: "restaurant,pos,crm,crm.basic", subscription_state: "active", currency: "PKR", permission: PERMS,
    iss: "Softaxis.Identity.API", aud: "Softaxis.ERP.Clients", iat: now, nbf: now, exp: now + 7200 };
  const h = b64({ alg: "HS256", typ: "JWT" }), b = b64(p);
  return h + "." + b + "." + crypto.createHmac("sha256", secret).update(h + "." + b).digest("base64url");
}
const ct = tok("test-only-multibranch-secret-0123456789abcdefghij"), bt = tok("branch-only-secret-9876543210zyxwvutsrqponmlkjihgfedcba");
let pass = 0, fail = 0;
const ok = (c, m, x) => { if (c) { pass++; console.log("PASS", m); } else { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 400)); } };
const one = (db, q) => execSync(`sqlcmd -S SHAHBAZ-QFINITY -d ${db} -E -C -h -1 -W -Q "SET QUOTED_IDENTIFIER ON; SET NOCOUNT ON; ${q}"`, { encoding: "utf8" }).trim().split(/\r?\n/)[0]?.trim();
const wait = async (fn, ms = 60000) => { const s = Date.now(); while (Date.now() - s < ms) { try { if (await fn()) return true; } catch {} await new Promise(r => setTimeout(r, 1500)); } return false; };
const refused = r => r.s >= 400 && /Branch.Conflict/.test(JSON.stringify(r.raw ?? r.j));

(async () => {
  // Head office: a customer with wallet credit and points.
  const c = await cloud(ct, "POST", "/api/customers", { name: "Sara Khan", phone: "0300" + Date.now().toString().slice(-7) });
  const cid = c.j?.id;
  ok(c.s === 200 || c.s === 201, "head office creates a customer", c);
  const top = await cloud(ct, "POST", `/api/customers/${cid}/wallet/topup`, { amount: 5000, paymentMethod: "Cash" });
  ok(top.s === 200, "head office tops up the wallet (unchanged behaviour at head office)", top);
  ok(await wait(() => one("SoftaxisProtoBranch", `SELECT COUNT(*) FROM pos.customers WHERE Id='${cid}'`) === "1"), "the customer reaches the branch");

  // Branch: customer records are read-only.
  ok(refused(await branch(bt, "POST", "/api/customers", { name: "Walk In", phone: "0311" + Date.now().toString().slice(-7) })), "the branch cannot create a customer");
  ok(refused(await branch(bt, "PUT", `/api/customers/${cid}`, { id: cid, name: "Changed", phone: null, email: null, address: null, isActive: true, notes: null })), "…or change one");
  ok(refused(await branch(bt, "POST", `/api/customers/${cid}/wallet/topup`, { amount: 100, paymentMethod: "Cash" })), "…or top up a wallet");
  ok(refused(await branch(bt, "POST", `/api/customers/${cid}/loyalty/adjust`, { points: 10, reason: "x" })), "…or adjust points");

  // Branch: a bill for that customer.
  const item = (await branch(bt, "GET", "/api/restaurant/menu")).j?.flatMap(x => x.items)?.[0];
  ok(!!item, "the branch has a menu item");
  const o = (await branch(bt, "POST", "/api/restaurant/orders", { waiter: "Ali", covers: 1, orderType: "takeaway", branchId: B1, items: [{ menuItemId: item.id, quantity: 2 }] })).j;
  const link = await branch(bt, "PATCH", `/api/restaurant/orders/${o.id}/customer`, { customerId: cid });
  ok(link.s === 200, "the customer can be linked to a bill at the branch", link);
  ok(refused(await branch(bt, "POST", `/api/restaurant/orders/${o.id}/payments`, { method: "Wallet", amount: 100 })), "paying by wallet is refused at the branch");
  ok(refused(await branch(bt, "POST", `/api/restaurant/orders/${o.id}/payments`, { method: "House Account", amount: 100 })), "paying by house account is refused");
  ok(refused(await branch(bt, "POST", `/api/restaurant/orders/${o.id}/loyalty`, { points: 5 })), "redeeming loyalty points is refused");
  const before = one("SoftaxisProtoBranch", `SELECT CAST(LoyaltyPoints AS int) FROM pos.customers WHERE Id='${cid}'`);
  const cash = await branch(bt, "POST", `/api/restaurant/orders/${o.id}/payments`, { method: "Cash", amount: o.total });
  ok(cash.s === 200 && cash.j?.status === "paid", "cash is accepted as usual", cash);
  ok(one("SoftaxisProtoBranch", `SELECT CAST(LoyaltyPoints AS int) FROM pos.customers WHERE Id='${cid}'`) === before, "no points are earned at the branch (head office's balance is not touched)");
  ok(one("SoftaxisProtoBranch", `SELECT CAST(WalletBalance AS int) FROM pos.customers WHERE Id='${cid}'`) === "5000", "the wallet balance at the branch is unchanged");

  // Head office still allows everything for a cloud-run branch.
  const c2 = await cloud(ct, "POST", "/api/customers", { name: "HO Customer", phone: "0322" + Date.now().toString().slice(-7) });
  ok(c2.s === 200 || c2.s === 201, "head office can still create customers");
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
