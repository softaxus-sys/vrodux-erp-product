# HR ↔ Identity: linking people to logins

**Status: proposed design, not implemented.** Approve or amend before code is written.

Answers: *"if an HR manager creates an employee with the same email as an existing user, should it
fetch that user and combine the modules? How does a user with HR access apply for leave, mark
attendance, and see their own record — without breaking tenants that don't have HR?"*

---

## 1. Current state (verified in code, 2026-08-25)

| Fact | Consequence |
|---|---|
| `Employee` has **no** `UserId`. Nothing links the two, in either direction. | A person who logs in and the same person's employment record are unrelated rows. |
| `Employee.Email` and `User.Email` are independent columns. | Same address can exist twice with nothing tying them. |
| **No self-service permission tier exists.** Every seeded `hr.*` key is administrative. | To let a real-estate agent book a day off you must grant `hr.leaves.create` — which also lets them file leave for *anyone* and read *everyone's* requests. This is the real problem to solve. |
| CRM already reads `[identity].[teams]` through a read-only mapped view (`IdentityTeamView`). | A supported precedent for HR reading identity without a service call or a duplicated table. |
| Modules are gated per tenant (`ResolvedModules`, `ModuleGuard`, `ModuleEnforcementMiddleware`). | Any design must degrade cleanly when a tenant lacks HR. |
| Plans cap **seats** (users), not employees (Module 20). | Creating a login for every employee has a direct billing consequence. |

---

## 2. The rule

> **A User is a login. An Employee is a job. They are two records about one person, joined by an
> explicit, optional, nullable link — never merged, and never joined on email.**

This is what Odoo (`res.users` ↔ `hr.employee`), Workday (Account ↔ Worker), BambooHR and SAP
SuccessFactors all do, for the same reason: **the cardinalities genuinely differ.**

- **Users with no employee record** — the super admin, an external accountant, an integration
  account, a client-portal user. Forcing an employment record on them is nonsense.
- **Employees with no user** — site labourers, drivers, warehouse and retail staff who never sign
  in. Very common in this product's UAE market. Forcing a login on them would be wrong *and*
  would consume a paid seat per head.

Merging the two tables makes both of those cases unrepresentable. That is why it is never done.

---

## 3. Email is a matching **hint**, never the key

When an HR manager creates an employee whose email matches an existing user, the system
**suggests** the link and asks:

> `ahmed@company.ae` already has a Vrodux login (Ahmed Khan, CRM Agent).
> **[ Link to this account ]** [ Keep separate ]

On confirmation we store `Employee.UserId`. The link is **by id, forever after** — email is used
once, to find the candidate.

Never join on email at read time, because:
- people change their email (marriage, rebrand) — an id survives it, a string join silently breaks;
- work email ≠ the personal address HR holds;
- an auto-merge on a typo'd address silently exposes one person's salary and documents to another.

The same suggestion runs in the other direction when a user is created and an unlinked employee
shares the address.

**Constraint:** unique `(TenantId, UserId)` on `employee`, filtered to live rows — one employee per
login, per tenant.

---

## 4. One owner per field — no two-way sync

Two-way field sync is how these integrations rot: an edit on either side races the other and
nobody can say which value is true.

| Data | Owner | The other side |
|---|---|---|
| Login email, username, password, 2FA, roles, permissions, account status | **Identity** | HR displays it read-only |
| Legal name, job title, department, manager, salary, contract, joining/termination date, documents, leave entitlement, attendance | **HR** | Identity holds none of it |
| Display name in the JWT | **Identity** | HR keeps its own legal name — they are legitimately different (“Mo” vs “Mohammed Abdul Rahman”) |

HR shows the linked account's live state through a **read-only cross-schema view**
(`IdentityUserView` onto `[identity].[users]`), exactly as CRM already reads teams. No copying, no
sync job, no drift. One direction only: **HR reads Identity; Identity never reads HR.**

---

## 5. Self-service is its own permission tier

New seeded group — the core of the answer to "how does a user apply for leave":

```
hr.self = ["view", "leave-request", "attendance", "payslip"]
```

| Key | Grants |
|---|---|
| `hr.self.view` | See *my own* employee profile |
| `hr.self.leave-request` | Apply for / cancel *my own* leave, see *my* balance |
| `hr.self.attendance` | Check in / out, see *my* attendance |
| `hr.self.payslip` | Download *my own* payslips |

Served by `/api/hr/me/*`, which resolves the employee from `ICurrentUser.Id → Employee.UserId`.

> **These routes must never accept an `employeeId` from the client.** That single rule is the
> security property of the whole tier: identity comes from the token, so the endpoint is
> structurally incapable of returning someone else's data.

A tenant provisions this via a new **"Employee (Self-Service)"** role from
`TenantRoleProvisioner` — `hr.self.*` and nothing else. A real-estate agent then holds
`real-estate.*` + `hr.self.*`: they work their listings and book their own leave, while seeing
nothing of anyone else's HR data.

An unlinked user holding `hr.self.*` gets a clear "no employee record is linked to your account"
message, not an error.

---

## 6. How this stays out of the way of tenants without HR

1. **The link lives on the HR side.** `Employee.UserId` is a column in the `hr` schema. Identity
   has no column, no reference and no code that knows HR exists. A tenant without HR has an
   Identity module that is byte-for-byte the same.
2. **No cross-schema foreign key** — same convention as every other cross-service reference here.
   Nothing to violate when a module is absent, and a tenant purge can't hit an FK.
3. **The view is read-only and one-directional.** HR reads identity; identity is the base module
   every tenant has, so the dependency only ever points at something guaranteed present.
4. **ESS routes live in HR**, behind `ModuleGuard module="hr"` and `hr.self.*`. No HR module → the
   routes are unreachable and the "My HR" nav section never renders.
5. **Everything is nullable.** No employee → the user is just a user. No user → the employee is
   just an employee. Neither state is an error, and both are common.

---

## 7. Lifecycle

| Event | Behaviour |
|---|---|
| Employee created | Optional **"Invite to portal"** → creates a User with the self-service role and sends the activation email (reuses the Module 17 invite flow). Off by default. |
| Invite | Warns that a login **consumes a plan seat** (*"3 of 10 seats used"*), because it does. |
| Employee terminated | HR sets status and **suggests** disabling the login — explicit, logged, never automatic. People need access during handover. |
| User deleted / deactivated | Employment record survives. It is a legal record; the link simply goes dormant. |
| Rehire | New employment record may reuse the same user. |
| Unlink | Allowed, logged. Neither record is deleted. |

---

## 8. What this design deliberately rejects

- **Merging the tables.** Makes login-less employees and employee-less logins unrepresentable.
- **Email as a foreign key.** Breaks on any email change; silently merges two people on a typo.
- **Auto-linking without confirmation.** The failure mode is exposing salary and documents to the
  wrong person — never worth saving one click.
- **Two-way field sync.** Guaranteed drift; nobody can say which side is authoritative.
- **Auto-creating a user per employee.** Wrong for the majority of blue-collar staff, and it
  silently spends the tenant's paid seats.

---

## 9. Rollout

| Phase | Scope | Risk |
|---|---|---|
| **1 — The link** | `Employee.UserId` + unique index; link/unlink with confirmation; email-match suggestion both ways; `IdentityUserView`; "Linked account" panel on the employee profile. | Low — purely additive, nothing behaves differently until used. |
| **2 — Self-service** | Seed `hr.self.*`; `/api/hr/me/{profile,leaves,attendance,payslips}`; "My HR" nav section; "Employee (Self-Service)" role in the provisioner. | Low — new surface, no existing endpoint changes. |
| **3 — Lifecycle** | Invite-to-portal with seat awareness; termination → suggest disable; unlink audit. | Medium — touches provisioning and billing seats. |
| **4 — Reuse** | Any other module needing "is this user a member of staff?" reads the same link. Real estate needs no work: an agent is already just a User. | Low. |

Phase 1 and 2 are independently useful and independently shippable.

---

## 10. Open questions for the owner

1. **Manager approval** — should a leave request from ESS route to `Employee.ManagerId`'s linked
   user, or stay with anyone holding `hr.leaves.approve`? (Manager-based is standard; it needs the
   manager to be linked too.)
2. **Attendance honesty** — should ESS check-in record IP/geolocation? Standard in UAE field-staff
   deployments, and a privacy decision that is yours, not mine.
3. **Seats** — should "Invite to portal" be blocked at the plan limit, or allowed with an upgrade
   prompt?
4. **Payslip visibility** — all history, or only runs marked paid?
