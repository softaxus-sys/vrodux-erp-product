# Softaxis VroduxERP — QA & Developer Reference

> Full QA log across Auth, Onboarding, HR, Finance, Inventory, and cross-cutting features. All bugs found and fixed. Updated continuously — always read this file at the start of every session.

---

## ⚠️ MANDATORY Backend Architecture — CQRS / MediatR (read before touching ANY controller)

**Controllers must NEVER inject a `DbContext` or define DTOs/records inline.** This was violated by older
controllers (Employees, Leaves, Payroll, Attendance, Recruitment, Departments, Performance, Careers, etc.) —
those are TECH DEBT to be migrated, not a pattern to copy. The **reference implementation** is
`Softaxis.Finance.*` → `Accounts` feature (`AccountsController` + `Accounts/Commands|Queries|Dtos` +
`Handlers/Accounts/*Handler.cs`).

**Required layout per feature** (e.g. `Recruitment`, `Careers`, `Employees`):

```
Softaxis.<Module>.Application/
  <Feature>/
    Commands/   <Verb><Feature>Command.cs   — sealed record : ICommand<TDto> (or ICommand for void),
                                                + FluentValidation AbstractValidator in same file
    Queries/    Get<Feature>Query.cs        — sealed record : IQuery<TDto> / IQuery<IReadOnlyList<TDto>>
    Dtos/       <Feature>Dto.cs             — all response DTOs/records live here, NOT in the controller

Softaxis.<Module>.Infrastructure/
  Handlers/<Feature>/
    <Verb><Feature>Handler.cs   — internal sealed class : ICommandHandler<TCmd,TDto> / IQueryHandler<...>
                                    — only place that touches DbContext
                                    — returns Result<T> / Result, uses Error.Custom("X.NotFound", "...") etc.

Softaxis.<Module>.API/
  Controllers/Common/<Module>ControllerBase.cs   — OkOrError / CreatedOrError / NoContentOrError
                                                     (copy Finance's FinanceControllerBase if missing)
  Controllers/<Feature>Controller.cs
    - constructor takes ONLY `ISender sender`
    - each action: `await sender.Send(new XCommand(...), ct)` → `OkOrError(...)` / `NoContentOrError(...)` / `CreatedOrError(...)`
    - NO `db.Whatever`, NO inline `record FooDto(...)`, NO business logic
```

Error codes drive HTTP status in `ErrorResponse`: `*.NotFound` → 404, `*.Duplicate`/`*.HasTransactions` → 409,
`Validation.Failed` → 422, else 500.

**When asked to add/modify a backend endpoint in ANY service**, follow this structure even if the existing
controller for that feature doesn't (flag the inconsistency, but don't compound it). When doing larger refactors,
migrate one feature/controller at a time and confirm scope with the user first — these refactors touch many files.

---

## Tech Stack

- **Frontend:** React + Vite + TypeScript, Tailwind CSS, `framer-motion`, `react-hook-form` + `zod`, `@tanstack/react-query`, `sonner` (toast)
- **Backend:** ASP.NET Core .NET 10, CQRS (MediatR, `ICommand`/`IQuery`), Entity Framework Core
- **Auth:** JWT + refresh tokens, HMAC-SHA256 challenge-response nonces, `IMemoryCache` single-use
- **API Clients:** `apiClient` (Identity service) vs `rawApiClient` (HR/Finance/Inventory services)
- **CSV Export:** `src/lib/csv.ts` — `toCsv<T>(rows, headers)` + `downloadFile(filename, content, mime?)`
- **PDF Export:** `src/lib/pdf.ts` — `exportPdf(opts)` — browser-native `window.print()`, zero dependencies
- **Export UI:** `src/components/ui/export-menu.tsx` — `<ExportMenu onCsv={fn} onPdf={fn} />` Radix dropdown

---

## Project File Structure (key files)

```
FrontendVite/src/
  lib/
    hr/hr.api.ts                    — HR API client + all DTOs + mapEmployee/mapLeave
    finance/finance.api.ts          — Finance API client + all DTOs
    api-client.ts                   — rawApiClient + error extraction (checks detail/description/message/error)
    csv.ts                          — toCsv + downloadFile
    pdf.ts                          — exportPdf (browser-native PDF)
    utils.ts                        — formatDate (null-safe), formatCurrency, getInitials, cn
  hooks/
    hr/use-hr.ts                    — all HR query + mutation hooks
    finance/use-finance.ts          — all Finance query + mutation hooks
  components/ui/
    export-menu.tsx                 — ExportMenu dropdown (CSV + PDF)
  modules/
    hr/
      attendance/components/attendance-view.tsx   — full rewrite with MarkAttendanceModal
      payroll/components/payroll-view.tsx         — full rewrite: status workflow, PayslipDetailView, reject/edit flow
      payroll/components/add-payroll-form.tsx     — 2-step payroll form (FULL REWRITE)
    finance/
      journals/components/add-journal-form.tsx    — bg-card fix on <select>
      budgeting/components/add-budget-form.tsx    — bg-card fix on <select>
```

---

## Module 1 — Auth QA

### Files Touched
- `FrontendVite/src/modules/settings/users/components/users-view.tsx` — full rewrite
- `FrontendVite/src/lib/identity/users.api.ts` — added `adminResetPassword`
- `FrontendVite/src/hooks/identity/use-users.ts` — added `useAdminResetPassword`
- `Backend/.../Controllers/UsersController.cs` — added `AdminResetPassword` endpoint
- `Backend/.../Application/Users/Commands/AdminResetPassword/AdminResetPasswordCommand.cs` — NEW
- `Backend/.../Application/Users/Commands/AdminResetPassword/AdminResetPasswordCommandHandler.cs` — NEW
- `Backend/.../Controllers/AuthController.cs` — added rate limiting to ForgotPassword
- `Backend/.../API/Program.cs` — registered `"forgot_password"` rate limit policy

### Bugs Fixed

| # | Bug | Fix |
|---|-----|-----|
| 1 | `CreateUserModal` called `usersApi.create` directly via dynamic import — no React Query hook, no cache invalidation, no toast | Replaced with `useCreateUser()` hook |
| 2 | `AnimatePresence` was inside the conditionally-rendered component — exit animations never fired | Lifted `AnimatePresence` to parent scope in `users-view.tsx` |
| 3 | "Ban" button called delete API instantly with no confirmation | Replaced with `ConfirmDeleteModal` |
| 4 | No `EditUserModal` existed — no way to update user profile from UI | Added `EditUserModal` with `useUpdateUser` hook |
| 5 | Admin "Reset Password" used `ChangePasswordCommand` which requires current password (admin doesn't know it) | Created `AdminResetPasswordCommand` + handler + `POST /users/{id}/reset-password` endpoint |
| 6 | `ForgotPassword` endpoint had no rate limiting — could be spammed for email enumeration | Added `"forgot_password"` sliding window policy: 5 req / IP / 300 s |
| 7 | `UserDrawer` had no `onEdit` / `onDelete` callbacks | Added props and wired edit/delete flows |

---

## Module 2 — Onboarding QA

### Files Touched
- `FrontendVite/src/pages/trial/onboarding.tsx` — 6 targeted fixes

### Bugs Fixed

| # | Bug | Fix |
|---|-----|-----|
| 1 | `PwBar` crash: `s=0` → `c[0]=null` → `null.b` throws TypeError on 1-char password | Guard: `c[Math.max(1, s)]` |
| 2 | Agree checkbox checkmark invisible: `peer-checked:*` only applies to CSS siblings, not descendants | Replaced CSS peer with JS-driven state via `f1.watch("agree")` |
| 3 | Agree checkbox `style={{ borderColor }}` always overrode Tailwind `peer-checked:border-*` (inline > class specificity) | Same fix — JS state via `style={}` consistently |
| 4 | `apiError` persisted when navigating back to step 1 — old error shown on fresh attempt | Added `setApiError(null)` to all back-navigation handlers |
| 5 | `toggleModule` stale closure: `needsBusinessType(selectedModules)` used old state snapshot | Moved all logic inside `setState(prev => ...)` callback |
| 6 | Unused imports `DollarSign` and `Package` causing lint warnings | Removed |

---

## Module 3 — HR QA

### Files Touched
- `FrontendVite/src/lib/hr/hr.api.ts` — major update (mapping, new API methods, new DTOs)
- `FrontendVite/src/hooks/hr/use-hr.ts` — major update (mutation hooks, new query hooks)
- `FrontendVite/src/modules/hr/employees/components/add-employee-form.tsx`
- `FrontendVite/src/modules/hr/leaves/components/add-leave-form.tsx`
- `FrontendVite/src/modules/hr/payroll/components/add-payroll-form.tsx` — full rewrite (2-step form)
- `FrontendVite/src/modules/hr/recruitment/components/add-job-posting-form.tsx`
- `FrontendVite/src/modules/hr/payroll/components/payroll-view.tsx` — WPS modal added
- `FrontendVite/src/modules/hr/attendance/components/attendance-view.tsx` — full rewrite

### Bugs Fixed

| # | Severity | Bug | Fix |
|---|----------|-----|-----|
| 1 | 🔴 Critical | All 4 "Add" forms called `onClose()` on submit — no API calls at all | Wired each form to its mutation hook |
| 2 | 🔴 Critical | `hr.api.ts` had zero mutation methods | Added `createEmployee`, `updateEmployee`, `deleteEmployee`, `createLeave`, `deleteLeave`, `createPayrollRun`, `generatePayrollRun`, `markAttendance`, `updateAttendance`, `deleteAttendance`, `getPayrollRunById` |
| 3 | 🔴 Critical | `use-hr.ts` had zero mutation hooks | Added `useMarkAttendance`, `useUpdateAttendance`, `useCreatePayrollRun`, `useGeneratePayrollRun`, `usePayrollRunById` and others with `invalidateQueries` + toast |
| 4 | 🔴 Critical | `EmployeeDto` fields didn't match backend — `employeeId` / `designation` / `department` / `joinDate` undefined → `.toLowerCase()` crash in employee-table | Added `mapEmployee()` at API boundary to normalize backend → UI shape |
| 5 | 🔴 Critical | `LeaveRequestDto` fields didn't match backend — `fromDate` / `toDate` / `days` undefined → blank dates, `NaN d` in leave table | Added `mapLeave()` at API boundary |
| 6 | 🔴 Critical | `RangeError: Invalid time value` — `formatDate("")` passed to `Intl.DateTimeFormat.format()` → crash | `formatDate()` in `utils.ts` now guards: `null \| undefined \| "" \| Invalid Date` all return `"—"` safely |
| 7 | 🔴 Critical | `mapEmployee()` / `mapLeave()` used `?? ""` for missing dates — empty string passed to `new Date("")` = Invalid Date | Changed to `?? undefined` so date fields are `string \| undefined`, not `string` |
| 8 | 🔴 Critical | "Mark Attendance" button had no `onClick`, no API methods, no mutation hooks. Date hardcoded to `"2026-05-19"` | Full rewrite: `MarkAttendanceModal` component, API methods, hooks, dynamic `TODAY` constant |
| 9 | 🔴 Critical | `AddPayrollForm` sent only `{period, notes}` to `/payroll/generate` — allowances/deductions UI silently discarded | Full rewrite: 2-step form using `POST /payroll` (manual with slips), per-employee salary editing |
| 10 | 🟠 High | `PayrollSummaryDto` completely wrong shape — all stat cards showed 0 | Updated type to match `{ allTime: {...}, thisMonth: {...} \| null }` |
| 11 | 🟠 High | `AddLeaveForm` had no employee selector — backend `CreateLeaveRequest` requires `employeeId` + `employeeName` | Added employee dropdown (loaded via `useEmployees()`) |
| 12 | 🟡 Medium | `AttendanceStatus` had duplicate: both `"half_day"` and `"half-day"` | Removed `"half-day"`, kept `"half_day"` |
| 13 | 🟡 Medium | `getLeaveBalances` called `/leaves/balances` which doesn't exist in backend — silent 404 | Added `.catch(() => [])` graceful fallback |
| 14 | 🟡 Medium | Recruitment "Publish Job" / "Save as Draft" silently closed — no backend controller exists | Added `toast.info()` explaining backend not yet configured |

### HR — Attendance (AttendanceController is FULL CRUD, not read-only)

> **IMPORTANT:** `CLAUDE.md` previously said `AttendanceController` is "GET (read-only)" — this is WRONG. The backend fully supports POST, PUT, DELETE. Frontend now uses all three.

```ts
// hr.api.ts — attendance mutations
markAttendance:   (payload: MarkAttendancePayload): Promise<AttendanceRecordDto> =>
  rawApiClient.post(`${BASE}/attendance`, payload),
updateAttendance: (id: string, payload: UpdateAttendancePayload): Promise<void> =>
  rawApiClient.put(`${BASE}/attendance/${id}`, payload),
deleteAttendance: (id: string): Promise<void> =>
  rawApiClient.delete(`${BASE}/attendance/${id}`),
```

`MarkAttendanceModal` in `attendance-view.tsx`:
- Loads all employees via `useEmployees()`
- Date picker (defaults to today — dynamic `TODAY` constant, never hardcoded)
- Per-employee rows: status dropdown, check-in/out `<input type="time">`, notes
- "Mark All Present" / "Mark All Absent" bulk shortcuts
- `handleSave()` uses `Promise.allSettled()` — PUT if `existingId` set, POST if new
- Shows saved/failed counts via toast

### HR — Payroll Run Form (2-Step — FULL REWRITE)

**File:** `FrontendVite/src/modules/hr/payroll/components/add-payroll-form.tsx`

**Old bugs:**
- Sent only `{period, notes}` — allowances/deductions never reached backend
- Used `/payroll/generate` which hardcodes `allowances=0, deductions=0`
- Pay period was a hardcoded static list that stopped working after a few months
- No employee visibility — couldn't see who's on payroll or their base salaries

**New design — 2-step drawer:**

**Step 1 — Configure:**
- Payroll type (Monthly / Bonus / Termination / Correction) with descriptions
- Pay period — **dynamically generated** (`buildPeriodOptions()`: last 12 months + next month)
- Payment date, notes
- Shows active employee count preview

**Step 2 — Review & Adjust Salaries (expands to `max-w-4xl`):**
- Loads all active employees (`useEmployees()`) with their `basicSalary`
- Per-employee table: Basic Salary | Allowances (editable) | Deductions (editable) | Net (live preview)
- **"Apply to All" toolbar:** enter a bonus once → "Add Bonus" adds to every employee's allowances in one click (same for deductions)
- Search/filter employees by name / department / job title
- Sticky totals footer row
- Summary bar showing Total Basic / Allowances / Deductions / **Net Payroll**
- Submit button shows total: `"Run Payroll — AED 245,000"`

**Submits to:** `POST /api/hr/payroll` (manual endpoint with full `slips[]` per employee — NOT `/generate`)

```ts
createPayroll.mutate({
  period,
  notes: notes.trim() || undefined,
  slips: rows.map(r => ({
    employeeId:     r.employeeId,
    employeeName:   r.employeeName,
    jobTitle:       r.jobTitle || undefined,
    departmentName: r.departmentName || undefined,
    basicSalary:    r.basicSalary,
    allowances:     r.allowances,   // per-employee bonus/allowance total
    deductions:     r.deductions,   // per-employee deduction total
  })),
});
```

### HR — WPS (Wage Protection System)

**File:** `FrontendVite/src/modules/hr/payroll/components/payroll-view.tsx`

**Old bugs:**
- "WPS File" button in header had NO `onClick` — dead button
- "Submit WPS" button just opened the payroll run drawer — not a WPS flow

**Fix:**
- Added `generateWpsSif(run)` — generates UAE Central Bank SIF format:
  ```
  EDR|MOB|COMPANY|202605|10|1234500|AED
  SDR|EMP001|MOB|AE070331234567890123456|123450|20260501|20260531|31|100000|23450|0
  EOS|MOB|COMPANY|202605|10|1234500|AED
  ```
- Added `WpsSubmitModal` — side panel with employee IBAN table, "Download SIF File" + "Submit WPS" buttons
- Added `usePayrollRunById(id)` hook — fetches run detail with payslips via `GET /payroll/{id}`
- Both "WPS File" (header) and "Submit WPS" (current run card) open the modal with correct run ID

### Backend HR Controllers (confirmed implemented)
| Controller | Endpoints |
|-----------|-----------|
| `EmployeesController` | GET all, GET by id, GET summary, POST create, PUT update, DELETE |
| `LeavesController` | GET all, GET by id, GET summary, POST create, POST approve, POST reject, POST cancel, DELETE |
| `PayrollController` | GET all, GET by id, GET summary, POST create, POST generate, POST process, POST pay, POST reject, POST reopen, GET slip, POST slip/send-email, PUT slip, DELETE |
| `AttendanceController` | GET all, GET by id, **POST create, PUT update, DELETE** — FULL CRUD (not read-only) |
| `DepartmentsController` | GET (read-only) |
| ❌ `PerformanceController` | **NOT IMPLEMENTED** — queries will return 404 |
| ❌ `RecruitmentController` | **NOT IMPLEMENTED** — queries will return 404 |

### Backend Payroll API shape (full)
```csharp
// POST /api/hr/payroll — manual run with explicit slips
CreatePayrollRunRequest(string Period, string? Notes, IReadOnlyList<SlipRequest> Slips)
SlipRequest(Guid EmployeeId, string EmployeeName, string? JobTitle, string? DepartmentName,
            decimal BasicSalary, decimal Allowances, decimal Deductions, string? Notes)

// POST /api/hr/payroll/generate — auto-generates from all active employees, Allowances=0, Deductions=0
GenerateRequest(string Period, string? Notes)

// POST /api/hr/payroll/{id}/process  — draft → processed
// POST /api/hr/payroll/{id}/pay      — processed → paid
// POST /api/hr/payroll/{id}/reject   — draft → rejected (stores reason + rejector name)
RejectRequest(string? Reason)

// POST /api/hr/payroll/{id}/reopen   — rejected → draft (clears RejectionReason/RejectedByName/RejectedAt)

// GET  /api/hr/payroll/{runId}/slips/{slipId}             — individual slip detail
// POST /api/hr/payroll/{runId}/slips/{slipId}/send-email  — records EmailSentAt/EmailSentTo from employee table
// PUT  /api/hr/payroll/{runId}/slips/{slipId}             — edit slip (draft or rejected runs only)
UpdateSlipRequest(decimal Allowances, decimal Deductions, string? Notes)
```

### Payroll Status Machine
```
draft ──→ processed ──→ paid
  │
  └──→ rejected ──→ (edit slips) ──→ reopen (back to draft) ──→ processed ──→ paid
```

State transitions enforced on backend — any invalid transition returns `400 { "error": "Only X payroll runs can be Y." }`

### Payroll — Creator & Rejection Tracking

`PayrollRun` entity fields added for audit trail:
- `CreatedByUserId` — JWT `ClaimTypes.NameIdentifier` of run creator
- `CreatedByName` — display name from `ClaimTypes.Name ?? "name" ?? ClaimTypes.Email`
- `RejectionReason` — optional text set on reject
- `RejectedByName` — display name of rejector
- `RejectedAt` — timestamp of rejection

These are returned in both `PayrollRunDto` (list) and `PayrollRunDetailDto` (drawer detail), so the rejection banner in the UI can display: "Rejected by [RejectedByName] on [RejectedAt] — Reason: [RejectionReason]. Created by [CreatedByName]."

**Duplicate run guard:** `POST /payroll` and `POST /payroll/generate` both check for an existing non-draft run for the same period and return `409 Conflict` if one exists.

### Payroll — Email Tracking on Slips

`PayrollSlip` entity fields:
- `EmailSentAt` — `DateTime?` set when `POST .../send-email` is called
- `EmailSentTo` — employee email address (looked up from `Employees` table)

`POST .../send-email` records the send; actual email delivery is wired via `IEmailService` when configured. Returns `{ sentTo, sentAt }`.

### Payroll View — Frontend Architecture (payroll-view.tsx FULL REWRITE)

**Single-panel push-navigation** — no double-drawer. `PayslipDetailView` slides over the slip list within the same drawer using `position: absolute inset-0` + Framer Motion spring. Only one dark overlay ever exists.

**`normaliseSlip()` helper** — normalizes backend slip shape (backend uses `departmentName`/`jobTitle`, not `department`/`designation`):
```ts
function normaliseSlip(s: any): NormalisedSlip {
  return {
    id:             s.id ?? s.slipId,
    employeeId:     s.employeeId,
    employeeName:   s.employeeName ?? s.name,
    department:     s.departmentName ?? s.department ?? "—",
    designation:    s.jobTitle ?? s.designation ?? "—",
    basicSalary:    s.basicSalary ?? 0,
    allowances:     s.allowances ?? 0,
    deductions:     s.deductions ?? 0,
    netSalary:      s.netSalary ?? s.net ?? 0,
    emailSentAt:    s.emailSentAt ?? null,
    emailSentTo:    s.emailSentTo ?? null,
  };
}
```

**`PayrollRunDrawer` states:**
- `selectedSlip` — pushes `PayslipDetailView` when set
- `editMode` — amber table header, editable allowances/deductions inputs, changed rows highlighted
- `localEdits` — `Map<slipId, {allowances, deductions}>` tracking only changed slips
- `showReject` / `rejectReason` — animated reject panel with textarea

**Action buttons by status:**
| Status | Buttons shown |
|--------|---------------|
| `draft` | "Reject" (red outline) + "Accept & Process" (blue) |
| `processed` | "Mark as Paid" (green) |
| `paid` | (none — read-only) |
| `rejected` | "Edit & Resubmit" (blue) |
| `rejected` + `editMode` | "Cancel" + "Resubmit as Draft" |

**Edit & Resubmit flow:**
1. User clicks "Edit & Resubmit" → `editMode = true`
2. Allowances/deductions become editable inputs per row; live net shown
3. "Resubmit as Draft" → PUT changed slips one by one → then `POST /reopen` → cache invalidated → status shows draft

**`usePayrollRunById` staleTime = 2 min** (list `staleTime` = 30 s to avoid stale status buttons)

**`rawApiClient` error extraction** — must check all of: `detail`, `description`, `message`, `error` keys:
```ts
const msg =
  (b?.detail      as string | undefined) ??
  (b?.description as string | undefined) ??
  (b?.message     as string | undefined) ??
  (b?.error       as string | undefined) ??
  `HTTP ${res.status}`;
```

### Payroll Hooks Added (use-hr.ts)
| Hook | Purpose |
|------|---------|
| `useDeletePayrollRun()` | DELETE draft run |
| `useRejectPayrollRun()` | POST reject with reason |
| `useProcessPayrollRun()` | POST process (draft → processed) |
| `usePayPayrollRun()` | POST pay (processed → paid) |
| `useReopenPayrollRun()` | POST reopen (rejected → draft) |
| `useUpdatePayrollSlip()` | PUT individual slip allowances/deductions |
| `useSendPayslipEmail()` | POST send-email, returns `{ sentTo, sentAt }` |

All hooks: invalidate `[QK, "payroll-runs"]` + `[QK, "payroll-summary"]` on success, `toast.error` on failure.

### Payroll — Migrations Applied
| Migration | Changes |
|-----------|---------|
| `AddPayrollSlipEmailTracking` | Adds `EmailSentAt (datetime2, nullable)`, `EmailSentTo (nvarchar(320), nullable)` to `payroll_slips` |
| `AddPayrollRejectionAndCreator` | Adds `CreatedByUserId (nvarchar(100))`, `CreatedByName (nvarchar(200))`, `RejectionReason (nvarchar(1000))`, `RejectedByName (nvarchar(200))`, `RejectedAt (datetime2)` to `payroll_runs` |

---

## Module 4 — Finance QA

### Files Touched
- `FrontendVite/src/hooks/finance/use-finance.ts` — added missing toasts + onError to 8 mutation hooks
- `FrontendVite/src/lib/finance/finance.api.ts` — fixed `JournalStatus` type (added `"voided"`)
- `FrontendVite/src/modules/finance/journals/components/journals-view.tsx` — added `"voided"` to `STATUS_CONFIG` and `FILTERS`
- `FrontendVite/src/modules/finance/invoicing/components/invoicing-view.tsx` — replaced `window.confirm()` delete with state-based confirmation modal
- `FrontendVite/src/modules/finance/invoicing/components/invoice-drawer.tsx` — replaced `window.confirm()` cancel with state-based confirmation modal
- `FrontendVite/src/modules/finance/journals/components/add-journal-form.tsx` — `bg-transparent` → `bg-card` on `<select>` (dark mode fix)
- `FrontendVite/src/modules/finance/budgeting/components/add-budget-form.tsx` — `bg-transparent` → `bg-card` on `<select>` (dark mode fix)
- `Backend/.../Controllers/ExpensesController.cs` — added `IsDeleted` filter to `GetAll`
- `Backend/.../Controllers/BudgetsController.cs` — added `IsDeleted` filter to `GetAll`

### Bugs Fixed

| # | Severity | Bug | Fix |
|---|----------|-----|-----|
| 1 | 🔴 Critical | `JournalStatus` type missing `"voided"` — when backend voids an entry `STATUS_CONFIG[j.status]` returns `undefined` → crash accessing `.color`, `.bg`, `.dot` | Added `"voided"` to `JournalStatus` union type and `STATUS_CONFIG` |
| 2 | 🟠 High | `ExpensesController.GetAll` missing `!x.IsDeleted` filter — deleted expenses shown in list | Added `.Where(x => !x.IsDeleted)` |
| 3 | 🟠 High | `BudgetsController.GetAll` missing `!x.IsDeleted` filter — deleted budgets shown in list | Added `.Where(x => !x.IsDeleted)` |
| 4 | 🟠 High | 8 mutation hooks had no `onError` handler — API failures silently swallowed | Added `onError: (e: Error) => toast.error(e.message)` to each |
| 5 | 🟠 High | Same 8 hooks had no `onSuccess` toast | Added `toast.success(...)` to each |
| 6 | 🟡 Medium | `window.confirm()` used for delete in `invoicing-view.tsx` | Replaced with inline React confirmation modal |
| 7 | 🟡 Medium | `window.confirm()` used for cancel-invoice in `invoice-drawer.tsx` | Replaced with inline React confirmation modal |
| 8 | 🟡 Medium | `<select>` dropdowns in `add-journal-form.tsx` and `add-budget-form.tsx` had `bg-transparent` — browser renders OS-native white popup in dark mode | Changed to `bg-card` — matches dark theme |

### Finance Module Architecture

```
Finance Service: /api/finance/*
  ├── /invoices           — InvoicesController  (CRUD + send/pay/cancel)
  ├── /accounts           — AccountsController   (MediatR/CQRS — unlike others)
  ├── /banking/accounts   — BankingController    (CRUD + reconcile)
  ├── /banking/transactions
  ├── /budgets            — BudgetsController    (CRUD, IsDeleted filtered)
  ├── /expenses           — ExpensesController   (CRUD + approve/reject/pay, IsDeleted filtered)
  ├── /journal-entries    — JournalEntriesController (CRUD + post/void)
  ├── /journals           — JournalsController   (frontend alias — GET only, better DTOs)
  ├── /gl/summary         — GeneralLedgerController
  ├── /gl/trial-balance
  ├── /gl/profit-loss
  ├── /gl/balance-sheet
  ├── /gl/cash-flow
  ├── /recurring          — RecurringInvoicesController
  └── /tax                — TaxController (VAT)
```

**Key design note — Two journal controllers:**
- `JournalEntriesController` at `/api/finance/journal-entries` — mutations only (POST create, POST post, POST void, DELETE)
- `JournalsController` at `/api/finance/journals` — reads only, with richer DTOs (includes `journalNumber`, `period`, `accountCode`, `debit`, `credit`)

**The frontend must use `/journals` for reads and `/journal-entries` for writes.**

---

## Module 5 — Inventory QA

### Files Touched
- `FrontendVite/src/modules/inventory/warehouses/components/add-warehouse-form.tsx` — wired Save to API
- `FrontendVite/src/modules/inventory/master/components/categories-master-view.tsx` — replaced `confirm()`, added try/catch
- `FrontendVite/src/modules/inventory/master/components/brands-view.tsx` — replaced `confirm()`, added try/catch
- `FrontendVite/src/modules/inventory/master/components/uom-view.tsx` — replaced `confirm()`, added try/catch

### Bugs Fixed

| # | Severity | Bug | Fix |
|---|----------|-----|-----|
| 1 | 🔴 Critical | `AddWarehouseForm` "Save Warehouse" button called `onClose()` directly — all data silently discarded | Added `useCreateWarehouse` + `handleSave()` wired to API |
| 2 | 🟡 Medium | `CategoriesMasterView.handleDelete` used native `confirm()` | Replaced with `pendingDelete` state + React confirmation modal |
| 3 | 🟡 Medium | `BrandsView.handleDelete` used native `confirm()` | Same fix |
| 4 | 🟡 Medium | `UoMView.handleDelete` used native `confirm()` | Same fix |
| 5 | 🟡 Medium | `CategoryDialog`, `BrandDialog`, `UoMDialog` called `mutateAsync()` without try/catch — unhandled rejection | Wrapped in `try { ... onClose() } catch { /* hook toasts */ }` |

### Backend Inventory Controllers (confirmed implemented)
| Controller | Endpoints |
|-----------|-----------|
| `ProductsController` | GET all (paginated, filterable), GET by id, GET by barcode, POST create, PUT update, PATCH activate, PATCH deactivate, DELETE |
| `WarehousesController` | GET all, GET by id, POST create, PUT update, PATCH set-default, DELETE |
| `StockMovementsController` | POST create (receipt / write-off / adjustment / count-correction) |
| `StockTransfersController` | GET all, GET by id, GET summary, POST create, POST submit, POST approve, POST receive |
| `BrandsController` | GET all (filterable), GET by id, POST create, PUT update, DELETE |
| `ProductCategoriesController` | GET all (filterable), GET by id, POST create, PUT update, DELETE |
| `UnitsOfMeasureController` | GET all (filterable), GET by id, POST create, PUT update, DELETE |
| `ProductStockController` | GET stock by product, GET batches by product |
| `InventoryReportsController` | GET reports (read-only) |

---

## Module 5b — Purchase: Goods Receipt Note (GRN)

**New CQRS feature in `Softaxis.Purchase` microservice** — links `PurchaseOrder` → physical receipt and drives PO status (`sent`/`partial` → `partial`/`received`) based on cumulative received quantities.

`Softaxis.Purchase` previously had NO MediatR/FluentValidation registration and an empty `Application` project — this was the first CQRS feature added there. Existing `PurchaseOrdersController` still injects `DbContext` directly (tech debt, not migrated) — GRN follows the mandatory CQRS pattern regardless, per the architecture rule above.

### Backend Files
- `Softaxis.Purchase.Domain/Entities/GoodsReceiptNote.cs` — `GoodsReceiptNote` (auto `GrnNumber: GRN-{yyyyMMdd}-{6CHAR}`, `Status` "posted"/"cancelled", `Items`) + `GoodsReceiptNoteItem` (`LineTotal => ReceivedQuantity * UnitCost`)
- `Softaxis.Purchase.Infrastructure/Persistence/Configurations/GoodsReceiptNoteConfiguration.cs` — tables `goods_receipt_notes` / `goods_receipt_note_items`, FK to `PurchaseOrder`/`Vendor` (`DeleteBehavior.Restrict`), `HasQueryFilter(!IsDeleted)`
- `Softaxis.Purchase.Application/GoodsReceiptNotes/` — `Commands/CreateGoodsReceiptNoteCommand.cs` (+ FluentValidation), `Queries/GoodsReceiptNoteQueries.cs`, `Dtos/GoodsReceiptNoteDtos.cs`
- `Softaxis.Purchase.Infrastructure/Handlers/GoodsReceiptNotes/` — `CreateGoodsReceiptNoteHandler.cs`, `GetGoodsReceiptNotesHandler.cs`, `GetGoodsReceiptNoteByIdHandler.cs`
- `Softaxis.Purchase.API/Controllers/Common/PurchaseControllerBase.cs` — NEW, mirrors `FinanceControllerBase` (`OkOrError`/`CreatedOrError`/`NoContentOrError`)
- `Softaxis.Purchase.API/Controllers/GoodsReceiptNotesController.cs` — `GET /api/purchase/grn?purchaseOrderId=&vendorId=`, `GET /api/purchase/grn/{id}`, `POST /api/purchase/grn`
- `Softaxis.Purchase.Infrastructure/Extensions/InfrastructureExtensions.cs` — added `AddMediatR` (Logging + Validation behaviors) + `AddValidatorsFromAssembly`
- Migration `AddGoodsReceiptNotes` — applied to `purchase` schema of `SoftaxisErpDb`

### PO Status Logic (CreateGoodsReceiptNoteHandler)
On each GRN creation, cumulative received quantity per PO line = sum across all previously-posted GRNs + the new one. If **every** PO item has cumulative received ≥ ordered quantity → PO status = `"received"`; if **any** item has been received but not all → `"partial"`. Returns `GoodsReceiptNote.Conflict` if the PO is cancelled.

### Frontend Files
- `FrontendVite/src/lib/purchase/grn.api.ts` — `goodsReceiptNotesApi` (`getAll`, `getById`, `create`), `BASE = .../api/purchase/grn`
- `FrontendVite/src/hooks/purchase/use-grn.ts` — `useGoodsReceiptNotes`, `useGoodsReceiptNote`, `useCreateGoodsReceiptNote` (invalidates both `grnKeys.lists()` and `purchaseOrderKeys.lists()`)
- `FrontendVite/src/modules/purchase/grn/components/create-grn-form.tsx` — drawer form, pre-fills lines from `order.items` (received qty defaults to ordered qty), dynamic `TODAY`
- `FrontendVite/src/modules/purchase/grn/components/grn-view.tsx` — GRN list view
- `FrontendVite/src/pages/purchase/grn.tsx` + `App.tsx` route `/purchase/grn` (inside `ModuleGuard module="purchase"`) + `navigation.ts` nav item (icon `PackageCheck`, added to `nav-utils.tsx` iconMap)

### Wired into Purchase Orders view
`purchase-orders-view.tsx` — the "Receive" action button (shown for `status === "sent" || "partial"`) now opens `CreateGrnForm` for that PO instead of directly setting `status: "received"`. Fetches the full `PurchaseOrderDto` (with `items`) via `usePurchaseOrder(grnOrderId)` since the list view only has `PurchaseOrderSummaryDto`.

### Build Status
- **Backend Purchase service:** 0 errors, 0 warnings ✅ (migration applied)
- **Frontend:** `tsc --noEmit` 0 errors ✅

---

## Module 5c — Purchase: Purchase Return

**New CQRS feature in `Softaxis.Purchase` microservice** — records goods returned to a vendor against an existing `PurchaseOrder`. Reuses MediatR/FluentValidation registration added for GRN (Module 5b) — no further `InfrastructureExtensions.cs` changes needed.

Unlike GRN, Purchase Return does **NOT** modify `PurchaseOrder.Status` — it's recorded independently with its own computed `TotalAmount`.

### Backend Files
- `Softaxis.Purchase.Domain/Entities/PurchaseReturn.cs` — `PurchaseReturn` (auto `ReturnNumber: PRET-{yyyyMMdd}-{6CHAR}`, `Status` "posted"/"cancelled", `Items`, computed `TotalAmount => Items.Sum(LineTotal)`) + `PurchaseReturnItem` (`LineTotal => Quantity * UnitCost`)
- `Softaxis.Purchase.Infrastructure/Persistence/Configurations/PurchaseReturnConfiguration.cs` — tables `purchase_returns` / `purchase_return_items`, FK to `PurchaseOrder`/`Vendor` (`DeleteBehavior.Restrict`), `HasQueryFilter(!IsDeleted)`, `Ignore(TotalAmount)` / `Ignore(LineTotal)`
- `Softaxis.Purchase.Application/PurchaseReturns/` — `Commands/CreatePurchaseReturnCommand.cs` (+ FluentValidation), `Queries/PurchaseReturnQueries.cs`, `Dtos/PurchaseReturnDtos.cs`
- `Softaxis.Purchase.Infrastructure/Handlers/PurchaseReturns/` — `CreatePurchaseReturnHandler.cs` (returns `PurchaseReturn.NotFound`/`PurchaseReturn.Conflict` if PO cancelled), `GetPurchaseReturnsHandler.cs`, `GetPurchaseReturnByIdHandler.cs`
- `Softaxis.Purchase.API/Controllers/PurchaseReturnsController.cs` — `GET /api/purchase/returns?purchaseOrderId=&vendorId=`, `GET /api/purchase/returns/{id}`, `POST /api/purchase/returns`
- Migration `AddPurchaseReturns` — applied to `purchase` schema of `SoftaxisErpDb`

### Frontend Files
- `FrontendVite/src/lib/purchase/returns.api.ts` — `purchaseReturnsApi` (`getAll`, `getById`, `create`), `BASE = .../api/purchase/returns`
- `FrontendVite/src/hooks/purchase/use-purchase-returns.ts` — `usePurchaseReturns`, `usePurchaseReturn`, `useCreatePurchaseReturn` (invalidates `purchaseReturnKeys.lists()` only — return doesn't change PO status)
- `FrontendVite/src/modules/purchase/returns/components/create-purchase-return-form.tsx` — drawer form, pre-fills lines from `order.items` with `returnQty` defaulting to `0` (opt-in per item, `max={orderedQuantity}`), `REASONS` dropdown (`bg-card`), dynamic `TODAY`
- `FrontendVite/src/modules/purchase/returns/components/purchase-returns-view.tsx` — list view (search by return #/PO #/vendor, `STATUS_CONFIG` for posted/cancelled)
- `FrontendVite/src/pages/purchase/returns.tsx` + `App.tsx` route `/purchase/returns` (inside `ModuleGuard module="purchase"`) + `navigation.ts` nav item (icon `RotateCcw`, already in `nav-utils.tsx` iconMap from Sales Returns)

### Wired into Purchase Orders view
`purchase-orders-view.tsx` — a "Return" outline button (shown for `status === "received" || "partial"`) opens `CreatePurchaseReturnForm` for that PO. Fetches the full `PurchaseOrderDto` via a second `usePurchaseOrder(returnOrderId)` call (separate from the GRN one).

### Build Status
- **Backend Purchase service:** 0 errors, 0 warnings ✅ (migration applied)
- **Frontend:** `tsc --noEmit` 0 errors ✅

---

## Module 5d — Purchase: Purchase Invoices (AP Bills — Tax / Non-Tax / Import)

**Frontend built for an existing backend feature.** `Softaxis.Finance` already had a fully CQRS-compliant
`PurchaseBill` entity + `PurchaseBillsController` from a prior "AP module" phase (commit "Add AP module:
PurchaseBill and PaymentVoucher with billwise allocation"), but **zero frontend** existed for it. Rather than
build separate "Non-Tax Purchase Invoice" / "Import Purchase Invoice" features, this single feature covers all
three via the existing `TaxRate` and `CurrencyCode` fields:
- `TaxRate === 0` → Non-Tax Purchase Invoice
- `CurrencyCode !== "AED"` → Import Purchase Invoice

### Backend Files (Softaxis.Finance — additions only, `CurrencyCode` was on the entity but not exposed)
- `Softaxis.Finance.Application/PurchaseBills/Dtos/PurchaseBillDtos.cs` — added `string CurrencyCode` to `PurchaseBillSummaryDto` and `PurchaseBillDto` (after `TaxRate`)
- `Softaxis.Finance.Application/PurchaseBills/Commands/PurchaseBillCommands.cs` — added `string? CurrencyCode` to `CreatePurchaseBillCommand` (not added to `UpdatePurchaseBillCommand` — currency not editable post-creation)
- `Softaxis.Finance.Infrastructure/Handlers/PurchaseBills/CreatePurchaseBillHandler.cs` — calls existing `bill.SetCurrencyCode(cmd.CurrencyCode)` when provided
- `Softaxis.Finance.Infrastructure/Handlers/PurchaseBills/PurchaseBillMappings.cs` — `ToDto` includes `x.CurrencyCode`
- `Softaxis.Finance.Infrastructure/Handlers/PurchaseBills/GetPurchaseBillsHandler.cs` — list projection includes `x.CurrencyCode`

Existing routes used as-is: `GET/POST /api/finance/purchase-bills`, `GET .../summary`, `GET/PUT .../{id}`,
`POST .../{id}/approve`, `POST .../{id}/cancel`, `DELETE .../{id}`. Also added `getSuppliers` to the frontend
using the existing `GET /api/finance/suppliers?search=&isActive=`.

### Frontend Files
- `FrontendVite/src/lib/finance/finance.api.ts` — new `SupplierDto`, `PurchaseBillStatus`, `PurchaseBillItemDto`,
  `PurchaseBillSummaryDto`, `PurchaseBillDto`, `PurchaseBillsSummaryDto`, `PagedResult<T>`,
  `CreatePurchaseBillRequest`; `getSuppliers`, `getPurchaseBills`, `getPurchaseBillsSummary`,
  `getPurchaseBillById`, `createPurchaseBill`, `approvePurchaseBill`, `cancelPurchaseBill`, `deletePurchaseBill`
- `FrontendVite/src/hooks/finance/use-finance.ts` — `useSuppliers`, `usePurchaseBills`, `usePurchaseBillsSummary`,
  `usePurchaseBillById`, `useCreatePurchaseBill`, `useApprovePurchaseBill`, `useCancelPurchaseBill`,
  `useDeletePurchaseBill` (all mutations invalidate `purchase-bills` + `purchase-bills-summary`)
- `FrontendVite/src/modules/purchase/bills/components/create-purchase-bill-form.tsx` — drawer form with
  "Invoice Type" Tax/Non-Tax toggle (drives `taxRate` sent as 0 when Non-Tax) and a Currency `<select>`
  (shows "Import invoice — amounts recorded in {currencyCode}" banner when non-AED)
- `FrontendVite/src/modules/purchase/bills/components/purchase-bills-view.tsx` — list view with stat cards
  (Total/Draft/Outstanding/Total Amount/Paid/Due), status filters, "Non-Tax" and "Import · {currencyCode}"
  badges per row, Approve/Cancel actions, amounts shown via `formatCurrency(amount, b.currencyCode)`
- `FrontendVite/src/pages/purchase/bills.tsx` + `App.tsx` route `/purchase/bills` (inside `ModuleGuard
  module="purchase"`) + `navigation.ts` nav item "Purchase Invoices" (icon `Receipt`, already in
  `nav-utils.tsx` iconMap from Finance Invoicing)

### Build Status
- **Backend Finance service:** 0 errors, 0 warnings ✅
- **Frontend:** `tsc --noEmit` 0 errors ✅

---

## Module 5e — Sales: Delivery Challan

**New CQRS feature in `Softaxis.Sales` microservice** — first CQRS feature ever added to this service, mirroring
the Purchase GRN pattern (Module 5b) exactly. Records goods delivered to a customer against an existing
`SalesOrder` and drives `SalesOrder.Status` (`"confirmed"`/`"shipped"` → `"shipped"`/`"delivered"`) based on
cumulative delivered quantities, analogous to how GRN drives PO status.

`Softaxis.Sales.Application` previously had **no CQRS feature folders** and `Softaxis.Sales.Infrastructure`
had **no MediatR/FluentValidation registration** — both added for the first time here (`AddMediatR` with
Logging + Validation behaviors + `AddValidatorsFromAssembly`; required adding the
`FluentValidation.DependencyInjectionExtensions` package reference to `Softaxis.Sales.Infrastructure.csproj`,
which Purchase already had). `SalesOrdersController` / `SalesReturnsController` remain tech debt (inject
`SalesDbContext` directly) — DeliveryChallan follows the mandatory CQRS pattern regardless.

### Backend Files
- `Softaxis.Sales.Domain/Entities/DeliveryChallan.cs` — `DeliveryChallan` aggregate (private ctor, public ctor
  `(salesOrderId, customerId?, challanDate, driverName?, notes?)`, auto `ChallanNumber = "DC-{yyyyMMdd}-{6CHAR}"`,
  `Status` "posted"/"cancelled", `Items`, `AddItem(...)`, `Cancel()`) + `DeliveryChallanItem`
  (ctor `(deliveryChallanId, salesOrderItemId?, productId?, description, orderedQuantity, deliveredQuantity, unitPrice)`,
  computed `LineTotal => DeliveredQuantity * UnitPrice`). `ChallanDate` is `string` (matches GRN's `GrnDate`).
  `CustomerId` is nullable (`Guid?`), copied from `SalesOrder.CustomerId`.
- `Softaxis.Sales.Infrastructure/Persistence/Configurations/DeliveryChallanConfiguration.cs` — tables
  `delivery_challans`/`delivery_challan_items`, FK to `SalesOrder`/`Customer` (`DeleteBehavior.Restrict`),
  `HasQueryFilter(!IsDeleted)`, unique index on `ChallanNumber`, indexes on `SalesOrderId`/`CustomerId`,
  cascade on Items, `Ignore(LineTotal)`
- `Softaxis.Sales.Application/DeliveryChallans/` — `Commands/CreateDeliveryChallanCommand.cs` (+ FluentValidation),
  `Queries/DeliveryChallanQueries.cs`, `Dtos/DeliveryChallanDtos.cs`
- `Softaxis.Sales.Infrastructure/Handlers/DeliveryChallans/` — `CreateDeliveryChallanHandler.cs`,
  `GetDeliveryChallansHandler.cs`, `GetDeliveryChallanByIdHandler.cs`
- `Softaxis.Sales.API/Controllers/Common/SalesControllerBase.cs` — NEW, mirrors `PurchaseControllerBase`
  (`OkOrError`/`CreatedOrError`/`NoContentOrError`)
- `Softaxis.Sales.API/Controllers/DeliveryChallansController.cs` — `GET /api/sales/delivery-challans?salesOrderId=&customerId=`,
  `GET /api/sales/delivery-challans/{id}`, `POST /api/sales/delivery-challans`
- `Softaxis.Sales.Infrastructure/Extensions/InfrastructureExtensions.cs` — added `AddMediatR` (Logging +
  Validation behaviors) + `AddValidatorsFromAssembly`
- Migration `AddDeliveryChallans` — applied to `sales` schema of `SoftaxisErpDb`

### SalesOrder Status Logic (CreateDeliveryChallanHandler)
On each Delivery Challan creation, cumulative delivered quantity per sales order line = sum across all
previously-posted challans + the new one. If **every** order item has cumulative delivered ≥ ordered quantity
→ order status = `"delivered"`; if **any** item has been delivered but not all → `"shipped"`. Returns
`DeliveryChallan.Conflict` if the sales order is cancelled.

### Frontend Files
- `FrontendVite/src/lib/sales/delivery-challans.api.ts` — `deliveryChallansApi` (`getAll`, `getById`, `create`),
  `BASE = .../api/sales/delivery-challans`
- `FrontendVite/src/hooks/sales/use-delivery-challans.ts` — `useDeliveryChallans`, `useDeliveryChallan`,
  `useCreateDeliveryChallan` (invalidates both `deliveryChallanKeys.lists()` and `salesOrderKeys.lists()`)
- `FrontendVite/src/modules/sales/delivery-challans/components/create-delivery-challan-form.tsx` — drawer form,
  pre-fills lines from `order.items` (delivered qty defaults to ordered qty), dynamic `TODAY`
- `FrontendVite/src/modules/sales/delivery-challans/components/delivery-challans-view.tsx` — list view
- `FrontendVite/src/pages/sales/delivery-challans.tsx` + `App.tsx` route `/sales/delivery-challans` (inside
  `ModuleGuard module="sales"`) + `navigation.ts` nav item "Delivery Challans" (icon `Truck`, already in
  `nav-utils.tsx` iconMap)

### Wired into Sales Orders view
`orders-view.tsx` — the previous separate "Ship" and "Deliver" status-change buttons (shown for
`status === "confirmed"`/`"shipped"`) were replaced with a single "Delivery Challan" button (shown for
`status === "confirmed" || "shipped"`) that opens `CreateDeliveryChallanForm` for that order. Fetches the full
`SalesOrderDto` (with `items`) via `useSalesOrder(dcOrderId)` since the list view only has `SalesOrderSummaryDto`.
The "Confirm" button (`pending` → `confirmed`) still uses `useUpdateSalesOrderStatus` directly.

### Build Status
- **Backend Sales service:** 0 errors, 0 warnings ✅ (migration applied)
- **Frontend:** `tsc --noEmit` 0 errors ✅

---

## Module 5f — Project Management: Role-Based Access Control (RBAC)

**Brought the new Project Management module (Module 5/Kanban — Projects/Boards/Sprints/Issues/Comments) into
the existing tenant-wide RBAC system.** Previously any authenticated user could do anything in this module —
no backend controller anywhere enforced `Permission`/`Role`/`RolePermission`, it was frontend-only (and not
even gated there). This introduces the **first backend permission-enforcement pattern** in the codebase
(`[RequirePermission]`), reusable by other services going forward.

### Permission groups seeded (5 groups × 4 actions = 20 permissions)
`Backend/.../Identity/Softaxis.Identity.Application/Seed/PermissionSeedData.cs` — added to `ModuleActions`:
```csharp
["project-management.projects"] = ["view","create","edit","delete"],
["project-management.boards"]   = ["view","create","edit","delete"],
["project-management.labels"]   = ["view","create","edit","delete"],
["project-management.sprints"]  = ["view","create","edit","delete"],
["project-management.issues"]   = ["view","create","edit","delete"],
```
Migration `AddProjectManagementPermissions` (Identity service) generated — applies automatically via
`MigrateAndSeedAsync` on next gateway startup.

### `SyncAdministratorPermissionsAsync` (new, idempotent — runs every startup)
`Backend/.../Identity/Softaxis.Identity.Infrastructure/Extensions/InfrastructureExtensions.cs` — for every
system `Administrator` role, diffs `allPermissionIds` against `role.RolePermissions` and calls the existing
idempotent `Role.AddPermission(id)` for any missing ones (`.Include(r => r.RolePermissions)` required).
Ensures existing tenants' Administrator roles automatically gain new permissions (like the 20 above) without
manual intervention.

### `[RequirePermission]` attribute (new pattern)
`Backend/src/Services/ProjectManagement/Softaxis.ProjectManagement.API/Authorization/RequirePermissionAttribute.cs`
— `IAuthorizationFilter`. Bypasses check if JWT has `is_super_admin == "true"`; otherwise requires a
`"permission"` claim matching the given string (e.g. `"project-management.issues.edit"`). On failure returns
`403` with `{ Code: "Permission.Denied", Description: "Missing permission: <perm>" }`.

Applied to every action across `ProjectsController`, `BoardColumnsController`, `LabelsController`,
`SprintsController`, `IssuesController`, `CommentsController` — `GetAll`/`GetById` → `*.view`, `Create` →
`*.create`, `Update`/`Move`/`MoveToSprint`/`Start`/`Complete`/`Reorder` → `*.edit`, `Delete` → `*.delete`.

### Frontend gating (`hasRawPermission("project-management.<feature>.<action>")`)
Same pattern as `retail-pos-view.tsx` — `const canX = hasRawPermission(...)`, then `{canX && <Button>...}`.
Applied across `project-management-view.tsx`, `board-view.tsx`, `manage-columns-modal.tsx`, `issue-card.tsx`,
`backlog-view.tsx`, `issues-view.tsx`, `issue-detail-drawer.tsx`.

**Drag-and-drop gating (`@dnd-kit`)** — defense in depth, since the backend now also enforces via
`[RequirePermission]`:
- `SortableIssueCard` (`issue-card.tsx`) takes `canDrag?: boolean` (default `true`) — only spreads
  `{...attributes} {...listeners}` when `canDrag`.
- `Column` (`board-view.tsx`) and `Section` (`backlog-view.tsx`) take `canDrag`/`canCreate` props, passed down
  to cards and gating the quick-add UI.
- `DndContext`'s `onDragEnd` is set to `undefined` (not just a no-op) when the relevant edit permission is
  missing — disables drops entirely rather than allowing a drag that fails server-side.

### `roles-permissions-view.tsx`
```ts
const MODULE_GROUPS: Record<string, string> = {
  inventory: "Inventory", pos: "POS", finance: "Finance", hr: "HR",
  crm: "CRM", sales: "Sales", purchase: "Purchase", settings: "Settings",
  "project-management": "Project Management",
};
const GROUP_ORDER = ["POS","Inventory","Finance","Sales","Purchase","CRM","HR","Project Management","Settings"];
```
`groupPermissions`/`moduleLabel` already derive groups generically from `moduleId.split(".")[0]` — no other
changes needed.

### Build Status
- **Backend ProjectManagement.API:** 0 errors, 0 warnings ✅
- **Backend Identity.API:** 0 errors, 1 pre-existing unrelated warning (SmtpEmailService nullable) ✅
- **Frontend:** `tsc --noEmit` 0 errors ✅
- **Pending:** apply the `AddProjectManagementPermissions` migration on next service startup (runs
  automatically via `MigrateAndSeedAsync`); manual end-to-end test with a restricted custom role to confirm
  403s + UI hide/show.

---

## Module 5g — Project Management: Project-Team Membership / Access Scoping

**Builds on top of Module 5f's tenant-wide RBAC** — permissions still gate *what actions* a user can perform;
a new `ProjectMember` join entity now also gates *which projects* a user can see/act on at all. Previously
any user with `project-management.projects.view` could see (and drill into) every project in the tenant.

### New entity — `ProjectMember`
`Backend/.../Softaxis.ProjectManagement.Domain/Entities/ProjectMember.cs` — `(Id, ProjectId, UserId, UserName,
UserEmail?, Role, CreatedAt)`, `Role` is `"owner" | "member" | "viewer"`. `UserName`/`UserEmail` denormalized
at add-time (same pattern as `Project.LeadName` — avoids a cross-service call to Identity on every read).
Table `project_members` (`projectmanagement` schema), unique index on `(ProjectId, UserId)`. Gets the usual
`TenantId` shadow column + query filter automatically via `TenantIsolation.ApplyTenantId(...)` (entity lives in
`Softaxis.ProjectManagement.Domain`). Migration: `AddProjectMembers`.

### `ICurrentUser` + `IProjectAccessGuard` (new pattern, first use of `ICurrentUser` in this service)
- `Application/Abstractions/ICurrentUser.cs` — `Id`, `Username`, `Email`, `IsSuperAdmin`, `HasPermission(key)`.
- `API/Middleware/CurrentUserService.cs` — HttpContext-claims-based impl (mirrors POS service's
  `ICurrentUser`/`CurrentUserService`).
- `Infrastructure/Services/ProjectAccessGuard.cs` — `IProjectAccessGuard`:
  ```csharp
  Task<bool> CanAccessAsync(Guid projectId, CancellationToken ct);          // admin OR is a ProjectMember
  IQueryable<Project> AccessibleProjects(IQueryable<Project> source);       // filters to projects where Members.Any(UserId == me)
  ```
  Admin bypass = `currentUser.IsSuperAdmin || currentUser.HasPermission("project-management.projects.delete")`.

### Enforcement (Tier 1 + one Tier 2 spot-check — NOT yet applied everywhere)
- `GetProjectsHandler` — `accessGuard.AccessibleProjects(db.Projects.AsNoTracking())`.
- `GetProjectByIdHandler` — after existence check, `if (!await accessGuard.CanAccessAsync(...)) return Error.NotFoundById(...)` (404, not 403 — avoids leaking existence of projects the user can't see).
- `GetIssueByIdHandler` — same 404 pattern, checked against the issue's `ProjectId`.
- **Fast-follow (not done in this pass)**: Sprints/Labels/BoardColumns/Comments/Issue-list handlers should get
  the same one-line `accessGuard` check — mechanical, same pattern as above.

### Creator auto-enrollment
`CreateProjectHandler` now injects `ICurrentUser` and adds the creating user as an `"owner"` `ProjectMember`
alongside the default board-column seed.

### Backfill (idempotent, runs every startup via `MigrateAndSeedProjectManagementAsync`)
`BackfillProjectMembersAsync` in `InfrastructureExtensions.cs` — any project with **zero** members gets every
tenant user holding `project-management.projects.edit` added as an `"owner"` member. Self-limiting (no-op once
every project has ≥1 member). Cross-schema lookup via `db.Database.SqlQueryRaw<EditorRow>("... FROM
[identity].users u JOIN [identity].user_roles ... ")` — **`identity` is a reserved SQL Server keyword and MUST
be bracketed (`[identity].users`)**, otherwise `SqlException: Incorrect syntax near the keyword 'identity'` at
startup. Both `Softaxis.ProjectManagement.API` and `Softaxis.Identity.API` point at the same physical
`SoftaxisErpDb` (different schemas), enabling this raw cross-schema query without an HTTP call.

### New CQRS feature — `ProjectMembers`
`Application/ProjectMembers/{Dtos,Queries,Commands}` + `Infrastructure/Handlers/ProjectMembers/{Get,Add,Remove,
UpdateRole}ProjectMemberHandler.cs` + `API/Controllers/ProjectMembersController.cs`:
- `GET    /api/projectmanagement/projects/{projectId}/members` — `project-management.projects.view`
- `POST   /api/projectmanagement/projects/{projectId}/members` — `project-management.projects.edit` (no new permission for member management)
- `PUT    /api/projectmanagement/projects/{projectId}/members/{memberId}` — `.edit` (change role)
- `DELETE /api/projectmanagement/projects/{projectId}/members/{memberId}` — `.edit`

Both `Remove` and `UpdateRole` return `409 Error.Custom("ProjectMember.Conflict", "Cannot remove/change the
role of the only owner of a project.")` when the target is the project's sole `"owner"`.

### Frontend
- `FrontendVite/src/lib/project-management/project-members.api.ts` — `projectMembersApi` (getAll/add/updateRole/remove)
- `FrontendVite/src/hooks/project-management/use-project-members.ts` — `useProjectMembers`,
  `useAddProjectMember`, `useUpdateProjectMemberRole`, `useRemoveProjectMember` (invalidate
  `["pm-project-members", projectId]` + project list on add/remove)
- `FrontendVite/src/modules/project-management/components/manage-members-modal.tsx` — member list with
  role `<select className="bg-card">` per row (disabled for the sole owner), remove button (disabled for the
  sole owner, mirrors backend `ProjectMember.Conflict` guard so it's not even clickable), debounced user search
  via existing `usersApi.getAll({ search })` (Identity service) to add new members as `"member"`
- `project-management-view.tsx` — new `Users` icon button per project card (gated by
  `hasRawPermission("project-management.projects.edit")`) opens `ManageMembersModal`

### Bug found & fixed during verification — backfilled rows had `TenantId = NULL`

`BackfillProjectMembersAsync` originally relied on `SaveChangesAsync` → `TenantIsolation.StampTenantId` to
stamp the shadow `TenantId` column on new `ProjectMember` rows. `StampTenantId` is a no-op unless
`TenantAmbient.IsResolved` — which is **never true** during the startup seed step (no HTTP request context).
Result: every backfilled `ProjectMember` row got `TenantId = NULL`, while `Project.TenantId` was the real
tenant guid. `TenantIsolation`'s global query filter is `TenantId == ambientTenantId`, and `NULL == guid` is
`NULL` (false) in SQL — so `GET /projects/{id}/members` returned `[]` for everyone despite the rows existing.

**Fix** (`InfrastructureExtensions.cs`):
- `BackfillProjectMembersAsync` now explicitly sets `db.Entry(member).Property("TenantId").CurrentValue =
  project.TenantId` on each newly-added `ProjectMember`, instead of relying on `StampTenantId`.
- New `RepairProjectMemberTenantIdsAsync` (runs once per startup, before the backfill, idempotent) finds any
  existing `ProjectMember` rows with `TenantId IS NULL` (via `IgnoreQueryFilters()`) and stamps them from
  their parent `Project.TenantId`. One-time repair for rows created by the original buggy backfill.

### Build Status
- **Backend ProjectManagement service:** 0 errors, 0 warnings ✅ (migration `AddProjectMembers` applied,
  gateway rebuilt and restarted with the `TenantId` repair fix)
- **Frontend:** `tsc --noEmit` 0 errors ✅
- **Verified — full manual walkthrough completed** (as `pmuser@softaxis.io` / `pmviewer@softaxis.io`, both
  Project Manager / PM Viewer Only test roles, against the running ApiGateway on :5000):
  - `pmuser` (owner via backfill): `GET /projects` → "PM Test Project" present; `GET /projects/{id}` → 200;
    `GET /projects/{id}/members` → pmuser + admin1 both listed as `"owner"` (after the TenantId repair —
    previously returned `[]`).
  - `pmviewer` (tenant-wide `*.view` only, not a project member): `GET /projects` → `[]`; `GET
    /projects/{id}` → `404`; `POST /projects/{id}/members` → `403 Permission.Denied` (lacks `.edit`).
  - `pmuser` adds `pmviewer` as `"member"` via `POST /projects/{id}/members` → `200`.
  - `pmviewer` re-run: `GET /projects` → "PM Test Project" now visible; `GET /projects/{id}` → `200`.
  - `pmuser` updates `pmviewer`'s role to `"viewer"` via `PUT .../members/{id}` → `200`.
  - `pmuser` removes `admin1` (owner, not sole owner) via `DELETE .../members/{id}` → `204`.
  - `pmuser` attempts to remove/demote themselves (now sole remaining owner) → both `409
    ProjectMember.Conflict` (`"Cannot remove the only owner of a project."` /
    `"Cannot change the role of the only owner of a project."`).
  - **Frontend**: logged in as `pmuser` in the browser, opened Project Management → "Manage members" on "PM
    Test Project" → `ManageMembersModal` renders pmuser (Owner, delete disabled) and pmviewer (Viewer, role
    `<select>` + remove enabled); searched "admin1" → user picker found "Shahbaz Shafiq"
    (`admin1@pro360rp.com`) → added as `"Member"` → list updated live with toast.

---

## Module 5h — Identity: User-Based Permission Overrides (Grant + Deny)

**Added per-user permission overrides on top of the existing role-based system.** Previously a user's
permissions came *only* from their roles. Now each user can have explicit **grants** (extra permissions beyond
their roles) and **denies** (remove a role-granted permission for just that user). Industry-standard model
(AWS IAM / Odoo): **effective = (rolePerms ∪ userGrants) − userDenies**, with **Deny winning**.

### Why it's low-risk — the single chokepoint
`PermissionRepository.GetPermissionKeysForUserAsync(userId)` is the ONE method that produces the permission
keys embedded in the JWT (used by both `LoginCommandHandler` and `RefreshTokenCommandHandler`). Applying the
effective formula there means the JWT `permission` claims, the frontend `hasRawPermission`, and any backend
`[RequirePermission]` check all respect overrides automatically — no enforcement code changed.

### Backend (Identity service)
- New entity `Domain/Entities/UserPermission.cs` — `(UserId, PermissionId, IsGranted)`; IsGranted=false = deny.
- `User.cs` — `_userPermissions` collection + `SetPermissionOverrides(IEnumerable<(Guid,bool)>, assignedBy)`
  (mirrors `_userRoles`).
- `JoinEntityConfigurations.cs` — `UserPermissionConfiguration` (table `user_permissions`, PK `{UserId,PermissionId}`,
  cascade FKs to User + Permission). `IdentityDbContext` — `DbSet<UserPermission> UserPermissions`.
- **Chokepoint** `PermissionRepository.GetPermissionKeysForUserAsync` rewritten to `(role ∪ grants) − denies`.
- `UserRepository.BaseQuery` — added `.Include(u => u.UserPermissions).ThenInclude(up => up.Permission)`.
- `UserDto` — new `IReadOnlyList<PermissionOverrideDto> PermissionOverrides` (`PermissionOverrideDto(PermissionId,Key,IsGranted)`).
- **New shared mapper** `Application/Common/UserDtoMapper.ToDto(User)` — single source of truth for User→UserDto
  (roles + overrides). All 5 construction sites now use it: Login, RefreshToken, GetUserById, UpdateUser, CreateUser.
  (CreateUser reloads via `GetByIdAsync` after save so Role navigation is populated; Register passes `[], []`.)
- New CQRS `Users/Commands/UpdateUserPermissions/*` + endpoint `PUT /api/users/{id}/permissions`
  body `{ overrides: [{ permissionId, isGranted }] }`. Empty list clears all overrides. Behind `settings.users.edit`
  (same surface as role assignment — no new permission key).
- Migration `AddUserPermissions` (applied; `identity.user_permissions` table confirmed).

### Frontend
- `lib/identity/types.ts` — `PermissionOverrideDto` + `permissionOverrides` on `UserDto`.
- `lib/identity/users.api.ts` — `updatePermissions(userId, overrides)`. `hooks/identity/use-users.ts` — `useUpdateUserPermissions`.
- **`lib/identity/permission-matrix.ts`** (NEW) — extracted shared matrix helpers (`ACTION_ORDER`, `ACTION_LABELS`,
  `MODULE_GROUPS`, `GROUP_ORDER`, `groupPermissions`, `moduleLabel`, `buildPermActionMap`); `roles-permissions-view.tsx`
  now imports them (deduped).
- **`modules/settings/users/components/user-permissions-tab.tsx`** (NEW) — tri-state matrix editor. Cell states:
  inherited-from-role (faded check), **granted** (green check), **denied** (red ✕), off (empty). Click cycles:
  role-granted ⇄ deny; not-granted ⇄ off/grant. "Save overrides" sends only non-inherited cells;
  "Reset to role defaults" clears all. Amber dot marks any non-inherited cell.
- `users-view.tsx` — `UserDrawer` gained a **Profile | Permissions** tab switcher; panel widens to `max-w-3xl`
  on the Permissions tab to fit the matrix.
- `store/auth.store.ts` — `extractRawPermissions(dto)` now applies overrides (`(role∪grants)−denies`, deny last)
  so the logged-in user's own `hasRawPermission` matches the backend JWT.
- **`components/auth/can.tsx`** (NEW) — `<Can permission="x.y.z">…</Can>` + `useCan(key)` gating helper
  (wraps `hasRawPermission`). Applied as the **reference** to the Create User (`settings.users.create`) and
  New Role (`settings.roles.create`) buttons.

### Scope boundaries (confirmed follow-ups, NOT done here)
- Backend `[RequirePermission]` enforcement still only in ProjectManagement — rollout to the other 14 services
  is separate mechanical follow-up. The override chokepoint already makes those checks correct once added.
- Exhaustive per-button `<Can>`/`hasRawPermission` gating across all modules is follow-up; only the reference
  buttons are gated so far.

### ⚠️ Deploy note (on-prem / self-contained service)
The **VroduxERP Windows Service runs the published self-contained exe** (`Deploy/server/output/`), so backend
changes do NOT take effect until you **republish + restart the service** (`Deploy/server/publish.bat`, then
stop/start the service from an elevated shell). The `AddUserPermissions` migration is already applied to
`SoftaxisErpDb` and runs automatically on startup via `MigrateAndSeedAsync` for fresh deployments. End-to-end
verified by running the new build on port 5099 against the same DB (grant/deny/reset all confirmed at JWT level).

### Build / Verification Status
- **Backend (Identity.API + full ApiGateway):** 0 errors ✅
- **Frontend `tsc --noEmit`:** 0 errors ✅
- **E2E (port 5099, same DB):** no-role user + grant `hr.payroll.approve` → claim appears; Administrator-role
  user + deny `finance.expenses.delete` → claim removed (deny beats role); `GET /users/{id}` returns the
  override; reset restores defaults; no-override user unchanged (regression). ✅

---

## Module 5l — Identity: Email Verification for Admin-Created Users

**Admin-created users (`POST /api/users`) must now verify their email before they can log in.** Previously
`CreateUserCommandHandler` called `user.VerifyEmail()` to pre-verify — that line is removed; the user stays in
`PendingVerification` until they click an emailed link. `LoginCommandHandler` blocks unverified accounts with a
clear message. **Only** the admin-create path is gated — the trial/onboarding and super-admin tenant-create
paths still pre-verify (see below), so signup and tenant provisioning are unaffected.

### Token model — reuses the password-reset pattern exactly
Single-use, hashed-at-rest, 48h expiry. `IJwtTokenService.GenerateRefreshTokenRaw()` makes the raw token
(base64, 64 random bytes); `HashToken()` (SHA-256 → base64, **deterministic** so lookup-by-hash works) stores
only the hash. Raw token goes in the email link; the DB never sees it.

### Backend (Identity service)
- `Domain/Entities/User.cs` — new `EmailVerificationTokenHash` / `EmailVerificationTokenExpiry` (nullable,
  mapped by convention — no `UserConfiguration` change, same as the reset-token columns).
  - `SetEmailVerificationToken(hash, expiry)` — issue token.
  - `VerifyEmailWithToken(hash)` — validates hash + non-expired; on success sets `EmailVerified = true`,
    `Status = Active`, clears the token; returns `false` otherwise.
- `Abstractions/IEmailService.cs` + `Infrastructure/Services/SmtpEmailService.cs` —
  `SendEmailVerificationAsync(toEmail, toName, verificationToken)`. Builds
  `{FrontendUrl}/auth/verify-email?token=…&email=…` (both URL-encoded). **Dev fallback:** if SMTP host/username
  unconfigured, logs the link (`LogWarning`) instead of sending — link still usable locally. Same MailKit
  connect/auth/send/disconnect as the reset email (465 → SslOnConnect, else StartTls).
- `Users/Commands/CreateUser/CreateUserCommandHandler.cs` — injects `IJwtTokenService` + `IEmailService`;
  removed the `user.VerifyEmail()` pre-verify; issues a 48h token before `Add`, and after `SaveChanges` sends
  the email **best-effort** (`try/catch` — SMTP failure never fails user creation; admin can resend).
- `Auth/Commands/VerifyEmail/` (NEW) — `VerifyEmailCommand(Email, Token)` + handler. Idempotent (already-verified
  → `Success`); bad/expired → `Error.Custom("Auth.VerifyEmail.Invalid", "Invalid or expired verification link.")`.
- `Auth/Commands/ResendVerification/` (NEW) — `ResendVerificationCommand(Email)` + handler. **Enumeration-safe:**
  returns `Success` whether or not the account exists / is already verified; only actually re-issues + sends when
  a matching unverified user is found.
- `API/Controllers/AuthController.cs` — `POST /api/auth/verify-email` (`[AllowAnonymous]`) and
  `POST /api/auth/resend-verification` (`[AllowAnonymous]` + `[EnableRateLimiting("forgot_password")]` — reuses
  the existing 5-req/IP/300s sliding-window policy). Request records `VerifyEmailRequest`/`ResendVerificationRequest`.
- `Auth/Commands/Login/LoginCommandHandler.cs` — after the password check passes, `if (!user.EmailVerified)`
  → `Fail(…, "Please verify your email address before logging in. Check your inbox for the verification link.")`.
- Migration `AddEmailVerificationToken` (Identity) — adds the two columns; auto-applies via `MigrateAndSeedAsync`.

### Paths that stay pre-verified (login NOT blocked) — verified in code
- `Trial/Commands/RegisterTrial/RegisterTrialCommandHandler.cs` — `user.VerifyEmail()` (trial accounts).
- `TenantsAdmin/Commands/CreateTenant/CreateTenantCommandHandler.cs` — `adminUser.VerifyEmail()`.
- The plain self-serve `Auth/Commands/Register` endpoint creates users unverified and sends **no** email — but
  `authApi.register` is **not called anywhere in the frontend** (onboarding uses `registerTrial`), so it's a
  dead endpoint, not a live regression. Left as-is (out of scope).

### Frontend
- `lib/identity/auth.api.ts` — `verifyEmail(email, token)` → `POST /verify-email`; `resendVerification(email)`
  → `POST /resend-verification` (both anonymous `post()` helper).
- `pages/auth/verify-email.tsx` (NEW) — mirrors `reset-password.tsx` theme (DARK/LIGHT palettes, top bar,
  motion card). Auto-verifies on mount from `?token=&email=` (guarded by a `useRef` so it fires once under
  StrictMode). Three states: verifying (spinner) / success (green, "Go to login") / error (red, `errorMsg` from
  the API, plus a "Resend verification link" button when an email is present).
- `App.tsx` — lazy `VerifyEmailPage` + route `/auth/verify-email` (public, alongside reset-password).
- `pages/auth/login.tsx` — when the login error message contains "verify your email", the error toast gets an
  8s **"Resend link"** action calling `authApi.resendVerification(data.email)` (success/failure toast). Other
  errors unchanged.

### Unrelated small fix in same working tree
- `modules/settings/general/components/general-settings-view.tsx` — company name/legalName now fall back to the
  **current tenant's** name (`useAuthStore.getState().tenant?.name`) instead of the hardcoded Softaxis sample,
  so a fresh tenant admin sees their own company.

### Build / Verification Status
- **Identity.API build:** 0 errors ✅ · **Frontend `tsc --noEmit`:** 0 errors ✅ · Migration created (auto-applies on startup).
- **Pending:** end-to-end run — admin creates a user → verification email/logged link → `/auth/verify-email`
  activates → login succeeds; unverified login blocked + resend works. (Backend service must be republished +
  restarted to pick up the change per the on-prem deploy note.)

---

## Module 5i — Finance: Full Module Audit & Authorization Hardening

**First module of the systematic "audit + fix every module" program.** Audited Finance across 4 dimensions:
security/authorization, functional/dead-UI bugs, feature completeness, and architecture/tech-debt.

### Security / Authorization (was the big gap — now closed)
Finance had `[Authorize]` on every controller but **zero per-permission enforcement**. Added:
- **`Softaxis.Finance.API/Authorization/RequirePermissionAttribute.cs`** — copy of the ProjectManagement pattern
  (`IAuthorizationFilter`; reads JWT `permission` claims; super-admin bypass via `is_super_admin`; 403 `{Code,Description}`).
- `[RequirePermission("finance.<key>.<action>")]` on **all 21 controllers**, mapped to the already-seeded
  `finance.*` keys (no migration needed → Administrator/super-admin keep working, non-admins need explicit grants):
  - `finance.invoicing.*` → Invoices, Customers, Receivables, ReceiptVouchers, RecurringInvoices
  - `finance.expenses.*` → Expenses, Suppliers, Payables, PaymentVouchers, PurchaseBills
  - `finance.accounting.*` → Accounts, AccountTypes (writes), ExchangeRates (writes), FiscalPeriods (close/reopen)
  - `finance.journals.*` → Journals, JournalEntries · `finance.gl.view` → GeneralLedger (class-level)
  - `finance.budgeting.*` → Budgets · `finance.banking.*` → Banking · `finance.tax.*` → Tax
- **Intentionally left open** (`[Authorize]` only): `LookupsController` + the GET reads on AccountTypes/ExchangeRates/
  FiscalPeriods — these feed dropdowns across Finance forms; gating their reads would break forms for users who
  can e.g. create invoices but lack `accounting.view`. Gate writes, leave shared reference reads open.
- Where a controller exposes an action with no matching seeded key (budget delete, journal delete), gated on the
  nearest key (`edit`) with a code comment — avoids blocking admins without a migration.
- **Frontend `<Can>` gating** added to every primary create button across the Finance views (Invoicing, Expenses,
  Budgeting, Banking ×2, Journals, Tax, Recurring, Accounting).
- **Verified live** (gateway on :5099, same DB): a user granted only `finance.invoicing.view` → invoice list 200,
  invoice create/delete 403, expenses 403, GL 403, open lookups 200. Exactly as designed.

### Functional / dead-UI bugs
- Scanned all Finance views: **no** dead `onClick`, **no** `window.confirm`/`alert`, **no** TODO/console — prior QA was thorough.
- **Bug found & fixed:** 5 mutation hooks in `hooks/finance/use-finance.ts` (`useSendInvoice`, `useMarkInvoicePaid`,
  `useCancelInvoice`, `useDeleteInvoice`, `useCreateExpense`) had **no `onError` and no success toast** — they
  silently swallowed failures (now especially relevant since the new enforcement can return 403). Added
  `onError: toast.error` + success toasts to all 5, matching every other hook in the file.
- **Endpoint audit:** every `finance.api.ts` path verified against the backend routes — all correct, including the
  journals read/write split (`GET /journals`, writes → `/journal-entries`). No 404 mismatches.

### Completeness / Tech-debt
- Finance is already clean CQRS (`ISender`, no inline `DbContext`/DTOs) — **no tech-debt migration needed**.
- Minor noted gap (not a bug, left as-is): the budgets API client exposes create + status-change but not
  `updateBudget`/`deleteBudget`.

### Build / Verification Status
- **Finance.API + full ApiGateway:** 0 errors ✅ · **Frontend `tsc --noEmit`:** 0 errors ✅ · **Live 403 enforcement:** verified ✅

---

## Module 5j — HR: Full Module Audit & Authorization Hardening

**Second module of the audit program** (after Finance 5i). Same 4-dimension pass.

### Doc correction
CLAUDE.md's HR sections previously implied `PerformanceController`/`RecruitmentController` are **NOT
IMPLEMENTED** and that HR controllers inject `DbContext` (tech debt). **Both are stale** — all 8 HR controllers
are clean CQRS (`ISender` + `HrControllerBase`), and Performance/Recruitment are fully implemented.

### Security / Authorization (the gap — now closed)
Every HR controller had `[Authorize]` but **zero per-permission enforcement**. Added:
- **`Softaxis.HR.API/Authorization/RequirePermissionAttribute.cs`** (copy of the Finance/PM pattern).
- `[RequirePermission("hr.<key>.<action>")]` on all action controllers → seeded `hr.*` keys:
  - `hr.employees.*` → Employees · `hr.attendance.*` → Attendance · `hr.leaves.*` → Leaves
  - `hr.payroll.*` → Payroll · `hr.performance.*` → Performance · `hr.recruitment.*` → Recruitment
- **Payroll** has no seeded `edit`/`delete` → workflow transitions (process/pay/reject/reopen), slip edits, and
  run delete gate on `hr.payroll.approve`; slip email on `hr.payroll.print`. **Leaves/Attendance/Performance**
  have no `delete` key → deletes gate on `edit`. (Same "nearest seeded key" rule as Finance — no migration, admins unaffected.)
- **Intentionally left open:**
  - `CareersController` — it's `[AllowAnonymous]` (public careers portal, tenant resolved from URL slug). Must stay anonymous.
  - `GET /api/hr/employees/all` — the lightweight dropdown feed consumed by Leave/Payroll/Attendance forms;
    gating it would break those forms for users who can create leaves/payroll but lack `hr.employees.view`.
  - `DepartmentsController` GET reads (feed the employee-form department dropdown) — writes gated on `hr.employees.*`.
- **Frontend `<Can>` gating** on all 6 primary create buttons: Add Employee, Mark Attendance, Apply Leave,
  Run Payroll, New Review, Post Job.
- **Verified live** (:5099): a user with only `hr.employees.view` → employees list 200 + `/employees/all` 200,
  but employee create 403, payroll list/pay 403, leaves 403.

### Functional / dead-UI + Completeness + Tech-debt
- HR views scanned: **no** dead `onClick`, **no** `window.confirm`/`alert`, **no** TODO/console.
- `hooks/hr/use-hr.ts`: **all 31 mutation hooks already have `onError` + success toasts** — nothing to fix (cleaner than Finance was).
- HR is already clean CQRS — no tech-debt migration.

### Build / Verification Status
- **HR.API + full ApiGateway:** 0 errors ✅ · **Frontend `tsc --noEmit`:** 0 errors ✅ · **Live 403 enforcement:** verified ✅

---

## Module 5k — Inventory: Full Module Audit & Authorization Hardening

**Third module of the audit program** (after Finance 5i, HR 5j). Same profile: clean CQRS, `[Authorize]` but
zero per-permission enforcement.

### Security / Authorization
- **`Softaxis.Inventory.API/Authorization/RequirePermissionAttribute.cs`** (copy of the shared pattern).
- `[RequirePermission("inventory.<key>.<action>")]` on all 10 controllers → seeded `inventory.*` keys:
  - `inventory.stock.*` → Products, ProductStock (view), InventoryReports (view), **and the master-data write
    actions** on Brands/Categories/UnitsOfMeasure.
  - `inventory.warehouses.*` → Warehouses · `inventory.movements.*` → StockMovements
  - `inventory.transfers.*` → StockTransfers (submit→create as the requester action; approve & receive→approve).
- **Intentionally left open** (`[Authorize]` only): the **GET reads** on Brands/Categories/UnitsOfMeasure —
  they feed the product-create form's brand/category/UoM dropdowns, so gating them would break the form for
  users who can create products but lack the read. Writes on those three gate on `inventory.stock.*` (no
  dedicated master-data permission keys).
- **Frontend `<Can>` gating** on all 7 primary create buttons: Add Product, Add Warehouse, Record Adjustment,
  New Transfer, New Brand, New Category, New Unit.
- **Verified live** (:5099): a user with only `inventory.stock.view` → products list 200 + brands dropdown 200,
  but product create 403, warehouses/transfers 403, stock-movement create 403.

### Functional / dead-UI + Completeness + Tech-debt
- Inventory views scanned: **no** dead `onClick`, **no** `window.confirm`/`alert`, **no** TODO/console (prior QA
  Module 5 already replaced the native `confirm()`s).
- All inventory mutation hooks already have `onError` — nothing to fix.
- Already clean CQRS — no tech-debt migration.

### Build / Verification Status
- **Inventory.API + full ApiGateway:** 0 errors ✅ · **Frontend `tsc --noEmit`:** 0 errors ✅ · **Live 403 enforcement:** verified ✅

---

## Module 5m — CRM: Full Module Audit & Authorization Hardening

**Fourth module of the audit program** (after Finance 5i, HR 5j, Inventory 5k). CRM is clean CQRS (all
controllers `ISender` + `CrmControllerBase`, no `DbContext`, no tech debt) but had `[Authorize]` with **zero
per-permission enforcement**.

### Security / Authorization
- **`Softaxis.CRM.API/Authorization/RequirePermissionAttribute.cs`** (copy of the shared pattern). **Gotcha:**
  the CRM API project has **no implicit `Microsoft.AspNetCore.Http` using** (unlike Finance), so the attribute
  needs an explicit `using Microsoft.AspNetCore.Http;` or `StatusCodes` fails to compile (CS0103).
- `[RequirePermission("crm.<key>.<action>")]` on the **6 core CRM controllers** → seeded `crm.*` keys
  (`crm.leads`, `crm.pipeline`, `crm.customers` — each view/create/edit + leads/customers also delete/export):
  - `LeadsController` → `crm.leads.*` (view/create/edit/delete; Convert → edit; status/score patches → edit).
  - `PipelineController` (route `api/crm/deals`) → `crm.pipeline.*` (**no `pipeline.delete` key** → delete gates
    on the nearest key `crm.pipeline.edit`, with a code comment; same "nearest seeded key" rule as Finance/HR).
  - `CrmCustomersController` → `crm.customers.*`.
  - `ContactsController` (customer-scoped, `?customerId=`) → `crm.customers.*`.
  - `ActivitiesController` → `crm.leads.*` — **no dedicated `crm.activities` permission group exists**;
    activities are the follow-up/task layer over leads & deals, so gated on the nearest key (`crm.leads`) with a
    class-level comment. A future migration could add `crm.activities` if finer control is needed.
  - `CrmDashboardController` → class-level `crm.leads.view` (read-only CRM overview).
- **Deliberately NOT gated in this pass — the 4 industry-vertical controllers** `B2BController` (`api/b2b`),
  `EducationController` (`api/education`), `HealthcareController` (`api/healthcare`), `InsuranceController`
  (`api/insurance`). They live in the CRM **assembly** but are effectively **separate modules** (13–15 endpoints
  each, own frontend API clients under `lib/{b2b,education,healthcare,insurance}/`) with **NO seeded permission
  keys at all**. Gating them on a made-up key would 403 everyone (no role grants it); gating on `crm.*` keys is
  semantically wrong. Correct fix = seed their own permission groups (Identity migration) + audit each as its
  own module — a larger scoped effort, flagged as **follow-up**, left `[Authorize]`-only for now (no worse than
  before). Same "don't compound; flag it" rule from the architecture section.
- **Frontend `<Can>` gating** on the 3 primary create buttons (Add Lead / Add Deal / Add Customer) and on the
  destructive **Delete** buttons in all 3 drawers (`crm.leads.delete` / `crm.pipeline.edit` / `crm.customers.delete`).

### Functional / dead-UI bugs (found & fixed)
- **3 native `confirm()` calls** — the project rule (never use `window.confirm`) was violated in
  `lead-drawer.tsx`, `deal-drawer.tsx`, `customer-drawer.tsx` (delete actions). Replaced each with a
  state-based (`confirmDelete`) in-drawer confirmation modal (Framer Motion overlay, `absolute inset-0 z-[60]`,
  resets on drawer close), matching the pattern used in Inventory/Finance.
- No dead `onClick`, no `alert`, no `TODO`/`console` elsewhere in CRM.
- `hooks/crm/use-crm.ts`: both mutation factories already have `onError: toast.error` + success toasts — nothing to fix.

### Completeness / Tech-debt
- Core CRM is already clean CQRS — no tech-debt migration. (Minor pre-existing style deviation: Leads/Pipeline/
  Customers/Contacts controllers define their `Update*Request` records **inline** rather than in `Dtos/` — left
  as-is, not compounded.)

### Build / Verification Status
- **CRM.API build:** 0 errors ✅ · **Frontend `tsc --noEmit`:** 0 errors ✅
- **Pending:** live 403 spot-check (grant only `crm.leads.view` → leads list 200, lead create/delete 403,
  pipeline/customers 403) once the service is republished + restarted.

---

## Module 5n — CRM Industry Verticals: New Permission Groups + Authorization

**Follow-up to Module 5m's flagged item.** The 4 industry-vertical controllers in the CRM assembly (B2B,
Education, Healthcare, Insurance — routes `api/b2b`, `api/education`, `api/healthcare`, `api/insurance`) had
**no seeded permission keys**, so 5m left them `[Authorize]`-only. This module seeds their own permission
groups and applies per-permission enforcement — bringing them to parity with the audited modules.

### New permission groups seeded — 12 groups (3 sub-features × 4 verticals) = 49 permissions
`Backend/.../Identity/Softaxis.Identity.Application/Seed/PermissionSeedData.cs` — added to `ModuleActions`:
```csharp
// B2B (Proposals → Contracts → Support Tickets)
["b2b.proposals"]/["b2b.contracts"]/["b2b.tickets"]        = view/create/edit/delete
// Education (Admissions → Students → Enrollments)
["education.admissions"]/["education.students"]/["education.enrollments"] = view/create/edit/delete
// Healthcare (Patients → Appointments → Treatment Plans)
["healthcare.patients"]/["healthcare.appointments"]/["healthcare.treatment-plans"] = view/create/edit/delete
// Insurance (Policies → Renewals → Claims)
["insurance.policies"]/["insurance.renewals"]              = view/create/edit/delete
["insurance.claims"]                                       = view/create/edit/delete/approve
```
**How seeding works** (same as PM Module 5f): `PermissionSeedData.GetPermissions()` → `HasData` in
`IdentityDbContext.OnModelCreating` → `dotnet ef migrations add` **auto-generates the `InsertData`** for the new
rows (deterministic MD5-derived GUIDs). Migration `AddCrmVerticalPermissions` applied. On startup,
`SyncAdministratorPermissionsAsync` (runs every boot, idempotent) diffs all seeded permission ids against each
system `Administrator` role and adds the 49 new keys automatically — so existing tenants' admins gain them with
no manual step. Non-admin users need explicit grants.

### Backend enforcement
`[RequirePermission("<vertical>.<feature>.<action>")]` on **every action** across `B2BController`,
`EducationController`, `HealthcareController`, `InsuranceController` (reusing the CRM `RequirePermissionAttribute`
from 5m — these controllers live in `Softaxis.CRM.API`). Mapping: GET → `.view`, POST create → `.create`,
PATCH status / POST enroll/renew/resolve/complete/payment → `.edit`, POST claim approve → `insurance.claims.approve`,
DELETE → `.delete`. Each controller's `GET /summary` is a cross-feature overview → gated on the pack's **primary**
sub-feature view (`b2b.proposals.view` / `education.admissions.view` / `healthcare.patients.view` /
`insurance.policies.view`).

### Frontend
- **`lib/identity/permission-matrix.ts`** — added `b2b`/`education`/`healthcare`/`insurance` to `MODULE_GROUPS`
  (labels "B2B"/"Education"/"Healthcare"/"Insurance") and to `GROUP_ORDER` (after CRM). The matrix groups by
  `moduleId.split(".")[0]`, so each vertical renders as its own group with its 3 sub-features as rows — no other
  matrix changes needed. Both the role editor and the per-user override editor pick this up automatically.
- **`<Can>` gating** in all 4 vertical views (`{vertical}-view.tsx`). Each view has 3 tabs, each with an inline
  `AddBar` (create) + a table with row quick-actions. **Two gating styles** (both fine):
  - `b2b-view.tsx` — the `AddBar` create is wrapped externally with `<Can permission="b2b.<feature>.create">`.
  - `education`/`healthcare`/`insurance` — the local `AddBar` component got an optional `perm?: string` prop that
    wraps its collapsed trigger button in `<Can permission={perm}>` internally (backward-compatible: no `perm`
    still renders). Usages pass `perm="<vertical>.<feature>.create"`.
  - Row **Delete** buttons in every tab wrapped with `<Can permission="<vertical>.<feature>.delete">`.
- **Audit (dead-UI / hooks):** clean — no `window.confirm`/`alert`/`TODO`/`console`; each vertical's hook file
  routes every mutation through a shared `useM` factory that already has `onError: toast.error` + success toasts.
  (Row deletes fire `del.mutate(id)` directly without a confirm modal — not a `window.confirm` violation, and
  consistent with these dense inline-table views; left as-is.)

### Scope notes / follow-ups (not done here)
- Enforcement gates **actions**, not tab visibility — a user lacking a sub-feature's `.view` still sees the tab,
  but its list query 403s (React Query surfaces the toast). Per-tab view gating is a nice-to-have, not done.
- Status-change quick-actions (`.edit`) are enforced on the backend but **not** hidden on the frontend (only
  create + delete are `<Can>`-gated) — mirrors the create+delete gating depth used in the CRM 5m pass.

### Build / Verification Status
- **CRM.API + Identity.API + full ApiGateway:** 0 errors ✅ · **Frontend `tsc --noEmit`:** 0 errors ✅
- Migration `AddCrmVerticalPermissions` created (auto-applies + admin-syncs on startup).
- **Pending:** republish + restart, then live spot-check (grant only `b2b.proposals.view` → proposals 200,
  proposal create/delete 403, contracts/tickets 403; new groups visible in the roles matrix).

---

## Module 5o — Sales: Full Module Audit & Authorization Hardening

**Fifth module of the audit program** (after Finance 5i, HR 5j, Inventory 5k, CRM 5m/5n). Sales had
`[Authorize]` with **zero per-permission enforcement**, and — unlike the earlier clean-CQRS modules — 4 of its 5
controllers are **tech debt** (inject `SalesDbContext` directly + define DTOs inline). Only `DeliveryChallans`
(Module 5e) is clean CQRS.

### Security / Authorization
- **`Softaxis.Sales.API/Authorization/RequirePermissionAttribute.cs`** (copy of the shared pattern; includes the
  explicit `using Microsoft.AspNetCore.Http;` — Sales API has no implicit Http using, same gotcha as CRM 5m).
- `[RequirePermission("sales.<key>.<action>")]` on **all 5 controllers** → seeded `sales.*` keys
  (`sales.quotations`, `sales.orders`, `sales.returns`):
  - `SalesQuotationsController` → `sales.quotations.*` (view/create/edit/delete; **Convert-to-order** → edit,
    with comment — mirrors CRM lead-convert → leads.edit).
  - `SalesOrdersController` → `sales.orders.*` (**no `sales.orders.delete` key** → delete + UpdateStatus gate on
    the nearest key `sales.orders.edit`, commented).
  - `SalesReturnsController` → `sales.returns.*` (**no edit/delete key** → both Approve and **Reject** gate on
    `sales.returns.approve`, commented).
  - `DeliveryChallansController` → `sales.orders.*` (challans are order fulfillment, no dedicated key; GETs →
    orders.view, Create → orders.edit as a fulfillment action, commented).
  - `CustomersController` (`api/sales/customers`) — **GET reads left open** (`[Authorize]` only): they feed the
    customer dropdown in the quotation/order/return forms; gating would break those forms for users who can
    create orders but lack a customer read. Writes gate on `sales.orders.*` (no `sales.customers` key).
- **Frontend `<Can>` gating**: create buttons (New Order / New Quotation / New Return), the order-row Confirm +
  Delivery-Challan actions (`sales.orders.edit`), and drawer actions — order delete (`sales.orders.edit`),
  quotation Convert (`sales.quotations.edit`) + delete (`sales.quotations.delete`), return Approve/Reject
  (`sales.returns.approve`).

### Functional / dead-UI bug found & fixed — Return Approve/Reject was never wired
`return-drawer.tsx`'s **"Approve Return" / "Reject"** buttons had **no `onClick`** — pure dead UI, even though
the backend has `POST /api/sales/returns/{id}/approve` + `/reject`. `returns.api.ts` had no `approve`/`reject`
methods and `use-returns.ts` had no hooks. **Fixed:** added `returnsApi.approve/reject(id, by)`,
`useApproveReturn`/`useRejectReturn` (invalidate list + summary, toast), and wired both buttons (pass the
approver name from `useAuthStore(s => s.user?.name)`, loading spinners, close on success, `<Can>`-gated).
- Other decorative footer buttons with no handler and **no matching backend endpoint** — quotation "Send to
  Customer" / "Re-issue" / "Duplicate", return "Process Refund" — left as-is (no backend to call; same call as
  the recruitment placeholder). Flagged, not wired.
- `hooks/sales/*`: all other mutation hooks already have `onError` + success toasts. No `window.confirm`/`alert`
  anywhere in Sales views (drawers already use state-based `confirmDelete`).

### Tech debt (flagged, NOT migrated — would need user sign-off)
`CustomersController`, `SalesOrdersController`, `SalesQuotationsController`, `SalesReturnsController` inject
`SalesDbContext` and define DTOs inline — violating the mandatory CQRS rule. Authorization was added without
compounding the debt (attributes are independent of the controller internals). Migrating these 4 to
`ISender` + `SalesControllerBase` + `Application/Commands|Queries|Dtos` is a separate, larger refactor
(one feature at a time, per the architecture rule) — left for a dedicated pass. Minor pre-existing note:
`SalesReturns.GetById` (and the other GetByIds) don't filter soft-deleted rows — low-impact, not fixed here.

### Build / Verification Status
- **Sales.API + full ApiGateway:** 0 errors ✅ · **Frontend `tsc --noEmit`:** 0 errors ✅
- **Pending:** republish + restart, then live spot-check (grant only `sales.orders.view` → orders list 200,
  order create/status/delete 403, quotations/returns 403, customer dropdown still loads).

---

## Module 5p — Purchase: Full Module Audit & Authorization Hardening

**Sixth module of the audit program** (after Finance 5i, HR 5j, Inventory 5k, CRM 5m/5n, Sales 5o). Same profile
as Sales: `[Authorize]` with zero per-permission enforcement, and mixed CQRS/tech-debt — `GoodsReceiptNotes` +
`PurchaseReturns` are clean CQRS (Modules 5b/5c), while `Vendors`, `PurchaseOrders`, `Approvals` inject
`PurchaseDbContext` directly (tech debt).

### Security / Authorization
- **`Softaxis.Purchase.API/Authorization/RequirePermissionAttribute.cs`** (copy of the shared pattern; explicit
  `using Microsoft.AspNetCore.Http;`).
- `[RequirePermission("purchase.<key>.<action>")]` on **all 5 controllers** → seeded `purchase.*` keys
  (`purchase.vendors`, `purchase.orders`, `purchase.approvals`):
  - `VendorsController` → `purchase.vendors.*` (view/create/edit/delete). **Vendor GET reads ARE gated** on
    `purchase.vendors.view` — unlike Sales customers (which had no key and were left open), vendors is a
    first-class resource with its own permission group + list page, so gating reads is the intended RBAC.
    Roles that create POs should also include `purchase.vendors.view` for the PO-form vendor dropdown.
  - `PurchaseOrdersController` → `purchase.orders.*` (**no `purchase.orders.delete` key** → delete + status
    gate on `purchase.orders.edit`).
  - `ApprovalsController` → `purchase.approvals.*` (view for reads; Approve/Reject → `purchase.approvals.approve`;
    **Create** — submitting a requisition, no `approvals.create` key — → `purchase.orders.create`, commented).
  - `GoodsReceiptNotesController` → `purchase.orders.*` (receiving drives PO status; GETs → orders.view, Create
    → orders.edit) and `PurchaseReturnsController` → `purchase.orders.*` (post-PO operation; GETs → orders.view,
    Create → orders.edit). No dedicated keys — nearest-key rule, commented (mirrors Sales delivery challans).
- **Frontend `<Can>` gating**: Add Vendor (`purchase.vendors.create`), New PO (`purchase.orders.create`), the
  PO-row Send/Receive/Return actions (`purchase.orders.edit`), and the approval Approve/Reject (below).

### Functional / dead-UI bug found & fixed — Approval Approve/Reject was never wired
The entire Purchase-approvals **mutation frontend was unbuilt**: `approvals.api.ts` had only get/summary/getById,
`use-approvals.ts` only the two queries, and the `approval-drawer.tsx` **Approve / Reject** buttons had **no
`onClick`** — despite the backend having `POST /approvals/{id}/approve` + `/reject`. **Fixed:** added
`approvalsApi.approve(id, by)` / `reject(id, by, reason)`, `useApproveApproval` / `useRejectApproval` hooks
(invalidate list + summary, toast), and wired the drawer — Approve fires directly; **Reject** opens an inline
reason `<Input>` + "Confirm Reject" (state-based, matches the project pattern), both `<Can
permission="purchase.approvals.approve">`-gated, approver name from `useAuthStore(s => s.user?.name)`.

### Known feature gaps flagged (NOT built — need whole new forms / missing backend, out of audit scope)
- **approvals-view "New Request" button** — no `onClick`; the create-requisition flow was never built (no form,
  no `useCreateApproval`) even though `POST /api/purchase/approvals` exists. Left as-is; spawned as a follow-up
  task. Same for the approval-drawer **"Create PO"** button — no backend convert-to-PO endpoint exists.
- No `window.confirm`/`alert`/`TODO`/`console` anywhere in Purchase views; other mutation hooks already have
  `onError` + toasts.

### Tech debt (flagged, NOT migrated)
`Vendors`, `PurchaseOrders`, `Approvals` controllers inject `PurchaseDbContext` + inline DTOs — same CQRS
migration follow-up noted for Sales (5o). Authorization added without compounding the debt.

### Build / Verification Status
- **Purchase.API + full ApiGateway:** 0 errors ✅ · **Frontend `tsc --noEmit`:** 0 errors ✅
- **Pending:** republish + restart, then live spot-check (grant only `purchase.orders.view` → PO list 200,
  PO create/status 403, vendors list 403, approvals approve 403).

---

## Module 6a — Identity: Per-Tenant Roles (🔴 cross-tenant role leak fix + per-module seeding)

**Critical multi-tenancy fix.** `Role` had **no `TenantId`** and role queries had **no tenant scope**, so
every tenant saw and shared every other tenant's roles (a tenant admin saw other tenants' custom roles in
Settings → Roles). Both `RegisterTrial` and `CreateTenant` also assigned **one shared global "Administrator"**
role to every tenant. This makes roles fully tenant-owned + seeds a per-module role set per tenant.

> Note: CRM/other operational entities ARE correctly tenant-isolated in source (shadow `TenantId` + global
> query filter via `TenantIsolation`, ambient tenant set by `TenantAmbientMiddleware` after `UseAuthentication`).
> Roles were the gap because the Identity `Role` entity opted out of that mechanism. If a tenant user *also*
> sees other tenants' **leads**, that means the **deployed build predates CRM tenant isolation** → republish + restart.

### Backend (Identity)
- `Domain/Entities/Role.cs` — added `Guid? TenantId` (null = legacy/global, hidden from all tenant lists;
  non-null = tenant-owned) + `SetTenant(...)`; `Create(..., Guid? tenantId = null)`.
- `IRoleRepository` / `RoleRepository` — `GetPagedAsync(..., Guid? tenantScope)` filters `TenantId == scope`;
  `GetByNameAsync(name, Guid? tenantId)` + `NameExistsAsync(..., Guid? tenantScope)` are tenant-aware.
- **All 5 role handlers** now inject `ICurrentUser` + `ITenantContext` and compute
  `tenantScope = IsSuperAdmin ? null : TenantId`:
  - `GetRoles` scopes the list; `GetRoleById`/`UpdateRole`/`DeleteRole`/`UpdateRolePermissions` return
    `NotFound` if `role.TenantId != tenantScope` (no cross-tenant read/write; NotFound not Forbidden to avoid
    leaking existence). `CreateRole` stamps `TenantId` from the caller's tenant; name-uniqueness is per-tenant.
- **`ITenantRoleProvisioner` / `TenantRoleProvisioner`** (NEW) — creates a tenant's **Administrator** (all
  permissions, `IsSystem=true`) + **one "{Module} Manager" role per enabled module** (CRM/Sales/Purchase/
  Finance/HR/Inventory/POS/Project/B2B/Education/Healthcare/Insurance — from `tenant.ResolvedModules`; Settings
  excluded, admin-only). Adds roles to the current UoW, returns the Administrator. **POS-enabled tenants also
  get operational tiers Cashier + Supervisor** (per-tenant copies of what `SeedPOSRolesAsync` used to seed
  globally/shared; the global POS roles remain but are now hidden from tenant lists by the tenant scoping).
- `RegisterTrial` + `CreateTenant` — replaced the shared `GetByNameAsync("Administrator")` with
  `roleProvisioner.ProvisionAsync(tenant.Id, tenant.ResolvedModules)` and assign the returned Administrator.
- **`BackfillTenantRolesAsync`** (startup, idempotent, **non-destructive**) — for each existing tenant: ensure
  it owns an Administrator + module Managers; **re-point** users still holding the legacy global Administrator
  onto their tenant's own Administrator (`AssignRole` new, then `RemoveRole` global). Never removes access (both
  admins carry the full permission set) and **never deletes** legacy roles — once queries are tenant-scoped they
  just stop appearing in any tenant's list. Runs after `SyncAdministratorPermissionsAsync` in `MigrateAndSeedAsync`.
- Migration `AddRoleTenantId` (adds `roles.TenantId`, nullable).

### ⚠️ Deploy (critical — auth-sensitive)
- Requires **republish + restart** (`Deploy/server/publish.bat` → elevated `Start-Service VroduxERP`). The
  `AddRoleTenantId` migration + the backfill auto-run on startup via `MigrateAndSeedAsync`.
- **Back up `SoftaxisErpDb` before the restart** — the backfill re-points user↔role assignments and stamps
  role tenancy. It's designed to preserve all access, but this is auth data.
- Not runtime-tested by the author (no deployable env). Verify on a backup/staging first: each tenant admin
  logs in → Settings → Roles shows ONLY their own Administrator + per-module Managers; no other tenant's roles;
  existing admins retain full access.

### Build Status
- **Identity.API + full ApiGateway:** 0 errors ✅ · migration created.

---

## Module 6b — Tenant Isolation Sweep (raw-SQL cross-tenant leak audit — all modules)

**Goal: 100% no cross-tenant data mixing on every page/form of every module.** Systematic audit of the whole
backend for tenant-isolation gaps.

### Baseline (already correct)
- **All 13 business-service DbContexts** (CRM, Sales, Purchase, Finance, HR, Inventory, POS, ProjectManagement,
  RealEstate, Recipe, Restaurant, Hospitality, Construction) call `TenantIsolation.ApplyTenantId(...)` — a shadow
  `TenantId` column + **global query filter** (`BypassFilter || TenantId == ambient`), with the ambient tenant
  set per request by `TenantAmbientMiddleware` (after `UseAuthentication`) and stamped on insert. So **every
  normal EF/LINQ query across every module is already tenant-scoped** (controllers that inject `DbContext`
  directly still hit the filtered DbSets).
- **Identity** is the exception by design: users are explicitly tenant-scoped in handlers; roles were the one
  real leak — fixed in Module 6a.

### Gaps found & fixed — RAW SQL only (bypasses EF's global filter)
Grep confirmed the *only* request-path bypasses were raw SQL (`SqlQuery`/`ExecuteSql*`) and cross-schema reads;
`IgnoreQueryFilters()` appears only in startup seed/backfill, never in request handlers. Fixed each by
replicating the EF filter inline — `AND ({bypass} = 1 OR TenantId = {tenant})` where
`bypass = TenantAmbient.BypassFilter ? 1 : 0` and `tenant = TenantAmbient.TenantId ?? Guid.Empty` (matches the
global filter exactly: super-admin/unresolved → all rows; otherwise this tenant only; NULL-tenant rows excluded):
- **`Inventory/.../Services/ProductReadService.cs`** — the product list + GetById + GetByBarcode UNION both
  `[pos].[products]` and `[inventory].[products]` and previously filtered only `IsDeleted = 0`. Added the tenant
  clause to **all 6** product SELECTs (this was a real leak — the Inventory product grid showed every tenant's
  products).
- **`Inventory/.../Repositories/StockMovementRepository.cs`** — `AdjustPosProductStockAsync` (cross-schema
  `UPDATE [pos].[products] … WHERE Id=@id`) got a tenant guard so a guessed id can't touch another tenant's row.
- **`POS/.../Services/CrossSchemaProductService.cs`** — `GetByIdForSaleAsync` (pos+inventory product lookup) now
  tenant-filtered; the `@wh` default-warehouse subquery in `DeductStockAsync`/`RestoreStockAsync`
  (`SELECT TOP 1 … FROM [inventory].[warehouses]`) was picking **any** tenant's warehouse — now scoped.
- **`Restaurant/.../Controllers/OrdersController.cs`** — raw INSERT/UPDATE in `RecordPayment` audited and left
  as-is: the order is first loaded via the tenant-filtered `db.Orders` (`FirstOrDefaultAsync(x => x.Id == id)`),
  so the subsequent writes act on an already-validated tenant-owned id. Not a leak.

### Notes
- Frontend needs no isolation changes — it only calls tenant-scoped APIs; scoping is enforced server-side.
- Raw-SQL string edits can't be compile-checked for SQL correctness — **verify the Inventory product list + POS
  sale flow on a backup/staging after republish + restart** (needs the on-prem redeploy like the other pending modules).

### Build Status
- **Inventory.API + POS.API + full ApiGateway:** 0 errors ✅

---

## Module 6 — Export (CSV + PDF) — All Views

### Files Touched
- `FrontendVite/src/lib/csv.ts` — existing utility (not modified)
- `FrontendVite/src/lib/pdf.ts` — **NEW** browser-native PDF generator
- `FrontendVite/src/components/ui/export-menu.tsx` — **NEW** `<ExportMenu>` dropdown component
- All 12 view files below — Export buttons wired + `<ExportMenu>` added

### Problem
All 12 "Export" buttons across the entire app had no `onClick` handlers — completely dead UI. No PDF export existed at all.

### Solution

**`src/lib/pdf.ts`** — Zero-dependency browser PDF:
```ts
exportPdf({
  title: "Employees Report",
  subtitle: "47 employees",
  columns: ["Name", "Department", "Salary"],
  rows: employees.map(e => [e.fullName, e.department, e.basicSalary]),
  landscape: true,   // optional
})
```
- Builds fully branded HTML (slate-900 header, VroduxERP logo, alternating table rows, footer)
- Opens `window.open("", "_blank")`, writes HTML, calls `window.print()` after 400ms
- Popup-blocked fallback: Blob URL opened via `<a>` click

**`src/components/ui/export-menu.tsx`** — Radix `DropdownMenu`:
```tsx
<ExportMenu onCsv={exportCsv} onPdf={exportPdfReport} />
// Renders a dropdown with CSV (FileSpreadsheet, green) and PDF (FileText, red) options
```

### Views Updated (12 total)
| Module | View |
|--------|------|
| HR | `employees-view.tsx`, `leaves-view.tsx`, `performance-view.tsx`, `recruitment-view.tsx`, `attendance-view.tsx` |
| Finance | `invoicing-view.tsx`, `expenses-view.tsx`, `budgeting-view.tsx`, `accounting-view.tsx` |
| CRM | `leads-view.tsx`, `customers-view.tsx`, `pipeline-view.tsx` |

Each view has:
```ts
const exportCsv = () => {
  const csv = toCsv(data.map(row => ({ "Column": row.field, ... })), ["Column", ...]);
  downloadFile(`report_name_${new Date().toISOString().split("T")[0]}.csv`, csv);
};

const exportPdfReport = () => exportPdf({
  title: "Report Title",
  subtitle: `${data.length} records`,
  columns: ["Col1", "Col2", ...],
  rows: data.map(r => [r.field1, r.field2, ...]),
});
```

---

## Architectural Patterns & Gotchas

### NEVER hardcode dates
Always use dynamic constants — hardcoded dates break after they pass:
```ts
// ✅ Always dynamic
const TODAY = new Date().toISOString().split("T")[0]; // "2026-06-09"
const CURRENT_MONTH = new Date().toISOString().slice(0, 7); // "2026-06"

// ❌ Will break
const TODAY = "2026-05-19"; // hardcoded
```

### `formatDate()` — null-safe (utils.ts)
```ts
// Accepts: string | Date | null | undefined
// Returns "—" for: null, undefined, "", Invalid Date
formatDate(emp.joinDate)         // safe even if undefined
formatDate(run.processedAt)      // safe even if null
```

### `<select>` in dark mode — use `bg-card` not `bg-transparent`
```tsx
// ❌ bg-transparent causes browser to render OS-native white dropdown popup in dark mode
<select className="bg-transparent ...">

// ✅ bg-card inherits the theme's card background color
<select className="bg-card ...">
```

### AnimatePresence Must Wrap in Parent
```tsx
// ❌ WRONG — exit animation never fires
function MyComponent({ open }) {
  return (
    <AnimatePresence>
      {open && <motion.div exit={{ opacity: 0 }}>...</motion.div>}
    </AnimatePresence>
  );
}

// ✅ CORRECT — AnimatePresence in the parent
function Parent() {
  return (
    <AnimatePresence>
      {open && <MyComponent />}
    </AnimatePresence>
  );
}
```

### Tailwind `peer-checked:*` — CSS Siblings Only
```tsx
// ❌ peer-checked:* only applies to CSS siblings, NOT descendants
<input type="checkbox" className="peer sr-only"/>
<div className="peer-checked:bg-blue-500">
  <Check className="peer-checked:block" />  {/* NEVER works — descendant */}
</div>

// ✅ Use JS state for descendant styling
const checked = watch("agree");
<div style={{ background: checked ? "#3b82f6" : "transparent" }}>
  {checked && <Check />}
</div>
```

### Inline `style={}` vs Tailwind Class Specificity
`style={{ borderColor: "..." }}` always wins over `peer-checked:border-blue-500`. If you use inline style for one property, use it for all variants of that property.

### `setState` Callback for Stale Closure Fix
```ts
// ❌ stale: `selectedModules` captured from render
const toggleModule = (id) => {
  const n = new Set(selectedModules); // stale!
};

// ✅ fresh: all logic runs against current state
const toggleModule = useCallback((id) => {
  setSelectedModules(prev => {
    const n = new Set(prev); // always fresh
    if (!needsBusinessType(n)) setBusinessType(null);
    return n;
  });
}, []);
```

### `Math.max(1, s)` Guard for Nullable Array Sentinels
```ts
const c = [null, { b: "#red", l: "Weak" }, { b: "#orange", l: "Fair" }, ...];
const ci = c[Math.max(1, s)]!; // s=0 → c[1] instead of c[0]=null crash
```

### Response Mapping at API Boundary
When backend field names differ from frontend DTO, normalise at the API call — not in components:
```ts
// hr.api.ts
getEmployees: () =>
  rawApiClient.get(`${BASE}/employees/all`)
    .then((r: any) => (Array.isArray(r) ? r : r.items ?? []).map(mapEmployee)),

function mapEmployee(raw: any): EmployeeDto {
  return {
    employeeId:  raw.employeeNumber ?? raw.employeeId ?? "",
    department:  raw.departmentName ?? raw.department ?? "",
    designation: raw.jobTitle ?? raw.designation ?? "",
    joinDate:    raw.joiningDate ?? raw.joinDate ?? undefined, // undefined, NOT ""
    contractType: contractTypeMap[raw.employmentType] ?? "full_time",
    ...
  };
}
```

**Critical:** Date fields from backend must map to `undefined` (not `""`) when missing, or `formatDate("")` will receive an empty string and `new Date("")` = Invalid Date → `RangeError`.

### Mutation hooks — Always add onError + onSuccess
```ts
// ✅ Every mutation hook must have both
useMutation({
  mutationFn: ...,
  onSuccess: () => {
    qc.invalidateQueries({ queryKey: [...] });
    toast.success("Done.");
  },
  onError: (err: Error) => toast.error(err.message),
});
```

### Never use `window.confirm()` — always use React state modal
```tsx
// ❌ Browser native dialog — inconsistent with project design
if (!window.confirm("Are you sure?")) return;
deleteThing.mutate(id);

// ✅ React state modal
const [pendingDelete, setPendingDelete] = React.useState<ItemDto | null>(null);
const handleDelete = (item: ItemDto) => setPendingDelete(item);
// In JSX: render confirmation modal when pendingDelete !== null
```

### `mutateAsync()` must always be wrapped in try/catch
```ts
// ❌ Unhandled rejection propagates as runtime error
await create.mutateAsync({...});
onClose();

// ✅ Hook's onError already shows toast; just catch silently
try {
  await create.mutateAsync({...});
  onClose();
} catch {
  // onError in hook shows the toast; dialog stays open for retry
}
```

### Dynamic period selectors — never static lists
```ts
// ✅ Always generate dynamically
function buildPeriodOptions() {
  const opts = [];
  const now = new Date();
  for (let i = -1; i <= 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    opts.push({
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleString("en-AE", { month: "long", year: "numeric" }),
    });
  }
  return opts;
}

// ❌ Hardcoded — breaks after a few months
const periods = ["May 2026", "April 2026", "March 2026"];
```

---

## EmployeeDto Shape (key fields)

```ts
interface EmployeeDto {
  id: string;
  employeeId: string;       // maps from backend employeeNumber
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  department: string;       // maps from backend departmentName
  designation: string;      // maps from backend jobTitle
  contractType: ContractType;
  status: EmployeeStatus;   // "active" | "inactive" | "terminated" | ...
  joinDate?: string;        // undefined if missing — NOT ""
  dateOfBirth?: string;     // undefined if missing — NOT ""
  basicSalary: number;
  currency: string;
  iban?: string;
  bankAccount?: string;
}
```

---

## Module 7 — CRM: Integration Platform (lead sources / provider framework)

**New tenant-isolated Integration Framework inside `Softaxis.CRM.*` (schema `crm`)** — connects
external lead sources and funnels every lead through ONE pipeline into the CRM. Built as a
plug-in provider model so new sources are one class + one DI line, **zero CRM/pipeline changes**.
Full design + dev guide: `docs/integration-platform.md`. Lives in CRM because the canonical
`Lead` + dedupe/routing run in the same `CrmDbContext` transaction (modular monolith, no broker).

### Backend (CRM service)
- **Domain** `Softaxis.CRM.Domain/Entities/Integrations/`: `Integration` (status/health, encrypted
  `Credentials`/`SigningSecret`, `InboundKey`, dedupe/routing JSON, telemetry), `FieldMapping`,
  `IntegrationResource` (page/form/sheet, encrypted per-resource `AccessToken`), `IntegrationSyncLog`,
  `RawLeadInbox` (durable inbox + retry/backoff + error log), `LeadSource` (1:1 provenance — keeps
  core `Lead` untouched). All auto tenant-isolated via the CRM namespace filter.
- **Provider model** (`Application/LeadIntake/Abstractions`): `ILeadProvider` + capability interfaces
  `IOAuthLeadProvider` / `IWebhookLeadProvider` / `IAsyncLeadProvider` (payload references a lead to
  fetch — Meta) / `IPollSyncLeadProvider`; `ILeadProviderRegistry` (DI-discovered, Factory).
- **Pipeline** `ILeadIntakeService` (`Infrastructure/Integrations/LeadIntakeService.cs`): field mapping
  → configurable dedupe (email/phone/externalId) → `Lead` create → routing (fixed/round_robin/
  unassigned) → `LeadSource` → publishes `LeadIngestedNotification` (automations = `INotificationHandler`).
  Tenant-explicit (stamps `TenantId`) so it's safe from anonymous webhook contexts.
- **Inbound** anonymous `WebhooksController` `/api/webhooks/{inboundKey}` (GET handshake, POST ingest
  JSON/form, `snippet.js`) → stores to inbox, acks immediately. `RawLeadInboxProcessor` (BackgroundService)
  drains per-tenant with backoff (max 5).
- **Providers**: `GenericInboundProvider` registered as 5 cards (webhook/zapier/make/website/custom-api);
  `MetaLeadProvider` + `MetaGraphClient` (OAuth, page/form select, `hub.challenge` + `X-Hub-Signature-256`
  verify, Graph lead fetch, poll); `StubLeadProvider` for 11 "coming soon" cards (google-ads/forms/sheets,
  linkedin, tiktok, whatsapp, microsoft-forms, calendly, jotform, typeform, csv).
- **Security**: `ISecretProtector` over ASP.NET Core Data Protection (no new dep); gateway
  `AddDataProtection().PersistKeysToFileSystem(App_Data/dp-keys).SetApplicationName("Softaxis.ERP")`.
  **All OAuth tokens / API keys / page tokens / HMAC secrets encrypted at rest.**
- **Endpoints**: `IntegrationsController` (`/api/crm/integrations/*`, `settings.integrations.*` gated via a
  new CRM `[RequirePermission]` mirroring ProjectManagement), `InternalLeadsController`
  (`POST /api/internal/leads`), `MetaIntegrationController` (OAuth start/callback/pages/forms/select).
- **Config**: `Meta` + `Integrations` sections (appsettings + `.env.example`); App ID/secret config-driven.
- **Migration**: `AddLeadIntegrations` (6 tables, each with shadow `TenantId`).

### Frontend
- `lib/crm/integrations.api.ts` + `hooks/crm/use-integrations.ts` (React Query, toasts, invalidation).
- `modules/settings/integrations/components/integrations-view.tsx` — **full rewrite** from static mock
  to live catalog: provider cards (logo/status/health/last-sync), search + category filters, connect
  flows (inbound → configure drawer; OAuth → consent redirect → Meta page/form picker), configure
  drawer tabs (Overview / Inbound URL+secret+snippet+rotate / Field Mapping / Duplicates / Routing /
  Sync History / Error Log), disconnect/remove. Gated by `hasRawPermission("settings.integrations.edit")`.

### Gotchas confirmed
- `CrmDbContext` does **not** dispatch domain events (extends `DbContext`, not `BaseDbContext`) → intake
  publishes `LeadIngestedNotification` via `IMediator` explicitly.
- `TenantIsolation.ApplyTenantId` runs last in `OnModelCreating` and **overwrites** any entity
  `HasQueryFilter(!IsDeleted)` (EF9) → handlers filter `!IsDeleted` manually (existing CRM pattern).
- Anonymous endpoints (webhooks, OAuth callback) have an **unresolved ambient tenant** → resolve tenant
  from the inbound key / signed OAuth state and **stamp `TenantId` explicitly** (Careers pattern).
- Meta webhooks deliver only a `leadgen_id` → `IAsyncLeadProvider.NormalizeAsync` fetches the lead from
  Graph; the inbox processor prefers `NormalizeAsync` and loads `Resources` for page tokens.

### Build Status
- **Backend gateway (all services):** 0 errors ✅ (only the pre-existing Smtp nullable warning)
- **Frontend:** `tsc --noEmit` 0 errors ✅
- **Pending**: apply `AddLeadIntegrations` on next gateway startup (auto via `MigrateAndSeedCrmAsync`);
  set real `Meta:AppId`/`AppSecret` + a public HTTPS `Integrations:PublicBaseUrl` for a live Meta test.

---

## Build Status
- **TypeScript (frontend):** 0 errors ✅
- **Backend Finance service:** 0 errors ✅
- **Backend HR service:** 0 errors ✅ (2 migrations applied)
- **Backend Identity service:** 0 errors ✅
- **Backend Inventory service:** 0 errors ✅
