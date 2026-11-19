# Approvals & Workflows

A configurable approval-workflow portal: request forms, approval chains that change by location and business
unit, a signed PDF for every decision, a full audit log, an employee directory and a daily/monthly document
repository. Built first for WYLD Hospitality's RFP (*Workflow Approval Web Portal — WYLD BASE*), but nothing in
it is specific to them: a "Base" is whatever the workspace calls a location, and the forms and chains are data.

Module code `workflow` · service `Softaxis.Workflow.*` · schema `workflow` · API `api/workflow` · UI `/workflow`.

## How it maps to the RFP

| Ref | Requirement | Where it lives | Status |
|---|---|---|---|
| R1 | Sign in with Microsoft 365 | Identity: `MicrosoftSignIn.cs`, Settings → Security card, login button | Built, per-workspace Entra app. Tested against a stand-in OpenID provider, **not yet against real Microsoft** |
| R2 | Access by Base | `WfBase`, `WfBaseAccess`; every list, request and document is limited to the person's Bases | Built |
| R3 | Forms per Base | Every active form is offered under every Base the person can use | Built |
| R4 | Approval routing changes by Base and unit | Approval matrix: a flow per form, optionally narrowed to a Base and/or unit; most specific wins | Built |
| R5 | Employee directory, refreshed bi-weekly or monthly | `WfEmployee`, Excel/CSV import (matches on email then ID), "full list" import deactivates leavers, refresh-overdue banner | Built; live Microsoft Graph / HR sync is **not** built |
| R6 | PDF on every decision with name, designation, date/time (+ reason on rejection) | `DecisionPdf` (QuestPDF), rendered once at the decision, stored with its SHA-256 | Built |
| R7 | Audit log of every action | `WfAudit`, append-only, written in the same save as the action; reads of a request are logged too | Built (sign-ins are in Identity's own audit log) |
| §3 | Five roles | Roles below | Built |
| §5 | 11 forms | **10** seeded — the RFP lists ten in its table but says eleven. Ask WYLD which is missing | 10 built |
| §6 | Document repository, calendar view, daily + monthly types, standard templates | `WfDocType`, `WfRepoDocument`, calendar page, template attach/download | Built |

## Roles

The RFP's five roles are Vrodux permissions plus the position a person holds in a chain. Default roles are created
for any workspace that has the module.

| RFP role | Vrodux role | Permissions |
|---|---|---|
| Users | Approvals Requester | `workflow.requests.view/create`, `workflow.repository.view` |
| Reviewers / Approvers | Approvals Approver | requests view/create, `workflow.approvals.view/approve`, repository view/create |
| Admins | Approvals Administrator | everything, including `workflow.admin.edit` |
| Super Admins | Administrator / super admin | + `workflow.approvals.edit` (reassign someone else's approval) |
| (auditor) | Approvals Auditor | read-only everywhere, `workflow.audit.view/export` |

*Who approves a given request* is not a permission — it is the **position** the person holds for that Base/unit.
Permissions say what someone may do; positions say whose turn it is.

## The model in one paragraph

A **form** is a list of fields (stored as JSON, so a tenant can build or change one without a release). A **flow**
is an ordered list of steps, each naming a **position** (never a person). **Positions** are held by people per
Base and/or unit. When a request is submitted the server finds the most specific flow (Base+unit → Base → unit →
default), looks up who holds each position, and **freezes** that chain onto the request. Later changes to the
matrix never rewire a request already in flight.

## Rules worth knowing

- **Nobody approves their own request.** If the requester holds a position, that step is skipped; if that leaves
  no approver, submission is refused.
- **A missing approver is caught before submission** — the new-request screen shows who will approve, and the
  Setup → Approval matrix tab checks every location for gaps.
- Steps can carry a **minimum amount** (procurement thresholds). The amount comes from fields flagged as the
  request amount; line-item totals are recomputed on the server, so a total can't be typed in wrongly.
- A rejection needs a reason, ends the chain (later steps become *skipped*), and issues a rejection PDF.
- Two people acting at once cannot both win: the request carries a concurrency token.
- A decision PDF is generated **at the moment of the decision** and stored; later downloads return that exact file.
- Drafts are private to their author. Attachments: 10 MB each, 30 per request, executables refused.
- Re-submitting a rejected request creates a **new** request (new number) linked to the old one; the old one stays.
- Monthly repository documents are filed under the first of their month; future dates are refused.

## Making it reusable (selling it to other companies)

- Labels are settings: "Base" can be Branch, Property, Site… ("Base" and "Business unit" are just the defaults).
- **Starter packs** install a ready-made structure without overwriting anything of the tenant's. The first pack,
  *Multi-site operations (hospitality)*, is the WYLD structure. Add a pack by adding one entry to
  `StarterPackCatalogue` — e.g. *Procurement approvals*, *HR requests*, *Construction sign-offs*.
- Nothing is seeded automatically: a new workspace starts empty and chooses.
- The module is in every plan; a customer picks it in signup (Setup → module list) or a super admin switches it on.

## Isolation from the rest of Vrodux

- It is a separate service and schema (`workflow`); it reads nothing from other modules except the company name
  (Identity settings) and the user picker (`/api/users`). It writes nowhere outside its own schema.
- It adds permissions and a module code; it changes no existing permission, role, route or table.
- Tenants with an explicit module list do not get it until it is switched on. The sidebar group needs the module
  *and* `workflow.requests.view`.
- Microsoft sign-in is additive: new endpoints, a new table, and a button on the login page that only does
  something for workspaces that configured it. Password sign-in is untouched.

## Microsoft 365 sign-in

Per-workspace (single-tenant) Entra app. In Settings → Security an administrator pastes the directory ID, client ID
and a client secret (stored AES-GCM encrypted, never returned) and registers the shown redirect URI in Entra.

Flow: email → `start` → Microsoft (authorization code + PKCE) → our `callback` → one-time code (90 s, single use)
→ `exchange` → normal Vrodux tokens. The ID token is validated for signature (directory's published keys), issuer,
audience (our client id), lifetime, the nonce we sent, and that `tid` is the configured directory. The Microsoft
account must be the **same** account the person asked to sign in as. Workspace IP restrictions and the
single-session policy still apply; Microsoft's own MFA stands in for ours.

Configuration keys (all optional): `Sso:PublicApiBase` (the externally visible API address, needed behind a proxy
so the redirect URI is right), `FrontendUrl`. `Microsoft:LoginBase` exists only so tests can point at a stand-in.

## What is not built

- A live directory sync from Microsoft Graph or an HR system (import is manual/scheduled by a person).
- Email/Teams notifications for approvals (in-app bell + realtime only).
- Delegation ("I'm away — send my approvals to X"); a super admin can reassign today.
- Parallel approval steps, conditional branching beyond a minimum amount, and a "send back for changes" action.
- Auto-provisioning Vrodux logins from the directory; people are created in Users as usual.
- Arabic strings (the module is English only).
- AI-assistant tools for this module.

## Demo script (≈10 minutes)

1. **Setup → General → Install starter pack** → show locations, 10 forms, chains, 8 document types.
2. **Positions & people**: put four people behind the four positions; **Approval matrix** shows every location green.
3. Make Property Finance different for KSA to show **R4** (Matrix → *Add flow* → KSA).
4. As a requester: **New request → Refund** — the right-hand panel shows who will approve before anything is sent.
5. Approve through the chain as each person; show the bell, the **PDF with name, designation and time**, then a rejection with a reason.
6. **Repository**: calendar with red/amber/green days; file a daily document; attach a template.
7. **Directory**: import a spreadsheet; show the refresh-overdue banner.
8. **Audit log**: filter to the request; export CSV.
9. Settings → Security: show where Microsoft 365 sign-in is configured.
