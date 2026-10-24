const { tok, mk, crypto } = require("./lib.cjs");
const fresh = () => tok(crypto.randomUUID());
const { execSync } = require("child_process");
const cloud = mk("http://localhost:5301");
const B1 = "089A949F-86F7-41F8-BC10-12FC6538DD6E";
const t = tok();
let pass = 0, fail = 0;
const ok = (c, m, x) => { if (c) { pass++; console.log("PASS", m); } else { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 500)); } };
const sql = (q) => execSync(`sqlcmd -S SHAHBAZ-QFINITY -d SoftaxisProtoCloud -E -C -h -1 -W -Q "SET QUOTED_IDENTIFIER ON; SET NOCOUNT ON; ${q}"`, { encoding: "utf8" }).trim();

(async () => {
  const other = sql(`SELECT TOP 1 Id FROM [identity].branches WHERE Id<>'${B1}' AND TenantId='4BE5DD59-EEBC-459F-9A42-B19AF2749F8B' AND IsDeleted=0`);

  // cloud-run branch: everything works as before
  const s1 = await cloud(fresh(), "POST", "/api/sessions/open", { registerId: "REG-AY32757", openingCash: 100, branchId: B1 });
  ok(s1.s === 200 || s1.s === 201, "a shift opens normally for a branch that runs on the cloud", s1);
  const sid = s1.j?.id;

  // switch the branch to its own server
  const set = await cloud(t, "PUT", `/api/branches/${B1}/server-mode`, { mode: "local" });
  ok(set.s === 200 || set.s === 204, "branch is set to run on its own server", set);

  const open2 = await cloud(fresh(), "POST", "/api/sessions/open", { registerId: "REG-BY16447", openingCash: 50, branchId: B1 });
  ok((open2.raw?.errorCode ?? open2.j?.code) === "Branch.Conflict", "the cloud refuses to open a shift for that branch (409)", open2);
  const cash = await cloud(t, "POST", `/api/sessions/${sid}/cash-movement`, { type: "payout", amount: 5, reason: "test", category: "other" });
  ok((cash.raw?.errorCode ?? cash.j?.code) === "Branch.Conflict", "…refuses a cash movement on its shift (409)", cash);
  const susp = await cloud(t, "POST", `/api/sessions/${sid}/suspend`, { notes: "x" });
  ok((susp.raw?.errorCode ?? susp.j?.code) === "Branch.Conflict", "…refuses to suspend its shift (409)", susp);
  const close = await cloud(t, "POST", `/api/sessions/${sid}/close`, { closingCash: 100, notes: "x" });
  ok((close.raw?.errorCode ?? close.j?.code) === "Branch.Conflict", "…refuses to close its shift (409)", close);
  ok(sql(`SELECT Status FROM pos.pos_sessions WHERE Id='${sid}'`) === "1", "the shift was left untouched (still open)");

  // other branches are unaffected
  const o = await cloud(fresh(), "POST", "/api/sessions/open", { registerId: "REG-OY31079", openingCash: 10, branchId: other });
  ok(o.s === 200 || o.s === 201, "another branch can still open a shift on the cloud", o);

  // back to cloud mode
  await cloud(t, "PUT", `/api/branches/${B1}/server-mode`, { mode: "cloud" });
  const close2 = await cloud(t, "POST", `/api/sessions/${sid}/close`, { closingCash: 100, notes: "x" });
  ok(close2.s === 200, "after switching back to cloud mode the shift closes normally", close2);
  if (o.j?.id) await cloud(t, "POST", `/api/sessions/${o.j.id}/close`, { closingCash: 10, notes: "x" });

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
