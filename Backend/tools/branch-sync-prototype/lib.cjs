const crypto = require("crypto");
const SECRET = "test-only-multibranch-secret-0123456789abcdefghij";
const TENANT = "4BE5DD59-EEBC-459F-9A42-B19AF2749F8B", ADMIN = "4023E5D8-AD7B-401B-922E-4AD2750BB6B3";
const b64 = o => Buffer.from(typeof o === "string" ? o : JSON.stringify(o)).toString("base64url");
const PERMS = ["tables", "orders", "menu", "kitchen", "branches", "tax", "integrations"].flatMap(r => ["view", "create", "edit"].map(a => `restaurant.${r}.${a}`))
  .concat(["restaurant.orders.discount", "pos.sessions.approve", "pos.sessions.create", "pos.sessions.view", "pos.transactions.create", "settings.branches.create", "settings.branches.view"]);
function tok(uid = ADMIN, perms = PERMS, secret = SECRET) {
  const now = Math.floor(Date.now() / 1000);
  const p = { sub: uid, "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier": uid, username: "t", tenant_id: TENANT,
    tenant_slug: "softaxis", modules: "restaurant,pos", subscription_state: "active", currency: "PKR", permission: perms,
    iss: "Softaxis.Identity.API", aud: "Softaxis.ERP.Clients", iat: now, nbf: now, exp: now + 7200 };
  const h = b64({ alg: "HS256", typ: "JWT" }), b = b64(p);
  return h + "." + b + "." + crypto.createHmac("sha256", secret).update(h + "." + b).digest("base64url");
}
const mk = api => async (t, m, u, body, headers = {}) => {
  const r = await fetch(api + u, { method: m, headers: { ...(t ? { Authorization: "Bearer " + t } : {}), "Content-Type": "application/json", ...headers },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body) });
  let j = null; try { j = await r.json(); } catch {}
  const raw = j;
  if (j && j.data !== undefined && j.success !== undefined) j = j.data;
  return { s: r.status, j, raw };
};
const BRANCH_SECRET = "branch-only-secret-9876543210zyxwvutsrqponmlkjihgfedcba";
module.exports = { BRANCH_SECRET, tok, mk, TENANT, ADMIN, crypto };
