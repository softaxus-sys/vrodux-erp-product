const { tok, mk, TENANT } = require("./lib.cjs");
const { execSync } = require("child_process");
const fs = require("fs");
const DIR = "C:/Users/Shahbaz/AppData/Local/Temp/proto/";
const cloud = mk("http://localhost:5301"), branch = mk("http://localhost:5302");
const BRANCH_ID = "089A949F-86F7-41F8-BC10-12FC6538DD6E";
let pass = 0, fail = 0;
const ok = (c, m, x) => { if (c) { pass++; console.log("PASS", m); } else { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 500)); } };
const sql = (db, q) => execSync(`sqlcmd -S SHAHBAZ-QFINITY -d ${db} -E -C -h -1 -W -Q "SET QUOTED_IDENTIFIER ON; SET NOCOUNT ON; ${q}"`, { encoding: "utf8" }).trim();
const n = (db, q) => Number(sql(db, q).split(/\r?\n/)[0]);
const CL = "SoftaxisProtoCloud", BR = "SoftaxisProtoBranch";
const wait = async (fn, ms = 60000) => { const s = Date.now(); while (Date.now() - s < ms) { try { if (await fn()) return true; } catch {} await new Promise(r => setTimeout(r, 1500)); } return false; };
const ADMIN_PERMS = ["settings.users.create", "settings.users.edit", "settings.users.view", "settings.roles.view"];
const t = tok(undefined, ADMIN_PERMS.concat(["restaurant.orders.view"]));
const PW = "Proto#Pass123";

(async () => {
  const step = process.argv[2];

  if (step === "make-users") {
    const roles = sql(CL, `SELECT CONCAT(Name,'|',Id) FROM [identity].roles WHERE TenantId='${TENANT}' AND Name IN ('Restaurant Cashier','Kitchen Staff')`).split(/\r?\n/).map(l => l.split("|"));
    const rid = Object.fromEntries(roles);
    for (const [email, user, role] of [["cashier@proto.test", "protocashier", "Restaurant Cashier"], ["kitchen@proto.test", "protokitchen", "Kitchen Staff"]]) {
      const r = await cloud(t, "POST", "/api/users", { email, username: user, firstName: "Proto", lastName: user, password: PW, roleIds: [rid[role]] });
      ok(r.s === 200 || r.s === 201, `cloud: create ${email} (${role})`, r);
    }
    sql(CL, "UPDATE [identity].users SET EmailVerified=1, Status=1 WHERE email LIKE '%@proto.test'");
    console.log(sql(CL, "SELECT email, Status, EmailVerified FROM [identity].users WHERE email LIKE '%@proto.test'"));
  }

  if (step === "check") {
    // 1. identity arrives at the branch
    ok(await wait(() => n(BR, "SELECT COUNT(*) FROM [identity].users WHERE email LIKE '%@proto.test'") === 2, 90000), "users reach the branch server");
    ok(n(BR, `SELECT COUNT(*) FROM [identity].tenants`) === 1, "only this workspace's tenant row reaches the branch");
    ok(n(BR, `SELECT COUNT(*) FROM [identity].tenants WHERE Id='${TENANT}'`) === 1, "…and it is the right one");
    ok(n(BR, "SELECT COUNT(*) FROM [identity].users WHERE TenantId <> '" + TENANT + "'") === 0, "no other workspace's users are sent");
    ok(n(BR, "SELECT COUNT(*) FROM [identity].users") === n(CL, `SELECT COUNT(*) FROM [identity].users WHERE TenantId='${TENANT}'`), "user counts match for this workspace");
    ok(n(BR, "SELECT COUNT(*) FROM [identity].roles WHERE TenantId <> '" + TENANT + "'") === 0, "no other workspace's roles are sent");
    ok(n(BR, "SELECT COUNT(*) FROM [identity].user_roles") === n(CL, `SELECT COUNT(*) FROM [identity].user_roles WHERE UserId IN (SELECT Id FROM [identity].users WHERE TenantId='${TENANT}')`), "only this workspace's role assignments are sent");
    ok(n(BR, "SELECT COUNT(*) FROM [identity].role_permissions") === n(CL, `SELECT COUNT(*) FROM [identity].role_permissions WHERE RoleId IN (SELECT Id FROM [identity].roles WHERE TenantId='${TENANT}')`), "only this workspace's role permissions are sent");

    // 2. secrets stay behind
    sql(CL, `UPDATE [identity].users SET TwoFactorSecret='cloud-only-secret', PasswordResetTokenHash='cloud-only-hash' WHERE email='cashier@proto.test'`);
    ok(await wait(() => n(BR, "SELECT COUNT(*) FROM [identity].users WHERE email='cashier@proto.test' AND LastLoginAt IS NULL") >= 0, 5000), "(settle)");
    await new Promise(r => setTimeout(r, 8000));
    ok(n(BR, "SELECT COUNT(*) FROM [identity].users WHERE TwoFactorSecret IS NOT NULL OR PasswordResetTokenHash IS NOT NULL") === 0, "2FA secrets and reset tokens never reach the branch");
    ok(n(BR, "SELECT COUNT(*) FROM [identity].tenants WHERE LicenseKey IS NOT NULL OR ConnectionStrings IS NOT NULL") === 0, "tenant licence key / connection strings never reach the branch");

    // 3. real sign-in at the branch
    const login = await branch(null, "POST", "/api/auth/login", { email: "cashier@proto.test", password: PW });
    ok(login.s === 200 && login.j?.accessToken, "cashier signs in at the branch server", login);
    const bad = await branch(null, "POST", "/api/auth/login", { email: "cashier@proto.test", password: "wrong" });
    ok(bad.s !== 200, "wrong password is refused at the branch", bad.s);
    const tk = login.j?.accessToken;
    fs.writeFileSync(DIR + "branch-token.txt", tk ?? "");

    // 4. the token works at the branch and carries the role's permissions
    const claims = JSON.parse(Buffer.from(tk.split(".")[1], "base64url").toString());
    const perms = [].concat(claims.permission ?? []);
    ok(perms.includes("restaurant.orders.create"), "token carries the cashier's permissions", perms.length);
    ok(!perms.includes("settings.users.create"), "…and not permissions the role lacks");
    ok(claims.tenant_id?.toLowerCase() === TENANT.toLowerCase(), "token is for the right workspace");
    const menu = await branch(tk, "GET", "/api/restaurant/menu");
    ok(menu.s === 200, "the branch accepts its own token on a restaurant API", menu.s);
    const forbidden = await branch(tk, "POST", "/api/restaurant/menu/import", { rows: [{ category: "X", name: "Y", price: 1 }] });
    ok(forbidden.s === 403 || forbidden.s === 401, "the cashier is refused something their role does not allow", forbidden.s);

    // 5. tokens are not interchangeable between the two servers
    const cloudTok = await cloud(null, "POST", "/api/auth/login", { email: "cashier@proto.test", password: PW });
    ok(cloudTok.s === 200, "the same account signs in at the cloud too", cloudTok.s);
    const crossA = await cloud(tk, "GET", "/api/restaurant/menu");
    ok(crossA.s === 401, "a BRANCH-issued token is refused by the cloud (a branch PC cannot forge cloud access)", crossA.s);
    const crossB = await branch(cloudTok.j?.accessToken, "GET", "/api/restaurant/menu");
    ok(crossB.s === 401, "a cloud-issued token is refused by the branch", crossB.s);
  }

  if (step === "offline-login") {
    const login = await branch(null, "POST", "/api/auth/login", { email: "cashier@proto.test", password: "NewProto#456" });
    ok(login.s === 200 && login.j?.accessToken, "the cashier signs in at the branch with the cloud unreachable", login);
    const menu = await branch(login.j?.accessToken, "GET", "/api/restaurant/menu");
    ok(menu.s === 200, "…and the branch serves them normally", menu.s);
  }

  if (step === "disable") {
    sql(CL, "UPDATE [identity].users SET Status=3, UpdatedAt=SYSUTCDATETIME() WHERE email='kitchen@proto.test'");
    console.log("status in cloud:", sql(CL, "SELECT Status FROM [identity].users WHERE email='kitchen@proto.test'"));
    ok(await wait(() => n(BR, "SELECT Status FROM [identity].users WHERE email='kitchen@proto.test'") === 3, 60000), "a user disabled at head office is disabled at the branch after sync");
    const login = await branch(null, "POST", "/api/auth/login", { email: "kitchen@proto.test", password: PW });
    ok(login.s !== 200, "…and can no longer sign in there", login.s);
  }

  if (step === "password") {
    const r = await cloud(t, "POST", `/api/users/${sql(CL, "SELECT Id FROM [identity].users WHERE email='cashier@proto.test'")}/reset-password`, { newPassword: "NewProto#456" });
    ok(r.s === 200 || r.s === 204, "head office resets a password", r);
    ok(await wait(async () => (await branch(null, "POST", "/api/auth/login", { email: "cashier@proto.test", password: "NewProto#456" })).s === 200, 60000), "the new password works at the branch");
    const old = await branch(null, "POST", "/api/auth/login", { email: "cashier@proto.test", password: PW });
    ok(old.s !== 200, "the old password no longer works at the branch", old.s);
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
