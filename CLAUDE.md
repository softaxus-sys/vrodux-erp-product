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

## Module 6c — Tenant Isolation: full re-verification + raw-SQL INSERT stamping

**Second full-codebase isolation sweep (after 6a/6b), triggered by "make 100% sure no module sees other
tenant data."** Re-verified the whole surface and fixed the remaining raw-SQL write gaps.

### Verified clean (no changes needed)
- **All 13 business DbContexts** call `TenantIsolation.ApplyTenantId` (shadow `TenantId` + global filter).
- **`IgnoreQueryFilters()`** appears ONLY in startup seed/backfill code — never in request handlers.
- **Raw-SQL reads** (Inventory `ProductReadService`, POS `CrossSchemaProductService.GetByIdForSaleAsync`,
  POS `StockMovementRepository`) all carry the 6b tenant clause `({bypass} = 1 OR TenantId = {tenant})`.
- **Anonymous endpoints** are all tenant-explicit: Careers handlers filter
  `EF.Property<Guid?>(x, TenantIsolation.Column) == tenant.Id` (resolved from slug) and `ApplyToJobHandler`
  stamps the applicant row; CRM `IngestWebhookHandler`/`IngestMetaWebhookHandler`/`MetaOAuthCallbackHandler`
  copy `TenantId` from the integration row; `RawLeadInboxProcessor` sets `TenantAmbient.Set(tenantId, ...)`.
- **`TenantAmbientMiddleware`** fails closed: authenticated user with no `tenant_id` claim → resolved but
  NULL tenant → filter `TenantId == NULL` matches nothing.
- **Identity**: users tenant-scoped via `tenantScope` in handlers; roles fixed in 6a.

### Gaps found & fixed — raw-SQL INSERTs bypass `StampTenantId` → rows landed `TenantId = NULL`
NULL-tenant rows are NOT a cross-tenant leak (no other tenant's filter matches them) but they are hidden
from **their own tenant** too (filter is `TenantId == ambient`; `NULL == guid` is false):
- **`POS/.../CrossSchemaProductService.cs`** — `DeductStockAsync`/`RestoreStockAsync` INSERTs into
  `[pos].[stock_movements]`, `[inventory].[stock_movements]`, `[inventory].[product_stock]` now include a
  `TenantId` column stamped with `TenantAmbient.TenantId` (`Guid? stamp` — mirrors `StampTenantId` exactly).
  The `UPDATE [pos|inventory].[products]` statements also got the `({bypass} = 1 OR TenantId = {tenant})`
  guard (defense-in-depth; ids were already validated via the tenant-guarded lookup).
- **`Restaurant/.../OrdersController.RecordPayment`** — the raw `INSERT INTO [restaurant].[OrderPayments]`
  now stamps `TenantId`. Without it, EF's query filter (which DOES apply to `Include(x => x.Payments)`)
  hid every recorded payment from the tenant — breaking split-tender method labels and payment history.
- **One-time repairs (idempotent, run every startup)** in `MigrateAndSeed{Restaurant,POS,Inventory}Async`:
  `UPDATE ... SET TenantId = parent.TenantId ... WHERE TenantId IS NULL` — OrderPayments from Orders,
  pos/inventory stock_movements + product_stock from their products. Fixes rows created by the old code.
- **CRM demo seed gated out of Production** (`MigrateAndSeedCrmAsync`) — startup seed runs with no ambient
  tenant, so demo leads/customers/deals land `TenantId = NULL`; on any deployed build predating CRM tenant
  isolation they leaked into every tenant. Same env gate as the POS demo seed.
- **`.gitignore`** — added `App_Data/` (the gateway's Data Protection key ring `App_Data/dp-keys/` encrypts
  stored OAuth tokens/secrets and must never be committed).

### Build Status
- **Full ApiGateway (all services):** 0 errors ✅ (only the pre-existing NU1903 OpenApi advisory warnings)
- **Pending:** republish + restart the on-prem service; the startup repairs then run automatically.
  Spot-check afterwards: two tenants' POS sale → each tenant sees only its own stock movements; Restaurant
  split payment shows all payment rows.

---

## Module 6d — Identity: Duplicate role cleanup + super-admin role scoping + "Linked to" module chips

**Fixes the "I'm seeing duplicate roles" report.** Two independent causes, both fixed; plus a small UX
addition so each role shows which module(s) it belongs to.

### Root cause (confirmed against the live `SoftaxisErpDb`)
- `RoleRepository.GetPagedAsync` treated a **null tenant scope (super-admin) as "all roles"**, so a
  super-admin saw every tenant's roles pooled together — same-named roles (`Administrator ×5`, `CRM
  Manager ×4`, `Cashier ×2`, …) looked like duplicates. A **tenant** admin was already fine (only its own
  tenant's roles, each distinct).
- Legacy **GLOBAL roles** (`TenantId = NULL`) — `Cashier`, `Supervisor`, `Store Manager`, `Inventory
  Manager`, `POS Admin`, plus stray test globals (`Project Manager`, `PM Viewer Only`) — seeded by the old
  dev-only `SeedPOSRolesAsync`. They duplicate the per-tenant roles that `TenantRoleProvisioner` (Module 6a)
  now creates.

### Fixes (Identity service)
- **`RoleRepository`** — super-admin (null scope) now sees **only global template roles** (`TenantId ==
  NULL`), never other tenants' private roles. `GetPagedAsync`/`GetByNameAsync`/`NameExistsAsync` split on
  `tenantScope.HasValue` so the null case emits `TenantId IS NULL` (not `= @param`, which never matches NULL
  — the EF null-parameter pitfall).
- **`InfrastructureExtensions.MigrateAndSeedAsync`**:
  - Removed the `SeedPOSRolesAsync` call **and the method** — global operational roles + demo users are no
    longer seeded in ANY environment (they were already skipped in Production; now dev matches). Operational
    roles come only from the per-tenant provisioner → **distinct seed data in every env**.
  - New **`RemoveRedundantGlobalRolesAsync`** (idempotent, all envs, runs after `BackfillTenantRolesAsync`):
    deletes every global role except the single bootstrap `Administrator`; first re-points any assigned user
    onto their tenant's same-named role (`tenantRoles` lookup keyed by `(TenantId, Name)`), then deletes the
    global role (role_permissions / user_roles cascade). Verified impact on live data: re-points `pmuser`
    onto tenant "Project Manager"; dev demo users (cashier/posadmin/…) and the `pmviewer` test role just lose
    the stale global assignment.
  - **`SeedSuperAdminAsync`** admin-role lookup scoped to `TenantId == null` — per-tenant `Administrator`
    roles now exist, so the super-admin must never be bootstrapped onto a specific tenant's role.
- **Kept:** the single global `Administrator` (bootstrap for `admin@softaxis.io` / `superadmin`).

### Frontend — "Linked to" module chips (Settings → Roles & Permissions)
- `lib/identity/permission-matrix.ts` — new `moduleGroupLabel(prefix)` + shared `UBIQUITOUS_MODULES` set.
- `roles-permissions-view.tsx` — new `ModuleChips` component driven by the existing `RoleSummaryDto.modules`
  (module prefixes a role grants perms in; computed in `GetRolesQueryHandler`). Shown per role in the list
  and as a "Linked to:" line in the detail header. Cross-cutting modules (settings/reports/…) are dropped;
  a full-access role collapses to one **All modules** chip; overflow shows `+N`. Maps cleanly onto the
  provisioned set (CRM Manager → CRM, Cashier → POS, Administrator → All modules).

### Deploy note (auth-sensitive — same as Module 6a)
Requires **republish + restart**; the cleanup then runs automatically via `MigrateAndSeedAsync`. **Back up
`SoftaxisErpDb` first** — it deletes roles and re-points user↔role assignments. Not run against the live DB
by the author; the read-only impact preview above was verified.

### Build Status
- **Identity.API:** 0 errors ✅ · **Frontend `tsc --noEmit`:** 0 errors ✅

---

## Module 6e — Currency Management (USD base, live rates, browser-default company currency)

**Made currency work end-to-end.** Currency was collected at onboarding but **dropped** (RegisterTrial
ignored it; `Tenant` had no currency column; no JWT claim; frontend `useCurrency()` returned a hardcoded
`"PKR"`). Also `Currency`/`ExchangeRate` were accidentally tenant-scoped (the tenant filter overwrote their
`!IsDeleted` filter → seeded rows landed `TenantId = NULL` and were invisible to tenants).

### Model
- **USD is the base currency** (rate 1.0). `ExchangeRate.Rate` = units of USD per 1 unit of the code
  (base-per-unit); `ConvertCurrencyHandler` cross-rates via base. Company operating/display currency =
  browser-detected at signup.
- **Currency + ExchangeRate are now GLOBAL** (shared market reference data), not tenant-scoped.

### Backend
- `BuildingBlocks/.../TenantIsolation.cs` — new namespace overload `ApplyTenantId(mb, prefix, exclude, col)`;
  `FinanceDbContext` excludes `[Currency, ExchangeRate]`. Migration `MakeCurrencyRatesGlobal` drops their
  `TenantId` column+index. `CurrencyConfiguration` keeps its own (non-tenant) mapping.
- `FinanceSeedData` — USD `IsBaseCurrency=true` (AED false), added PKR/INR; idempotent raw-SQL repair flips
  existing DBs' base to USD and soft-deletes the old AED-based seed rates; reseeds USD-based fallback rates
  (date `2000-01-01` so any live refresh supersedes).
- **Online provider** (`Softaxis.Finance`): `IExchangeRateProvider` + `ErApiExchangeRateProvider`
  (open.er-api.com `/latest/USD`, free/no-key, fail-soft), `ExchangeRateUpserter` (stores `1/unitsPerUsd`),
  `ExchangeRateRefreshService : BackgroundService` (startup + every 24h), config section `ExchangeRates`
  (Provider/BaseUrl/ApiKey/Enabled) in appsettings, `AddHttpClient("exchange-rates")` +
  `Microsoft.Extensions.Http` package. `POST /api/finance/exchange-rates/refresh`
  (`finance.accounting.edit`) → `RefreshExchangeRatesCommand`/Handler.
- **Persist tenant currency**: `Tenant.Currency` + `SetCurrency(code|label)` (normalises "USD - US Dollar" →
  "USD"), migration `AddTenantCurrency`; set in `RegisterTrialCommandHandler` + `CreateTenantCommandHandler`;
  new `currency` **JWT claim**; `TenantDto.Currency` + `TenantMappings`. Self-service
  `PUT /api/tenant-settings/currency` (`TenantSettingsController` → `UpdateTenantCurrencyCommand`, tenant from
  JWT). Added `IdentityDbContextFactory` (design-time; Identity was the only service without one).

### Frontend
- `store/auth.store.ts` — `buildTenantFromClaims` reads the `currency` claim (USD default) instead of hardcoded
  PKR; `DEFAULT_TENANT` → USD.
- `pages/trial/onboarding.tsx` — submits the 3-letter code; `detectCountry()` (Module: browser detection) already
  pre-selects country→currency.
- `lib/finance/exchange-rates.api.ts` + `lib/finance/convert.ts` (`buildRateMap`/`convert`) +
  `hooks/finance/use-exchange-rates.ts` (`useExchangeRates`, `useRefreshRates`, `useUpdateTenantCurrency`
  [patches auth store live], `useCurrencyConverter`).
- `lib/identity/tenant-settings.api.ts` + Settings page `modules/settings/currency/.../currency-settings-view.tsx`
  (operating-currency selector, live rates table, "Refresh now", converter preview) + route `/settings/currency`
  + nav item "Currency & Rates" (icon `Coins`).

### Scope boundary
Conversion is delivered as the shared converter/hook + the settings preview; recorded amounts are never mutated
(the operating currency already drives `formatCurrency` app-wide). Re-wiring every screen to live-convert
cross-currency is a follow-up.

### Build / Verification Status
- **Finance.API + Identity.API:** 0 errors ✅ · **Frontend `tsc --noEmit`:** 0 errors ✅ · migrations
  `AddTenantCurrency` + `MakeCurrencyRatesGlobal` created & reviewed.
- **Pending (needs gateway rebuild+restart):** live checks — `GET /exchange-rates` (USD base=1), `POST /refresh`,
  `GET /convert?from=USD&to=PKR&amount=100`; signup persists browser currency + `currency` claim; Settings →
  Currency switch re-expresses via live rates. Migrations auto-apply on startup via `MigrateAndSeedFinanceAsync`
  / `MigrateAndSeedAsync`.

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

## Module 8 — CRM Redesign (enterprise-grade, competing w/ Salesforce / Dynamics / HubSpot / NetSuite)

**Program to evolve the CRM from a linear funnel into a closed-loop revenue platform.** Agreed redesign =
omnichannel capture → 4-phase closed loop (Capture → Convert → Close → Retain, with an expansion loop back
into Convert) on a cross-cutting platform spine (unified data / automation / intelligence / governance).

**Agreed build order** (do one slice at a time, confirm scope, keep additive/low-risk):
1. Split `Lead` / `Account` / `Contact` / `Opportunity` into proper entities + unified activity timeline (the
   highest-leverage change — current `LeadDto` conflates person/company/deal; `Deal.Company` is free-text).
2. Configurable pipelines (DB-backed `Pipeline`+`Stage`, replace the hardcoded `DealStage` union +
   `PIPELINE_STAGES` const) + forecast categories + quota. ← **8a below delivered the forecast-category half.**
3. Generalize Module 7's `LeadIngestedNotification`/`INotificationHandler` into a trigger/action workflow engine
   (+ sequences/cadences).
4. Lead scoring + grading rules engine (make `Lead.Score` computed, not free-form).
5. Renewals + account health score + cases/tickets → closes the loop into Sales/Finance.
6. AI assist over the unified timeline.

### Module 8a — Sales Forecasting on opportunities (DONE — first slice, purely additive)
Adds Salesforce-style forecasting to `Deal` without renaming anything. Two new columns, everything else derived.

- **Domain** `Softaxis.CRM.Domain/Entities/Deal.cs` — new `ForecastCategory` (`pipeline|best_case|commit|closed|
  omitted`, non-null default `"pipeline"`) + `LossReason` (`string?`). `DeriveForecastCategory(stage, prob)`
  static default (won→closed, lost→omitted, else prob≥80→commit / ≥50→best_case / else pipeline); `Normalize()`
  validates client overrides (unknown → null → auto-derive). Computed `WeightedValue => Value * Probability/100`.
  `MoveStage`/`Update`/ctor take an optional `forecastCategory`; `MoveStage` also takes `lossReason` (only kept
  when stage==lost, cleared otherwise).
- **CQRS** — `CreateDealCommand`/`UpdateDealCommand` gained `string? ForecastCategory = null`;
  `MoveDealStageCommand` gained `ForecastCategory` + `LossReason`. `DealDto` gained `ForecastCategory`,
  `WeightedValue`, `LossReason`. `DealsSummaryDto` gained `OpenValue`, `WeightedValue`, `CommitValue`,
  `BestCaseValue` (rolled up over OPEN deals only in `GetDealsSummaryHandler`). `DealMappings.ToDto` +
  Create/Update/MoveStage handlers pass the new fields. `PipelineController` `UpdateDealRequest`/`StageReq`
  carry the new optional fields.
- **EF** — `DealConfiguration`: `ForecastCategory` `HasMaxLength(20).HasDefaultValue("pipeline")`, `LossReason`
  `HasMaxLength(500)`. Migration `AddDealForecasting` (schema `crm`, `deals` table, 2 additive columns; existing
  rows default to `pipeline`).
- **Frontend** — `lib/crm/crm.api.ts`: `ForecastCategory` type, `FORECAST_META` (label/color/bg per category),
  new `DealDto`/`CrmSummaryDto` fields, `CreateDealRequest.forecastCategory?`, `moveDealStage(id,stage,prob,{
  forecastCategory?, lossReason? })`. `useMoveDealStage` hook signature widened.
  - `pipeline/components/forecast-bar.tsx` (NEW) — Open pipeline / Weighted forecast / Best case / Commit
    roll-up card, rendered under `PipelineStats` in `pipeline-view.tsx`.
  - `deal-card.tsx` — forecast pill + weighted-value subline (open deals). `deal-drawer.tsx` — forecast pill in
    stage header, Forecast + Weighted Value in Deal Details, "Reason lost" banner when lost.
  - `pipeline-board.tsx` — dragging a card into **Lost** opens a loss-reason modal (`LOSS_REASONS` chips +
    free text) before persisting; sends `lossReason`. Normal stage moves let the backend auto-derive forecast.
  - `add-deal-form.tsx` — Forecast Category `<select>` (Auto/Pipeline/Best case/Commit; `bg-card`); "Auto"
    sends `undefined` so the backend derives.

### Build Status
- **CRM.API + Infrastructure:** 0 errors, 0 warnings ✅ · **Frontend `tsc --noEmit`:** 0 errors ✅
- **Pending:** apply `AddDealForecasting` on next gateway startup (auto via `MigrateAndSeedCrmAsync`); republish +
  restart the on-prem service per the deploy note. Then spot-check: forecast bar totals, drag-to-Lost reason
  capture, forecast pill/override on cards + form.

### Module 8b — CRM: Opportunity ↔ Account relational link (redesign slice 1, Phase 1 — DONE)
First phase of the "split Lead/Account/Contact/Opportunity into proper entities" slice. Key finding: the model
was mostly there — `Contact` already FKs to the account (`CustomerId`), `Activity` is already polymorphic
(`RelatedToType` lead/deal/customer + `RelatedToId` — a unified-timeline primitive), and `CrmCustomer` already
IS the Account. The real gap was that the graph was **string-linked, not relational**: `Deal.Company` was free
text with no FK, and `ConvertLead` created a customer + deal that weren't even linked to each other. Phase 1
makes Opportunity↔Account relational — purely additive (nullable FK + denormalized `Company` retained), nothing
breaks. Naming decision: keep `CrmCustomer` as the Account entity, relabel "Account" in UI only (no churny rename).

- **Domain** `Deal.cs` — new `Guid? CustomerId` (null = unlinked/free-text). ctor + `Update(...)` take optional
  `Guid? customerId = null` (added after the existing `forecastCategory` optional param).
- **CQRS** — `CreateDealCommand`/`UpdateDealCommand` gained `Guid? CustomerId = null`; `DealDto` gained
  `Guid? CustomerId`; `GetDealsQuery(Guid? CustomerId = null)` filters by account.
  `CreateDealHandler`/`UpdateDealHandler`: when `CustomerId` set, look up the account (`db.Customers.FindAsync`)
  and copy its `Name` into the denormalized `Company`. `ConvertLeadHandler` now sets
  `customerId: customer.Id` on the deal it creates (previously the convert's customer + deal were unlinked).
- **EF** — `DealConfiguration` `HasIndex(x => x.CustomerId)` (scalar indexed column, no navigation → avoids
  cross-cascade config). Migration `AddDealCustomerLink` (schema `crm`, `deals` table, additive nullable column
  + index).
- **API** — `PipelineController` `GET /api/crm/deals?customerId=` filter; `UpdateDealRequest` carries `CustomerId`.
- **Frontend** — `crm.api.ts`: `DealDto.customerId`, `CreateDealRequest.customerId`,
  `getDeals(customerId?)` → `?customerId=`. `use-crm.ts`: `useDeals(customerId?, enabled=true)`.
  - `add-deal-form.tsx` — replaced the free-text **Company** input with an **Account combobox** (searches
    `useCustomers()`; pick → sets `customerId` + name + "Linked" pill with unlink ✕; typing unlinks and shows
    "New account — won't be linked"). Sends `customerId` on create/update; edit prefills from `editing.customerId`.
  - `customer-drawer.tsx` — Deals tab was **always empty** (backend `CrmCustomerMappings.ToDto` returns
    `Array.Empty<object>()` for deals/contacts/activities). Now wired to `useDeals(customer.id, open)` → shows
    live linked opportunities with stage badge, close date, value, and weighted value (open deals). Removed the
    dead "New Deal" button + unused `ChevronRight` import.
- **Build:** CRM.API 0 errors/0 warnings ✅ · Frontend `tsc --noEmit` 0 errors ✅ · migration `AddDealCustomerLink`
  created (auto-applies via `MigrateAndSeedCrmAsync`).
- **Pending:** republish + restart on-prem to apply the migration, then spot-check: create a deal, pick an
  account → it appears in that account's Deals tab; convert a lead → the new deal is linked to the new account.
- **Next (Phase 2–4):** deal contact roles (`DealContact` join, replaces `Deal.ContactJson`); account-level
  unified timeline (`GET /customers/{id}/timeline` unioning the account's + its deals'/leads' activities);
  Lead→Contact on convert (create a primary `Contact` from the lead's person + `Lead.ConvertedCustomerId`).

### Module 8c — CRM: Opportunity contact roles (redesign slice 1, Phase 2 — DONE)
Replaces the single free-text `Deal.ContactJson` blob with a proper many-to-many `DealContact` join so an
opportunity can carry multiple contacts, each with a buying **role** (decision_maker / champion / influencer /
user / blocker / other). Additive — the `ContactJson` column is left in place (unused), nothing breaks.

- **Domain** `DealContact.cs` (NEW) — `(Id, DealId, ContactId, Role, CreatedAt, UpdatedAt)`, `SetRole(...)`.
  Pure association row → **hard-deleted** on unlink (no `IsDeleted`, so the tenant global filter that would
  overwrite a `!IsDeleted` filter is a non-issue). Follows the codebase's scalar-FK convention (indexed `DealId`
  / `ContactId` Guids, **no** navigation properties / DB FK constraints — same as `Deal.CustomerId`,
  `Contact.CustomerId`). Auto tenant-isolated (entity in `Softaxis.CRM.Domain` → shadow `TenantId` + filter).
- **EF** — `DealContactConfiguration`: table `deal_contacts`, `HasIndex(DealId)` + unique `HasIndex(DealId,
  ContactId)`. `CrmDbContext` `DbSet<DealContact> DealContacts`. Migration `AddDealContacts` (new table +
  shadow `TenantId`).
- **CQRS** `Application/DealContacts/*` — `DealContactDto(Id, ContactId, FullName, Title, Email, Phone,
  Department, IsPrimary, Role)`; `GetDealContactsQuery(DealId)`; `AddDealContactCommand(DealId, ContactId, Role)`
  (+validator), `UpdateDealContactRoleCommand(DealId, Id, Role)`, `RemoveDealContactCommand(DealId, Id)`.
  Handlers in `Infrastructure/Handlers/DealContacts/`:
  - `GetDealContactsHandler` — LINQ join `deal_contacts`⋈`contacts` (contacts' query filter drops soft-deleted),
    orders primary-first; `Contact.FullName` is `Ignore`d/computed so the projection selects
    `FirstName`/`LastName` and builds the name in memory (can't reference a computed prop in an EF projection).
  - `AddDealContactHandler` — validates deal + contact exist; if the deal is account-linked
    (`deal.CustomerId`), rejects a contact from a different account (`DealContact.Conflict` → 409); rejects
    duplicates (`DealContact.Duplicate` → 409).
  - `UpdateDealContactRoleHandler` / `RemoveDealContactHandler` — look up by `(Id, DealId)`, 404 if missing.
- **API** `DealContactsController` route `api/crm/deals/{dealId}/contacts` — `GET` (`crm.pipeline.view`),
  `POST {contactId, role}` / `PUT {id} {role}` / `DELETE {id}` (all `crm.pipeline.edit`).
- **Frontend** — `crm.api.ts`: `DealContactRoleDto`, `DEAL_CONTACT_ROLES` (value/label list), + `getDealContacts`
  / `addDealContact` / `updateDealContactRole` / `removeDealContact`. `use-crm.ts`: `useDealContacts(dealId)` +
  `useAddDealContact` / `useUpdateDealContactRole` / `useRemoveDealContact` (own mutation helper invalidating
  `[QK,"deal-contacts"]`).
  - `deal-drawer.tsx` — Contact tab rewritten from the single JSON contact to a `DealContactsPanel`: lists
    linked contacts (avatar, name, primary star, title, email) each with an inline **role `<select>`
    (`bg-card`)** + unlink button; an "Add" flow picks an unlinked account contact (`useContacts(customerId)`)
    + role. Unlinked deals show a hint to link an account first (contacts are account-scoped). Writes gated by
    `<Can permission="crm.pipeline.edit">` (denied → static role label via `fallback`).
- **Build:** CRM.API 0 errors/0 warnings ✅ · Frontend `tsc --noEmit` 0 errors ✅ · migration `AddDealContacts`
  created (auto-applies via `MigrateAndSeedCrmAsync`).
- **Pending:** republish + restart on-prem to apply the migration; spot-check — link a deal to an account,
  open the deal's Contacts tab, add account contacts with roles, change a role, unlink.

### Module 8d — CRM: Account timeline + Lead→Contact conversion (redesign slice 1, Phases 3 & 4 — DONE)
Completes redesign slice 1. Phase 3 = a rolled-up account activity timeline; Phase 4 = proper SFDC-style lead
conversion (Lead → Account **+ Contact** + Opportunity). Both additive.

**Phase 4 — Lead→Contact on convert**
- `Lead.cs` — new `Guid? ConvertedCustomerId` (mirrors the existing string `ConvertedDealId`);
  `Convert(string dealId, Guid? customerId = null)` sets both. EF `HasIndex(ConvertedCustomerId)`.
  Migration `AddLeadConvertedCustomer` (additive nullable column + index).
- `ConvertLeadHandler` — now also creates the account's **primary `Contact`** from the lead's person fields
  (when the lead has a name), links it to the new opportunity as a `DealContact` with role `decision_maker`
  (ties Phases 2+4 together), and calls `l.Convert(deal.Id, customer.Id)`. Previously conversion created an
  account named after the company but **discarded the actual person**.
- `LeadDto` + `LeadMappings` carry `ConvertedCustomerId` (optional trailing field).

**Phase 3 — Account-level unified timeline**
- `GetCustomerTimelineQuery(CustomerId)` + `GetCustomerTimelineHandler` (in the Activities feature) — unions
  `activities` where related to the **account** OR any of its **deals** (`Deal.CustomerId == id`) OR its
  **converted leads** (`Lead.ConvertedCustomerId == id`). Sub-queries carry their own tenant + soft-delete
  filters, so the union is tenant-scoped automatically. Reuses the existing `ActivityDto` + `ActivityMappings`
  (no new activity infra). `GET /api/crm/customers/{id}/timeline` (`crm.customers.view`).
- **Frontend** — `crm.api.ts` `getCustomerTimeline(id)`; `use-crm.ts` `useCustomerTimeline(id)` **keyed under
  `[QK,"activities","timeline",id]`** so every activity mutation (create/complete/reopen/delete, which
  invalidate `[QK,"activities"]`) refreshes it. New `account-timeline.tsx` — quick-add (logs against the
  account) + a merged read-only list where each entry shows an **origin chip** (Account / Deal / Lead) + the
  source record name; complete/reopen/delete reuse the activity hooks. `customer-drawer.tsx` Activity tab now
  renders `<AccountTimeline>` instead of the customer-only `<ActivityTimeline>` — so an account's tab shows its
  opportunities' and originating lead's activity in one stream.
- **Build:** CRM.API 0 errors/0 warnings ✅ · Frontend `tsc --noEmit` 0 errors ✅ · migration
  `AddLeadConvertedCustomer` created (auto-applies via `MigrateAndSeedCrmAsync`).
- **Pending:** republish + restart on-prem; spot-check — convert a lead → new account has a primary contact +
  the deal shows that contact as decision maker; the account's Activity tab shows deal/lead activities with
  origin chips.

**Redesign slice 1 (Lead/Account/Contact/Opportunity split) is now complete (Phases 1–4 = Modules 8b–8d).**
Next redesign slices (see "Module 8" build order): 2 = configurable pipelines (forecast-category half already in
8a); 3 = workflow engine; 4 = scoring/grading; 5 = renewals + health + cases; 6 = AI assist.

### Module 8e — CRM Pipeline & Leads: sorting, lazy-load, leads drag-drop (UX pass)
Frontend-only. Addresses a batch of pipeline/leads requests.
- **New hook** `hooks/use-lazy-list.ts` — `useLazyList(items, pageSize)` → `{ visible, hasMore, loadMore,
  sentinelRef, shown, total }`. IntersectionObserver sentinel (infinite scroll) + manual `loadMore`; resets to
  first page when `items.length` changes (so new/filtered items are always reachable).
- **Top-value first everywhere** — `pipeline-view` list + `leads-view` list sort by value desc; each kanban
  column (deals + leads) sorts by value desc.
- **Pagination / lazy-load (all CRM grids/kanban)** — via `useLazyList`: pipeline list & leads list (render 25),
  customers list + **grid** (render 24), activities list (render 30) — each with an infinite-scroll sentinel +
  "Load more" and a `shown / total` footer. Kanban columns (deals + leads): render 15/8, per-column "Show N more"
  button; the column count badge shows the true total. Refactored inline board columns into `BoardColumn`
  (pipeline-board) and `LeadColumn` (leads-view) components since the lazy hook can't run inside a `.map`.
- **Leads kanban drag-drop (new)** — `LeadsKanban` now mirrors the deals board's HTML5 DnD: optimistic local
  state, drag a card between `new/contacted/qualified` → `useSetLeadStatus`; **drop on `Converted` → runs
  `useConvertLead`** (creates account + contact + deal — not a plain status change). Deals board already had DnD.
- **"New deal not appearing in pipeline"** — by code the create/convert mutations already invalidate
  `[crm,deals*]` so the pipeline refetches; likely the un-republished backend (see deploy note) or was masked by
  no sorting. Deals now sort by value so a new deal lands by value; if low-value it may sit past the first 8 in
  its column → use the column's "Show N more" (badge shows the true count). Re-verify after republish; if it
  still doesn't show, capture the network/console on create.
- **Currency display fix (AED everywhere)** — CRM records hardcode `Currency = "AED"` in the backend
  entities (`Deal`/`Lead`/`CrmCustomer` ctors), and several components displayed that stored value (the deals
  board literally hard-coded `formatCurrency(..., "AED")`). Per the Module 6e model (operating currency drives
  `formatCurrency` app-wide; stored amounts aren't converted), all CRM display sites now use `useCurrency()`
  instead of `record.currency` / `"AED"`: deal-card, deal-drawer (incl. the "Currency" detail row + CSV/PDF
  export), pipeline list, pipeline board columns, leads card/list/drawer, customer-drawer deals tab,
  customers-view (card + list + Total Revenue stat), crm-dashboard. (pipeline-stats + forecast-bar already used
  `useCurrency`.) The add-* forms (deal/lead/customer) previously showed a hardcoded currency `<select>`
  (`["AED","USD","EUR","GBP","SAR"]`, default AED — no PKR/tenant currency); since the backend ctors ignore the
  input and always store "AED", these are now replaced with a **static read-only label showing `useCurrency()`**
  (the tenant operating currency) next to the amount input.
- **Build:** Frontend `tsc --noEmit` 0 errors ✅. (No backend changes.)

---

## Module 9 — CRM: Bulk Lead Import (Excel/CSV) + Calendly / Google Forms / Google Sheets providers

**Extends Module 7's integration framework** — turns four catalog "Coming soon" stubs into real lead sources and
adds a client-side Excel/CSV importer. Everything funnels through the **same shared intake pipeline**
(`ILeadIntakeService.IngestAsync` → field mapping → dedupe → routing → `LeadIngestedNotification`) as every
other source, so imports honour duplicate rules + assignment. **No new entities / no migration** — purely
additive at the code level (providers + DI + one command/handler + one endpoint + a dashboard query-filter fix).

### Backend (CRM service)
- **Bulk import CQRS** `Application/LeadIntake/Commands/ImportLeadsCommand.cs` — `ImportLeadsCommand(IReadOnlyList<IngestLeadInput> Leads)`
  → `ImportLeadsResult(Created, Duplicates, Failed, IReadOnlyList<ImportRowError>)`; validator caps a request at
  `MaxRows = 5000` (importer chunks larger files). Reuses the existing `IngestLeadInput` record from `IngestLeadCommand.cs`.
- `Infrastructure/Handlers/Integrations/ImportLeadsHandler.cs` — loops each row through `intake.IngestAsync(lead,
  tenantId, integration: null, ct)`; a bad row never aborts the batch (counted `Failed` with its zero-based index);
  returned error detail capped at 100 rows. Tenant from `TenantAmbient.TenantId` (fails with `Integration.NoTenant` if unresolved).
- `API/Controllers/InternalLeadsController.cs` — new `POST /api/internal/leads/import` (`ImportLeadsRequest` body).
- **`CalendlyLeadProvider`** (`Infrastructure/Integrations/Providers/`) — `ILeadProvider` + `IWebhookLeadProvider`.
  Understands the Calendly v2 shape (invitee under `payload`), acts only on `invitee.created`, mines
  `questions_and_answers` for a phone number, captures the `scheduled_event` name + `tracking` UTM params.
  Signature: verifies `Calendly-Webhook-Signature` (`t=…,v1=<hmac>` over `"<t>.<rawBody>"`) **only when** the tenant
  stored a signing secret — unsigned/keyless requests still accepted on the strength of the unguessable inbound key.
- **`ManualImportProvider(key, displayName, description)`** — a catalog-only card (`ProviderCategory.Import` +
  `ProviderCapabilities.ManualImport`); `Normalize` is never called (no inbound payload — the browser posts rows to
  the bulk endpoint). Registered as the `csv` card.
- `Infrastructure/Extensions/InfrastructureExtensions.cs` — registered `CalendlyLeadProvider`, two
  `GenericInboundProvider` instances (`google-forms` / `google-sheets` — tenant pastes a one-time Apps Script that
  POSTs each response/row as flat JSON to the inbound URL; no Google OAuth app needed), and the `csv`
  `ManualImportProvider`. **Removed** the matching `AddStub` calls for `calendly`, `google-forms`, `google-sheets`, `csv`.
- `Handlers/Dashboard/GetCrmDashboardHandler.cs` — **bug fix** (adjacent): the dashboard counted soft-deleted rows
  (the tenant global filter overwrites any entity `!IsDeleted` filter). Added manual `.Where(!IsDeleted)` to the
  Leads, Deals, and Activities queries so dashboard counts match the list + summary views.

### Frontend
- `package.json` — added `xlsx` (SheetJS); **lazy-imported** (`await import("xlsx")`) so it code-splits into its own
  chunk, never bloating the main bundle (only loaded when a user imports an `.xlsx`).
- `lib/crm/crm.api.ts` — `ImportLeadInput` / `ImportRowError` / `ImportLeadsResult` types, `IMPORT_TARGET_FIELDS`
  const + `ImportTargetField`; `crmApi.importLeads(leads)` → `POST {API_ROOT}/api/internal/leads/import` (new
  `INTERNAL` base — the import goes through the internal intake endpoint, **not** `/api/crm`).
- `hooks/crm/use-crm.ts` — `useImportLeads()` (invalidates `leads` / `leads-summary` / `dashboard`; no default toast —
  the modal shows its own created/dup/failed summary). `useCrmMutation` helper already supported an `invalidate` override.
- `modules/crm/leads/components/import-leads-modal.tsx` (NEW) — 3-stage modal (upload → map → result):
  - **Parse**: RFC-4180-ish CSV parser (quoted fields, embedded commas/newlines) for `.csv`/`.txt`; SheetJS for Excel.
  - **Map**: auto-detects each header to a CRM field via a `FIELD_SYNONYMS` table (mirrors the backend
    `GenericInboundProvider` synonyms — exact match wins, then fuzzy contains); per-column `<select>` (`bg-card`,
    already-used fields disabled), amber guard requiring at least one identity field (email/phone/fullName/firstName),
    live "N importable" count (skips rows with no identity value so they don't count as failed).
  - **Import**: chunks the payload at 2000 rows/request, sums the per-chunk tallies, shows a progress label.
  - **Result**: Created / Duplicates skipped / Failed tiles + first-100 problem rows (row index shown +2 for header + 1-based).
- `modules/crm/leads/components/leads-view.tsx` — new outline **Import** button (`<Can permission="crm.leads.create">`)
  opens the modal. Also reads `?import=1` (via `useSearchParams`) to auto-open the importer, then strips the param.
- `modules/settings/integrations/components/integrations-view.tsx` — the CSV / Excel card has **no inbound
  connection** (manual file upload), so its `handleConnect` short-circuits on the `manualImport` capability and
  navigates to `/crm/leads?import=1` instead of creating an integration + opening the (meaningless) inbound-URL
  drawer. Its button reads **"Import leads"** (UploadCloud) rather than "Connect". Calendly / Google Forms /
  Google Sheets / Custom API are all `Webhook|InboundKey` providers, so they reuse the existing generic
  inbound-key connect flow (inbound URL + secret + snippet) with zero integrations-view changes.

### Build / Verification Status
- **CRM.API:** 0 errors, 0 warnings ✅ · **Full ApiGateway:** 0 errors ✅ (only pre-existing NU1903 OpenApi advisories)
- **Frontend `tsc --noEmit`:** 0 errors ✅ · **`vite build`:** ✅ (`xlsx` split into its own lazy 429 kB chunk)
- **No migration** — additive code only; the new providers appear as real (not "Coming soon") cards on next restart.
- **Pending:** republish + restart on-prem per the deploy note; then spot-check — import a CSV/Excel of leads
  (auto-mapping + dedupe), and connect Calendly / Google Forms via their inbound URLs.

---

## Module 10 — CRM: Lead-gen capture fields (requirements + marketing attribution + form responses)

**Denormalized lead-gen / marketing fields directly onto `Lead`** so the lead drawer can show what a
lead actually asked for and where it came from. Previously attribution lived only in the separate
`LeadSource` provenance row (campaign/ad/utm ids), and there was **no storage at all** for the lead's
own requirements (WhatsApp / budget / interest / message) or survey Q&A. The frontend drawer already
read these off `lead.*`; this module makes the backend actually store + return them. **Purely additive**
(12 nullable columns; `LeadSource` retained unchanged).

### New `Lead` fields (all nullable)
- **Requirements** — `WhatsApp`, `InterestedIn`, `Budget`, `Message` (also editable in the Add/Edit Lead form).
- **Marketing / attribution** — `Platform` (meta/facebook/instagram/google…), `FormName`, `IsOrganic` (bool?),
  `Campaign`, `AdName`, `AdSetName`, `PlatformCreatedTime` (string, formatted client-side).
- **`CustomFields`** — `Dictionary<string,string>?` stored as **JSON** (EF `HasConversion`), rendered as the
  drawer's "Form Responses" catch-all (survey Q&A / custom questions).

### Backend (CRM service)
- `Domain/Entities/Lead.cs` — new properties; ctor + `Update(...)` gained the 4 requirement params (optional,
  trailing); new `SetRequirements(...)` + `SetMarketing(...)` methods (used by the intake pipeline). Private
  `Trim(...)` helper normalizes blanks → null.
- `Persistence/Configurations/CrmConfigurations.cs` (`LeadConfiguration`) — column lengths + the `CustomFields`
  JSON `HasConversion` (mirrors the existing `Tags` conversion pattern).
- `Leads/Dtos/LeadDto` — 12 new trailing optional record params; `LeadMappings.ToDto` passes them.
  Read handlers already materialize-then-map (`Select(ToDto)` / `FirstOrDefault` + `ToDto`), so the JSON
  conversion round-trips fine.
- `Leads/Commands` — `CreateLeadCommand` + `UpdateLeadCommand` gained `WhatsApp/InterestedIn/Budget/Message`
  (optional). `CreateLeadHandler`/`UpdateLeadHandler` pass them through. `LeadsController.Create` binds the
  command directly (auto-binds new fields); `Update` uses `UpdateLeadRequest` — extended + threaded through.
- **Intake pipeline** (the shared funnel for Meta/webhooks/import/manual):
  - `CanonicalLead` gained the requirement + marketing fields; `CanonicalLeadFields` added
    `whatsApp/interestedIn/budget/message/campaign/formName` targets so tenant `FieldMapping`s can promote them.
  - `IngestLeadInput` (`POST /api/internal/leads` + `/import`) gained `WhatsApp/InterestedIn/Budget/Message/FormName`
    (matches the frontend `ImportLeadInput`); `IngestLeadHandler` + `ImportLeadsHandler` map them onto `CanonicalLead`.
  - `LeadIntakeService.IngestAsync` — after creating the `Lead`, calls `SetRequirements(...)` + `SetMarketing(...)`;
    `Platform` falls back to the source (unless generic "integration"); `Campaign` falls back to `UtmCampaign`.
    New `BuildCustomFields(RawFields)` stashes any **un-promoted** raw source fields as the lead's Form Responses
    (a `KnownRawKeys` stop-list filters out name/email/phone/etc. so the catch-all doesn't just repeat contact info).
  - `MetaLeadProvider.MapLead` now fills `Platform`, `AdName`, `AdSetName`, `FormName`, `IsOrganic`,
    `PlatformCreatedTime`, and promotes `whatsapp`/`message`/`budget`/`interested_in` field_data questions.
- Migration `AddLeadMarketingFields` — 12 additive nullable columns on `crm.leads` (auto-applies via `MigrateAndSeedCrmAsync`).

### Frontend (was already in the working tree — this module made the backend match it)
- `lib/crm/crm.api.ts` — `LeadDto` + `CreateLeadRequest`/`UpdateLeadRequest` + `ImportLeadInput` + `IMPORT_TARGET_FIELDS`
  extended with the new fields.
- `add-lead-form.tsx` — new "Requirements" section (WhatsApp / Budget / Interested In / Message) on create + edit.
- `lead-drawer.tsx` — "Requirements", "Marketing & Attribution", and "Form Responses" panels (each renders only
  when it has data; WhatsApp links to `wa.me`).
- `import-leads-modal.tsx` — `FIELD_SYNONYMS`/`TARGET_LABEL` split `whatsApp`/`message`/`budget`/`interestedIn`/
  `campaign`/`formName` out of the generic phone/notes buckets for auto-mapping.

### Build / Verification Status
- **CRM.API build:** 0 errors, 0 warnings ✅ · **Frontend `tsc --noEmit`:** 0 errors ✅ · **`vite build`:** ✅
- Migration `AddLeadMarketingFields` created (auto-applies on startup).
- **Pending:** republish + restart on-prem per the deploy note; then spot-check — create/edit a lead with
  WhatsApp/budget/interest/message → drawer shows them; import a CSV mapping those columns; a Meta lead shows
  Platform/Campaign/Form + Form Responses.

---

## Module 11 — CRM Integrations: per-provider Setup Guides + hosted lead form (make the inbound integrations actually usable)

**Problem:** every inbound integration (Website Forms, Custom API, Google Forms/Sheets, Calendly, Zapier/Make)
connected fine but the config drawer's "Inbound URL" tab was a **dead end** — a bare URL + secret with **zero
setup instructions**, identical for every provider. Users had no idea how to wire each source to it (Calendly
needs a webhook subscription, Google needs an Apps Script, a website needs a form, etc.). This adds real,
provider-specific instructions **and** a genuinely new zero-code option: a Vrodux-hosted lead form.

### Backend (CRM + gateway + nginx)
- **`WebhooksController.Form` (NEW)** — `GET /api/webhooks/{inboundKey}/form` returns a self-contained, styled,
  theme-aware HTML lead form (First/Last/Email/Phone/WhatsApp/Company/Interested-in/Budget/Message) that
  `fetch`-POSTs JSON straight to the same integration's inbound URL (same-origin → no CORS issue) and shows a
  success state. Sets `Content-Security-Policy: frame-ancestors *` and removes `X-Frame-Options` so it can be
  embedded as an `<iframe>` on any customer site. Stamps `source=website`, `form_name`.
- **`GenericInboundProvider`** — now also maps the Module 10 requirement fields (`WhatsApp`, `InterestedIn`,
  `Budget`, `Message`, `FormName`) via synonym lists, and **removed `"message"` from `NotesKeys`** (it now maps
  to `Message`, not `Notes`, so it shows under Requirements — not duplicated). So **all** inbound sources
  (hosted form / custom API / Sheets / Forms) populate the lead's Requirements panel, not just raw Form Responses.
- **CORS — `PublicWebhook` policy (NEW, gateway `Program.cs`)** — `AllowAnyOrigin/Header/Method` (no
  credentials). Applied to `WebhooksController` via `[EnableCors("PublicWebhook")]` (needs
  `Microsoft.AspNetCore.Cors`). The global `AllowFrontend` policy is origin-restricted, which would block
  browser-based cross-origin posting (the advanced website snippet.js path) — this policy lets any tenant
  website POST leads. Safe: anonymous + unguessable-key protected, no cookies.
- **nginx (`nginx/conf.d/vrodux.conf`)** — the server block sets `X-Frame-Options: SAMEORIGIN always`, which
  `location /api/` inherits (no own `add_header`), so it would block the iframe. Added a **regex location**
  `~ ^/api/webhooks/[^/]+/form$` that re-adds the other security headers **minus X-Frame-Options** + CSP
  `frame-ancestors *` (a location with its own `add_header` doesn't inherit the server ones; regex beats the
  `/api/` prefix). Only the edge nginx (`vrodux-nginx`, mounts `./nginx/conf.d`) matters — the web container's
  nginx never sees `/api`. **On the Windows-service (non-nginx) deploy the app-level CSP/no-X-Frame-Options
  already covers it.** No CORS/nginx change needed for server-to-server sources (Apps Script `UrlFetchApp`,
  Calendly, Zapier/Make, curl) — only the two **browser** paths (iframe framing, snippet.js cross-origin).

### Frontend (`integrations-view.tsx`)
- New **"Setup Guide" tab** in the configure drawer (shown for all inbound providers) → `ProviderSetup`
  component that switches on `providerKey`, with reusable `CodeBlock` (multi-line copy), `Steps`, `SetupSection`
  helpers:
  - **Website Forms** — Easy/Advanced toggle. **Easy** = copy-paste `<iframe src="{url}/form">` + "Preview the
    form" link. **Advanced** = drop-in `snippet.js` (add `data-vrodux-lead` to any form) *and* a direct
    `curl`/JSON POST example + accepted-fields list.
  - **Google Sheets / Google Forms** — a one-time **Apps Script** (pre-filled with the inbound URL) + copy
    button + step-by-step trigger setup (`On form submit` / `onFormSubmit`).
  - **Calendly** — instructions-only: get a Calendly PAT → find org URI (`curl .../users/me`) → create the
    `invitee.created` webhook subscription pointing at the inbound URL (curl). Notes the paid-plan requirement.
  - **Custom API / Zapier / Make / generic** — inbound URL + `curl` example + accepted fields + Zapier/Make
    step list + optional **HMAC signing** docs (`X-Vrodux-Signature: sha256=<hex>`).
  - **CSV/Excel** — unchanged; its card opens the Leads importer (`/crm/leads?import=1`), which already guides upload→map→import.

### Build / Verification Status
- **CRM.API + full ApiGateway:** 0 errors ✅ (pre-existing NU1903/Smtp warnings only) · **Frontend `tsc
  --noEmit`:** 0 errors ✅ · **`vite build`:** ✅
- **Pending:** republish/redeploy (Docker: rebuild images + `docker exec vrodux-nginx nginx -s reload` runs in
  the deploy pipeline). **Verify after deploy:** (1) the `<iframe src=.../form>` renders embedded on an external
  site (X-Frame-Options gone for that path); (2) a submission creates a lead with Requirements populated;
  (3) the advanced snippet.js posts cross-origin (PublicWebhook CORS). Server-to-server (Apps Script, Calendly)
  needs no such checks.

---

## Module 12 — Identity: Super-admin hardening (de-hardcode seed creds + remove login demo block)

**Removed all hardcoded super-admin credentials from source and cleaned up stray super admins.** The Identity
service shipped two hardcoded super admins seeded on startup — a real backdoor sitting in the repo.

### Root cause
`Softaxis.Identity.Infrastructure/Extensions/InfrastructureExtensions.cs` had two seeders:
- `SeedAdminAsync` (runs only on an **empty** DB, `if (db.Users.Any()) return;`) created `admin@softaxis.io` /
  `Admin@123456`, flagged `MakeSuperAdmin()`, alongside the global `Administrator` role.
- `SeedSuperAdminAsync` (runs **every** startup) created `softaxus@gmail.com` / `superadmin` / `SuperAdmin@2025!`,
  flagged super-admin. On an existing row it only re-asserted the `IsSuperAdmin` flag (never reset the password).

### Changes (backend — `InfrastructureExtensions.cs`)
- **`SeedSuperAdminAsync` is now config-driven** — reads `SuperAdmin:Email` / `SuperAdmin:Username` /
  `SuperAdmin:Password` (env: `SuperAdmin__Email`, `SuperAdmin__Password`, …). **If email or password is unset,
  it is a complete no-op** — never creates or modifies any user, so an existing super admin is left exactly as-is
  and is never overwritten on deploy/restart. When the configured user already exists, only the `IsSuperAdmin`
  flag is ensured; the password is **never** reset. No credentials remain in source.
- **`SeedAdminAsync` no longer creates the hardcoded `admin@softaxis.io` super admin** — it now only ensures the
  global `Administrator` role exists (still empty-DB-gated). Signature dropped the unused `IPasswordHasher`.
- ⚠️ **Fresh-deploy implication:** with no hardcoded fallback, a brand-new empty DB deployed **without**
  `SuperAdmin__Email` / `SuperAdmin__Password` env vars will have **no super admin login at all** (by design — no
  backdoor). Set those env vars on the Identity container for any fresh deployment. Existing populated DBs are
  unaffected (both seeders no-op).

### Production data cleanup (run on the live SQL Server container, not committed)
- Super-admin password rotated directly in the DB with a BCrypt(workFactor 12) hash (`$2b$`), via
  `docker exec vrodux-sqlserver /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P … -C -d SoftaxisErpDb`.
  **Two gotchas:** (1) DML on `[identity].[users]` requires `SET QUOTED_IDENTIFIER ON;` (filtered unique indexes
  on email/username); (2) the `$` in the bcrypt hash must be shielded from bash (heredoc file or single quotes),
  or the shell mangles it — verify stored `LEN(PasswordHash)=60` and `LEFT(…,4)='$2b$'`.
- Deleted the redundant `admin@softaxis.io` super admin:
  `DELETE FROM [identity].[users] WHERE [IsSuperAdmin]=1 AND LOWER([email]) <> '<kept-email>';` — FKs from
  `user_roles` / `user_permissions` / `refresh_tokens` are all `ON DELETE CASCADE`, `audit_logs` has no user FK,
  so the hard delete is self-cleaning. (Also needs `SET QUOTED_IDENTIFIER ON;`.)

### Frontend — login page demo block removed
`FrontendVite/src/pages/auth/login.tsx` — deleted the "Demo credentials" card (which displayed
`admin@softaxis.io` / `Admin@123456`) and its `fillDemo()` handler. `setValue` is still used by the remember
checkbox, so no dead imports.

### Deploy note & build status
- Backend change → **rebuild the Identity image + restart** (the running container keeps the old hardcoded
  seeder until then). No migration (behavioral change only).
- **Identity.Infrastructure:** 0 errors / 0 warnings ✅ · **Identity.API:** 0 errors ✅ · **`vite build`:** ✅
  (the deployed bundle). Note: `npm run build` (`tsc -b`) surfaces ~9 **pre-existing** strict-mode type errors in
  unrelated files (POS / purchase / master-data / super-admin / project-management) — not introduced here; the
  repo's usual `tsc --noEmit` checks the references-root config that emits nothing, which is why they went
  unnoticed. `vite build` (esbuild, no typecheck) is what produces the deploy artifact and it passes.

---

## Module 13 — Dashboard: replace hardcoded mock charts with real per-tenant data + credential audit

**The main dashboard (`/dashboard`) showed fabricated numbers.** `modules/dashboard/components/dashboard-charts.tsx`
had **11 hardcoded mock arrays** driving 6 of its 8 chart sections — so every tenant (e.g. "4B Properties")
saw invented department headcounts, sales pipelines, stock levels, POS hourly sales, purchase trends, and room
occupancy regardless of whether any records existed. Only **FinanceCharts** and **CrmCharts** were real (wired
to `useInvoices`/`useExpenses` and `useLeads`/`useDeals`) — which is why the CRM lead count (117) was accurate
while everything else was dummy. `dashboard-view.tsx` (KPI stat cards + pipeline snapshot) was already real.

### Fix — every chart now derives from live records, with honest empty states
Deleted all mock arrays (`DEPT_HEADCOUNT`, `WEEKLY_ATT`, `LEAVE_TYPES`, `SALES_PIPELINE`, `TOP_PRODUCTS`,
`STOCK_BY_CAT`, `INVENTORY_VAL`, `POS_HOURLY`, `PAYMENT_METHODS`, `PURCHASE_MONTHLY`, `TOP_VENDORS`, `ROOM_OCC`,
`BOOKING_TYPES`). Added `titleCase()` + an `EmptyChart` helper — **when there are no records a chart shows
"No X yet" instead of fabricated data** (never invented numbers). Each section computes client-side from the
same list hooks the module pages use:
- **HrCharts** — `useEmployees` (headcount by department, top 8), `useLeaveRequests` (leave-type donut),
  `useAttendance` (current-week Mon–Sun present/absent/late, bucketed by `date`). Dropped the fake "target" bar.
- **SalesCharts** — `useSalesOrders({pageSize:500})`: monthly order value (by `createdAt`, current year) +
  order-status donut. (Replaced the old "Top Products", which needs order-line items not in the summary DTO.)
- **InventoryCharts** — `useInventoryProducts({pageSize:1000})`: stock in/low/out per category (via
  `stockQuantity`/`reorderLevel`/`isLowStock`) + valuation-at-cost donut (`stockQuantity*costPrice`).
- **PosCharts** — `useTransactions({pageSize:500})`: today's hourly sales (by `completedAt`, excluding
  voided/refunded) + payment-method split (`primaryPaymentMethod`).
- **PurchaseCharts** — `usePurchaseOrders({pageSize:500})`: monthly PO count+amount + top-5 vendors by spend.
- **HospitalityCharts** — `useRooms` (rooms by status) + `useBookings` (bookings by status). Replaced the fake
  weekly-occupancy / booking-channel mocks.
- Currency labels switched from hardcoded "PKR" to `useCurrency()` (per Module 6e).

**Caveat (documented, acceptable):** aggregation is client-side over a large single page (`pageSize` 500–1000),
not a dedicated summary endpoint — a dashboard-overview approximation for very large tenants. Charts still only
render for modules the tenant has (`hasModuleAccess`); a missing per-module `.view` permission → list query
403s → the chart falls back to its empty state (honest, not fabricated).

**Latent type fix in the same file:** the finance hooks' `select: toItems(data)` erases to `unknown[]`, so
rechecking the file surfaced pre-existing `inv`/`ex` `unknown` errors in the untouched FinanceCharts — fixed by
typing the arrays `as InvoiceDto[] / ExpenseDto[]`. (`dashboard-view.tsx` still has **pre-existing** unrelated
`tsc` errors — `PayrollSummaryDto`/`InvoiceSummaryDto`/`HrSummaryDto` field drift — not touched here; those KPI
cards already `?? 0`-fallback at runtime.)

### Credential audit (repo-wide) — clean
- All service `appsettings.json` JWT secrets are the placeholder `__SET_JWT_SECRET_VIA_ENV_OR_DEV_SETTINGS__`;
  `ApiKey` empty. `docker-compose.prod.yml` / `.stage.yml` use only `${ENV_VAR}` references. `.env` / `.env.*`
  gitignored; `.env.example` has only `CHANGE_ME_*` placeholders. Module 12 already removed the hardcoded
  super-admin/admin seed creds.
- **One minor item flagged (not changed):** `docker-compose.prod.yml` has
  `SEQ_FIRSTRUN_ADMINPASSWORD: "${SEQ_ADMIN_PASSWORD:-Vrodux2026!}"` — a hardcoded fallback for the internal Seq
  log UI (bound to `127.0.0.1` only). Low risk; consider dropping the default so it requires the env var.

### Build Status
- **`dashboard-charts.tsx` `tsc`:** 0 errors ✅ · **`vite build` (deploy bundle):** ✅ · frontend-only (no backend/API change).

---

## Module 14 — Identity: Two-Factor Authentication (TOTP + backup codes)

**Added TOTP-based 2FA (Google Authenticator / Authy / 1Password / Microsoft Authenticator) as opt-in,
self-service, per-user.** Any authenticated user can enable it; primarily for the super admin. Not email-OTP —
chosen for reliability (no email-deliverability dependency), offline, and multi-user by design.

### Login flow — two-phase, stateless challenge
`LoginCommandHandler`: after the password + email-verified checks, if `user.TwoFactorEnabled` it does **not**
issue tokens — it returns `AuthTokenDto { MfaRequired = true, MfaToken = <short-lived JWT>, User = null }`.
`AuthTokenDto.User` is now nullable; two new optional fields `MfaRequired`/`MfaToken`. Step 2 =
`POST /api/auth/verify-2fa { mfaToken, code }` → `VerifyTwoFactorCommandHandler` validates the token, verifies
the authenticator code **or** a one-time backup code, then issues the real access/refresh tokens (mirrors the
login success path: perm keys, refresh token, audit `LOGIN`, `RecordLoginSuccess`). Invalid code →
`RecordLoginFailure()` (so the existing 5-strike lockout applies to the 2FA step too).

### 🔐 Critical: the MFA token must NOT be usable as an access token
The step-1 token is signed with the same key/issuer, so it is issued with a **distinct audience**
(`"vrodux:mfa-pending"`, JwtTokenService). The main JWT bearer auth requires `_settings.Audience`, so it
**rejects** the MFA token on every `[Authorize]` endpoint — the token can only be spent at `/auth/verify-2fa`.
`ValidateMfaToken` also requires an `mfa_pending=true` claim. Without the distinct audience this would be a 2FA
bypass. `JwtSecurityTokenHandler` remaps `sub`→`ClaimTypes.NameIdentifier`, so `ValidateMfaToken` reads both.

### Backend (Identity)
- `Domain/Entities/User.cs` — `TwoFactorEnabled`, `TwoFactorSecret` (encrypted at rest), `TwoFactorBackupCodes`
  (newline-joined SHA-256 hashes) + methods `SetTwoFactorSecret` (pending, not enabled), `EnableTwoFactor`,
  `DisableTwoFactor`, `ConsumeBackupCode`, `BackupCodesRemaining`. `UserConfiguration` maps lengths + default.
  Migration `AddTwoFactorAuth` (3 additive columns; auto-applies via `MigrateAndSeedAsync`).
- **`TotpService`** (`Infrastructure/Services`) — self-contained **RFC 6238** (HMAC-SHA1, 6 digits, 30 s, ±1
  window) + RFC 4648 Base32 + QR via **QRCoder** `PngByteQRCode` → data-URI (no frontend QR lib, no
  System.Drawing). **Algorithm verified against the RFC 6238 test vectors** (287082 / 081804) before shipping.
- **`TotpSecretProtector`** — AES-256-GCM; key = `SHA256("vrodux::totp-secret::" + Jwt:Secret)`. Deterministic →
  ciphertext survives restarts/redeploys with no separate key store. ⚠️ **Rotating `Jwt:Secret` invalidates all
  stored TOTP secrets** (users must re-enroll) — same blast radius as refresh tokens.
- CQRS (handlers-in-Application, per Identity's convention): `Auth/Commands/VerifyTwoFactor`,
  `Users/Commands/{SetupTwoFactor,EnableTwoFactor,DisableTwoFactor}`, `Users/Queries/GetTwoFactorStatus`;
  DTOs `TwoFactorSetupDto/EnableResultDto/StatusDto`; shared `Common/BackupCodeHasher` (normalize→SHA-256).
  `IJwtTokenService` gained `GenerateMfaToken`/`ValidateMfaToken`. DI: `ITotpService`, `ITotpSecretProtector`.
- **`TwoFactorController`** `api/account/2fa` (`[Authorize]`, acts on current user): `GET status`,
  `POST setup` (→ secret+otpauth+QR), `POST enable {code}` (→ 10 one-time backup codes, shown once),
  `POST disable {code}` (requires a current authenticator or backup code). `verify-2fa` added to `AuthController`.

### Frontend
- `lib/identity/types.ts` — `AuthTokenDto.user` nullable + `mfaRequired`/`mfaToken`; TwoFactor DTOs.
  `lib/identity/auth.api.ts` — `verifyTwoFactor()` + `twoFactorApi` (status/setup/enable/disable via authed `apiClient`).
  `hooks/identity/use-2fa.ts` — status query + setup/enable/disable mutations.
- `pages/auth/login.tsx` — when `mfaRequired`, the card swaps to a **code-entry step** (6-digit input +
  "Back to sign in") → `verifyTwoFactor` → `loginFromApi`. (Uses the same `D` palette.)
- `modules/settings/security/components/two-factor-card.tsx` — full enroll flow: QR + manual key → confirm code
  → **backup codes** (copy / download .txt) ; enabled state shows codes-remaining + Disable (code-gated).
  `pages/settings/security.tsx` + route `/settings/security` (RoleGuard super_admin/tenant_admin/manager) + nav
  item "Security (2FA)". Also surfaced as a **"Security (2FA)"** button in the super-admin console header.

### Lockout / recovery (break-glass)
Backup codes cover a lost device. If a user is fully locked out (no device + no codes), a super admin resets via
SQL: `UPDATE [identity].[users] SET TwoFactorEnabled = 0, TwoFactorSecret = NULL, TwoFactorBackupCodes = NULL
WHERE email = '…';` (needs `SET QUOTED_IDENTIFIER ON;` — filtered indexes on the users table).

### Build / Verification Status
- **Identity.API + full ApiGateway:** 0 errors ✅ · **Frontend `tsc` + `vite build`:** 0 errors ✅ ·
  migration `AddTwoFactorAuth` created (auto-applies on startup) · TOTP core unit-verified vs RFC 6238.
- **Pending (needs republish + restart per the on-prem deploy note):** end-to-end — enable 2FA in Settings →
  Security, scan into Google Authenticator, confirm; log out; log in → code step → success; backup-code login;
  disable. Scope note: 2FA is behind the settings RoleGuard (super_admin/tenant_admin/manager), not every user.
## Module 15 — Visa Services (UAE visa consultancy) — Phase 1: Case management core

**New microservice `Softaxis.VisaServices`** (schema `visa`) — visa consultancy case management: intake →
document checklist → manual government submission → tracking → outcome. Architecture is
**adapter/channel-provider with manual fallback** (UAE has no open visa-submission APIs; GDRFA/ICP/MOHRE
adapters land in Phase 4 as partnerships are onboarded — same plug-in model as the CRM lead providers).
Phases: 1 case core (THIS) · 2 Finance/CRM wiring · 3 renewals+alerts · 4 govt channel adapters (UAE PASS
first) · 5 client self-service portal.

### Backend (clean CQRS per the reference pattern)
- **Projects**: `Softaxis.VisaServices.{Domain,Application,Infrastructure,API}` — added to `Softaxis.ERP.slnx`,
  referenced by the gateway csproj, registered in gateway `Program.cs` (`AddVisaServicesInfrastructure`,
  `AddApplicationPart(VisaCasesController)`, `MigrateAndSeedVisaServicesAsync`), `VisaDb` connstring in gateway
  appsettings (⚠️ deployed envs configure connstrings via env — add `ConnectionStrings__VisaDb` there).
- **Domain**: `VisaCase` (aggregate; auto `VC-{yyyyMMdd}-{6CHAR}`; static `Transitions` status machine:
  draft→docs_pending→docs_complete→submitted→in_review→approved→issued→closed, with rfi_required loop,
  rejected→rework, cancelled; `ChangeStatus` returns false on illegal move → 400 `VisaCase.InvalidTransition`),
  `Applicant` (person + passport; `Relationship` primary/spouse/child/…), `VisaType` (**GLOBAL** reference data,
  excluded from tenant isolation like Currency — `TenantIsolation.ApplyTenantId(..., exclude: [typeof(VisaType)])`;
  `RequiredDocuments` `'|'`-joined conversion; idempotent code-seed keyed on `Code` — 9 UAE types: employment
  new/renewal/cancellation, family, visit 30/60, golden 10yr, freelance, student), `CaseDocument` (checklist row,
  pending→received→verified/rejected/expired; per-applicant), `CaseStatusEvent` (append-only timeline).
- **CQRS** `Application/VisaCases/*`: `CreateVisaCaseCommand` (embedded `ApplicantInput[]`; copies the visa
  type's document template per applicant; auto-SLA from `ProcessingDays`; logs created + auto docs_pending
  events), `ChangeCaseStatusCommand` (optional `GovtReference` on submit / `RejectionReason` on reject),
  `AssignCaseCommand`, `UpdateCaseDocumentCommand` (**auto-advances docs_pending→docs_complete when the last
  doc is verified**), `AddCaseDocumentCommand`, `AddCaseNoteCommand`, `DeleteVisaCaseCommand`;
  queries GetVisaCases(status?, customerId?) / GetVisaCaseById (applicants+docs+timeline) /
  GetVisaCasesSummary / GetVisaTypes. Handlers in `Infrastructure/Handlers/VisaCases/`.
- **API**: `VisaCasesController` `api/visa/cases` (summary/list/byId/create/status/assign/documents/notes/delete,
  `[RequirePermission("visa.cases.*")]`), `VisaTypesController` `api/visa/types` (open reads — feed the wizard
  dropdown). `VisaControllerBase` maps `.InvalidTransition`/`.InvalidStatus` → 400. Standalone `Program.cs` +
  appsettings for design-time/EF.
- **Migrations**: `InitialVisaServices` (5 tables under `Persistence/Migrations`; visa_types has NO TenantId).
  Identity: seeded `visa.cases` view/create/edit/delete (`AddVisaPermissions` migration; admins auto-gain via
  `SyncAdministratorPermissionsAsync`); `TenantRoleProvisioner` `["visa"]="Visa Manager"`.

### Frontend
- `types/global.ts` `ModuleKey` + "visa"; `auth.store.ts` `backendModulesToFrontend` case "visa" (+crm) and the
  old-token fallback list; onboarding `module-data.ts` new "Visa Services" industry-pack module (Stamp icon);
  `permission-matrix.ts` MODULE_GROUPS/GROUP_ORDER "Visa Services"; nav group "Visa Services" → `/visa/cases`
  (icon `Stamp`, added to nav-utils iconMap); App route in `ModuleGuard module="visa"`.
- `lib/visa/visa.api.ts` — types + `CASE_STATUS_META`, `CASE_BOARD_COLUMNS`, `CASE_TRANSITIONS` (mirrors the
  backend machine so the UI only offers legal moves) + `visaApi`. `hooks/visa/use-visa.ts` — queries + mutations
  (invalidate `[visa]`, toasts).
- `modules/visa/cases/components/`: `visa-cases-view.tsx` (6 stat cards, search + status pills, board/list
  toggle, `useLazyList` everywhere, SLA-urgency sort + overdue chips; board DnD **validates transitions
  client-side** and toasts on illegal drops), `case-drawer.tsx` (tabs Overview/Applicants/Documents/Timeline;
  per-doc status `<select bg-card>` + add-requirement; note quick-add; footer renders ONLY the legal next
  transitions; submit captures govt reference, reject captures reason — inline modals), `new-case-wizard.tsx`
  (2-step: type+details with fee prefill from the type → applicants with add-dependent rows; submit shows
  total fees). Page `pages/visa/cases.tsx`.

### Build / Verification Status
- **Full ApiGateway (incl. new service):** 0 errors ✅ · **Frontend `tsc --noEmit`:** 0 errors ✅
- Migrations `InitialVisaServices` + `AddVisaPermissions` created (auto-apply on startup).
- **Pending:** republish + restart on-prem (and add `ConnectionStrings__VisaDb` to the deployed env config);
  then E2E: onboard/enable "visa" module → New Case wizard (type → applicants → checklist auto-generated) →
  move through the board → submit w/ reference → verify docs auto-advance + timeline.

### Phase 2 — Finance auto-invoice + CRM wiring (DONE)
Cross-service integration done via **frontend orchestration** (Finance/CRM/Visa are separate services + schemas;
per the "no new Finance code" design the frontend calls the existing Finance invoice API and links the result
back onto the case). Only backend change is a link column on `VisaCase`.

- **Backend (additive):** `VisaCase.InvoiceId` (Guid?) + `InvoiceNumber` (string?) + `LinkInvoice(...)`;
  `LinkCaseInvoiceCommand` + handler (+logs an "invoice" `CaseStatusEvent`); `PATCH /api/visa/cases/{id}/invoice`
  (`visa.cases.edit`). Both DTOs (`VisaCaseSummaryDto`/`VisaCaseDetailDto`) + mappings + `GetVisaCasesHandler`
  projection carry the two fields. Migration `AddVisaCaseInvoiceLink` (2 additive columns).
- **Finance auto-invoice (frontend):** `hooks/visa/use-visa.ts` — `buildCaseInvoiceRequest(caseDetail)` (service
  fee + govt fee line items, taxRate 0, notes ref the case #) + `useGenerateCaseInvoice()` which calls
  `financeApi.createInvoice(...)` then `visaApi.linkInvoice(caseId, {invoiceId, invoiceNumber})` and invalidates
  both `[visa]` + `[finance,invoices]`. New-case wizard: a "Create a draft invoice in Finance" checkbox (only
  shown when `useCan("finance.invoicing.create")`, default on) → best-effort generates the invoice after case
  create (never blocks case creation). Case drawer Overview → **Billing** section: shows the linked invoice
  (`<Link to="/finance/invoicing">`) or a `<Can permission="finance.invoicing.create">` "Generate draft invoice"
  button. `visaApi.linkInvoice` + `invoiceId`/`invoiceNumber` on the DTOs.
- **CRM account link:** the new-case wizard's client field is now an **account combobox** (searches
  `useCustomers()` → sets `customerId` + name, "Linked" pill; free-text = unlinked). `CreateVisaCaseRequest`
  already carried `customerId`; now populated. `useCreateVisaCase` rewritten as a typed `useMutation` so the
  wizard's `onSuccess(created)` is a `VisaCaseDetailDto` (feeds the invoice generator).
- **CRM lead → visa case:** `NewCaseWizard` gained an optional `prefill` prop (`CaseWizardPrefill`:
  customerName/customerId/assignedTo/applicant). `lead-drawer.tsx` — a `<Can permission="visa.cases.create">`
  **"Visa Case"** footer button opens the wizard seeded from the lead (company → client, person → primary
  applicant). (Wizard rendered as a sibling of the drawer's AnimatePresence so it isn't clipped.)
- **CRM account → visa cases:** `visaApi.getCases({status?, customerId?})` (was status-only) +
  `useCustomerVisaCases(customerId, enabled)`. `customer-drawer.tsx` Overview shows a **Visa Cases** section
  (case type, number, status badge, total fees), gated by `useCan("visa.cases.view")` so non-visa tenants /
  unauthorized users make no call. No import cycle — CRM drawers import the visa *wizard*, which imports leaf
  hooks/APIs only.
- **Build:** Full ApiGateway 0 errors ✅ · Frontend `tsc --noEmit` 0 errors ✅ · migration
  `AddVisaCaseInvoiceLink` created.
- **Pending:** republish + restart; then E2E — create a case with an account + invoice checkbox → draft invoice
  appears in Finance and links in the case Billing section; convert a lead → "Visa Case" prefilled; a linked
  account's drawer lists its visa cases.

### Additional surfaces — Dashboard, Renewals, Visa Types (multi-page module)
Turned the single Visa Cases page into a 4-page module (nav restructured to a collapsible **Visa Services**
group with children: Dashboard / Cases / Renewals / Visa Types). All read-only queries — **no migration**.
- **Backend** (new read handlers in `Handlers/VisaCases/`, reuse `VisaCasesController`):
  - `GetVisaDashboardQuery` → `VisaDashboardDto` (totals, open/overdue/due-this-week, open fees, expiring
    passports-90d / documents-30d, byStatus / byType counts, revenueByType, PRO workload). `GET /api/visa/cases/dashboard`.
  - `GetVisaRenewalsQuery(withinDays=90)` → `RenewalItemDto[]` — unions **passport expiries** (from Applicants)
    + **document expiries** (CaseDocuments with an ExpiryDate) within the horizon, overdue-first (string
    `yyyy-MM-dd` compares; `DaysLeft` parsed via `DateTime.TryParseExact`). `GET /api/visa/cases/renewals?withinDays=`.
    Both gated `visa.cases.view`. (No visa-expiry field yet → renewals = passports + documents; a dedicated
    issued-visa expiry is a Phase-3 follow-up.)
  - Reuses existing `GET /api/visa/types` for the catalogue page.
- **Frontend**: `visaApi.getDashboard/getRenewals` + `useVisaDashboard/useVisaRenewals`.
  - `modules/visa/dashboard/…/visa-dashboard-view.tsx` — 6 stat cards + bar breakdowns (by status/type/revenue)
    + PRO workload + expiry banner.
  - `modules/visa/renewals/…/visa-renewals-view.tsx` — horizon toggle (30/60/90/180d), urgency chips
    (overdue/≤14/≤30), `useLazyList` table, row → `CaseDrawer`.
  - `modules/visa/types/…/visa-types-view.tsx` — catalogue cards (category/channel/fees/processing days,
    expandable required-document checklist), search + category filter. **Read-only** — per-tenant editing needs
    `VisaType` to become tenant-scoped (currently GLOBAL like Currency); flagged as a follow-up.
  - Pages `pages/visa/{dashboard,renewals,types}.tsx` + `App.tsx` routes in `ModuleGuard module="visa"`;
    nav-utils iconMap gained `CalendarClock`.
- **Build:** Full ApiGateway 0 errors ✅ · Frontend `tsc --noEmit` 0 errors ✅ · no migration.
- **Pending:** republish + restart.

### Follow-ups — issued-visa expiry, editable Visa Types, government channels (DONE)
Three requested enhancements, built in order.

**A. Issued-visa expiry tracking** — `VisaCase.VisaExpiryDate` (nullable `yyyy-MM-dd`, migration
`AddVisaCaseExpiry`); `ChangeCaseStatusCommand` gained `VisaExpiryDate`; the case-drawer "Issue visa" transition
now opens a date prompt (mirrors the submit/reject inline modals). Renewals handler adds a **"visa"** kind
(issued visas nearing expiry, most-urgent first); dashboard adds `ExpiringVisas90`. Detail DTO carries
`VisaExpiryDate`; drawer Overview shows a "Visa Expiry" row.

**B. Editable Visa Types (tenant-scoped)** — `VisaType` moved from GLOBAL to **tenant-owned**: removed from the
`exclude` list in `VisaDbContext` (now gets the shadow `TenantId` + filter), `Code` index changed unique→non-unique
(unique per tenant now), migration `MakeVisaTypesTenantScoped`. The default UAE catalogue moved to
`Persistence/Seed/VisaTypeCatalogue.BuildDefaults()` and is **lazy-seeded per tenant** on first `GetVisaTypes`
(TenantId stamped on save); the startup global seed is replaced by a one-time cleanup that deletes legacy
NULL-tenant rows. ⚠️ **Gotcha fixed:** `TenantIsolation.ApplyTenantId` *replaces* an entity's query filter, so
the config `HasQueryFilter(!IsDeleted)` on `VisaCase` and `HasQueryFilter(IsActive)` on `VisaType` were being
overwritten — every case/type read handler now filters `!IsDeleted` / `IsActive` **manually** (same pattern as
CRM). CRUD: `Create/Update/DeleteVisaTypeCommand` (+handlers in `Handlers/VisaTypes/`), `VisaTypesController`
POST/PUT/DELETE gated `visa.cases.edit` (delete = soft `SetActive(false)`; Code auto-derived as a slug). Frontend:
`visa-type-form.tsx` drawer (fees, processing days, document-checklist editor) + New/Edit/Delete on the Visa Types
page (gated).

**C. Government channels (Phase 4 foundation)** — `ChannelAccount` (per-tenant channel credentials; secret
**encrypted at rest** via `IVisaSecretProtector` = Data-Protection impl, mirrors CRM's `DataProtectionSecretProtector`;
needed `Microsoft.AspNetCore.DataProtection.Abstractions` in the infra csproj) + `GovtSubmission` (per-case
government transactions: entry_permit/status_change/emirates_id/stamping/…). Migration `AddVisaChannels`. The
plug-in extension point is the declarative `ChannelCatalogue` (manual=active, uaepass=beta, gdrfa/icp/mohre=coming_soon,
each with capabilities + a setup guide) — a live adapter plugs in by reading `ChannelAccount` + writing
`GovtSubmission` (no empty runtime-provider stubs). CQRS: `GetChannelsQuery` (catalogue ⋈ tenant connection),
Connect/Disconnect, `GetCaseSubmissionsQuery`, Create/UpdateSubmission; `ChannelsController` (`api/visa/channels`
+ `api/visa/cases/{id}/submissions`). Frontend: `visa-channels-view.tsx` settings page (channel cards + connect
drawer w/ encrypted secret + setup guides) as a 5th Visa nav item `/visa/channels`; case drawer gained a
**Submissions** tab (record government transactions + per-row status). Real API adapters (UAE PASS first) await
partnership credentials — manual works today.

- **Build:** Visa API 0 errors ✅ · Frontend `tsc --noEmit` 0 errors ✅ · migrations `AddVisaCaseExpiry`,
  `MakeVisaTypesTenantScoped`, `AddVisaChannels` created.
- **Pending:** republish + restart (the running gateway currently holds the build DLLs — a full gateway build
  needs it stopped, which the republish does). Then: issue a case → set visa expiry → it appears on Renewals;
  edit/create a visa type; connect a channel + record a submission on a case. **Phase 5** (client self-service
  portal) is the remaining visa phase.

---

## Module 15 — CRM: Role-based lead assignment & scoping (assigned-only visibility + handoff pipeline)

**Makes lead visibility role-driven and adds an assignment/reassignment hierarchy.** Previously `Lead.AssignedTo`
was free-text (a name), `GetLeadsHandler` returned **all** leads to anyone with `crm.leads.view`, and every
leads endpoint was gated on `crm.leads.view/edit` at the controller — so there was no way to give a role
"see only the leads assigned to me." Now: full-view roles see everything (admins included); a restricted role
(e.g. "Sales Executive") granted only the new assigned-only keys sees just its own leads, can act on them, and
can hand them onward — with every handoff recorded.

### Permission model — new `crm.leads-assigned` module (2 keys, no new matrix columns)
`PermissionSeedData.cs` — added `["crm.leads-assigned"] = ["view","edit"]` (reuses the existing view/edit matrix
columns, renders as its own "Leads (Assigned only)" row under CRM). Migration `AddCrmAssignedLeadPermissions`
(Identity) inserts the 2 rows; `SyncAdministratorPermissionsAsync` auto-grants them to every Administrator on
startup. Tiers: **full** = `crm.leads.view`/`crm.leads.edit` (all leads); **assigned-only** =
`crm.leads-assigned.view`/`crm.leads-assigned.edit` (only leads where `AssignedToUserId == me`; `edit` also
covers reassigning your own lead). `moduleLabel` override in `permission-matrix.ts` gives the friendly label.

### Backend (CRM service)
- **`Lead`** — new `Guid? AssignedToUserId` (drives scoping; legacy free-text `AssignedTo` kept for display) +
  `AssignTo(userId, name)`. ctor + `Update(...)` gained an optional trailing `assignedToUserId`. New
  **`LeadAssignment`** append-only entity (`lead_assignments` table) = one handoff row (from→to user, by whom,
  note, timestamp) — the pipeline trail. Both auto tenant-isolated (CRM namespace). Migration `AddLeadAssignments`.
- **`ICurrentUser`** (`Application/Abstractions`, first use in CRM) + `CurrentUserService`
  (`Softaxis.CRM.API/Middleware`, registered in the gateway `Program.cs` alongside the other services' — CRM.API
  needed a `<FrameworkReference Include="Microsoft.AspNetCore.App" />` + explicit `using Microsoft.AspNetCore.Http;`
  since it's a plain `Microsoft.NET.Sdk`, not `.Web`). **`ILeadAccessGuard`** (`Infrastructure/Services`,
  registered in `AddCrmInfrastructure`) centralizes all scoping: `ScopeReadable(IQueryable<Lead>)`, `CanRead`,
  `CanEdit`, `CanManageActivityAsync(relatedToType, relatedToId)`, `ScopeActivities(IQueryable<Activity>)`.
- **Handlers**: `GetLeads` scopes the list; `GetLeadById`/`GetLeadAssignments` return `NotFound` for a lead the
  user can't read (don't leak existence); `UpdateLead`/`UpdateLeadStatus`/`UpdateLeadScore`/`ConvertLead` reject
  with `NotFound` unless `CanEdit`; `CreateLead` sets the owner + seeds the history with the initial assignment;
  new **`AssignLeadHandler`** (reassign + history row, `CanEdit`-gated) + **`GetLeadAssignmentsHandler`**.
  Activity handlers (`Create/Update/Complete/Reopen`) enforce `CanManageActivityAsync` so an assigned-only user
  can only log/manage activities on a lead they own; `GetActivities` uses `ScopeActivities` (assigned-only users
  see only their own leads' activities; full-view users unchanged — preserves the old `crm.leads.view` rule).
- **New `RequireAnyPermissionAttribute`** (passes if the user holds **any** of the listed keys, super-admin
  bypass). `LeadsController` reads → `RequireAnyPermission(view, view-assigned)`; writes (Update/status/score/
  convert/**assign**) → `RequireAnyPermission(edit, edit-assigned)` (handler then enforces per-lead ownership);
  create/delete unchanged (`crm.leads.create`/`.delete` — assigned-only users don't create or delete). New
  endpoints `POST /leads/{id}/assign` + `GET /leads/{id}/assignments`. `ActivitiesController` GET/create/complete/
  reopen/update loosened to `RequireAnyPermission(..., crm.leads-assigned.edit)`.

### Frontend
- `crm.api.ts` — `LeadDto.assignedToUserId`, `CreateLeadRequest.assignedToUserId`, `LeadAssignmentDto`,
  `assignLead(id, {toUserId,toUserName,note})`, `getLeadAssignments(id)`. `use-crm.ts` — `useAssignLead`,
  `useLeadAssignments`; default mutation invalidation now also refreshes `lead` + `lead-assignments`.
- `add-lead-form.tsx` — the assignee `<select>` already listed tenant users but stored the **name only**; now it
  stores the **user id** (`value={u.id}`) and sends `assignedToUserId` (legacy name-only leads show
  "{name} (unlinked)" until re-picked). **This was the missing link that made backend scoping possible.**
- `lead-drawer.tsx` — gates Edit/status/Convert on `canEditThis = crm.leads.edit || (crm.leads-assigned.edit &&
  lead.assignedToUserId === myUserId)` (super/tenant admin always true via `hasRawPermission`); new **Reassign**
  button → `ReassignPanel` (tenant-user picker + note → `useAssignLead`); new **Assignment History** section
  (handoff trail via `useLeadAssignments`). `/api/users` is only `[Authorize]` (no `settings.users.view`), so the
  pickers work for assigned-only users.

### Known follow-up (not in scope)
Integration/routing-captured leads (`LeadIntakeService` fixed/round_robin) still set only the assignee **name**,
not `AssignedToUserId`, so an auto-routed lead won't appear for an assigned-only role until an admin (re)assigns
it via the UI. Wiring routing to resolve a real user id is a separate task.

### Build / Verification Status
- **CRM.API + Identity.Application + full ApiGateway:** 0 errors ✅ · **Frontend `tsc --noEmit` + `vite build`:** 0 errors ✅
- Migrations `AddLeadAssignments` (CRM) + `AddCrmAssignedLeadPermissions` (Identity) created (auto-apply +
  admin-sync on startup).
- **Pending (needs republish + restart per the on-prem deploy note):** live check — create a "Sales Executive"
  role with only `crm.leads-assigned.view`/`.edit`; that user sees only assigned leads (list + drawer), can add
  activities / change status / reassign onward but not create/delete or see others' leads; admin sees all + the
  handoff history; assign a lead to them and confirm it appears.

---

## Module 16 — CRM: Property Finder lead integration (real-estate portal enquiries → CRM leads)

**New lead source in the Module 7 integration platform** — Property Finder listing enquiries (email / call /
WhatsApp / SMS) sync into the CRM as leads with the property context attached. Built as a plug-in provider =
**one class + one DI line + one frontend setup guide**, zero CRM/pipeline changes, no migration (the catalog is
derived from registered `ILeadProvider`s). Mirrors the Calendly provider (Module 9) since Property Finder nests
the person under `client`/`contact` and the listing under `property`/`listing` — a shape the generic JSON
provider can't read.

### Backend (CRM service)
- **`PropertyFinderLeadProvider`** (`Infrastructure/Integrations/Providers/`) — `ILeadProvider` +
  `IWebhookLeadProvider`, key `"property-finder"`, category **`ProviderCategory.RealEstate` = "Property Portals"**
  (new constant), capabilities `Webhook | InboundKey | ApiKey`. `Normalize` handles a single object, a bare
  array, or `{leads:[…]}`; reads the enquirer from nested `client/contact/customer/lead/user` (or flat root) and
  the listing from `property/listing`. Maps → `CanonicalLead`: name/email/phone/WhatsApp (WhatsApp enquiries use
  the contact number), enquiry `message` → **Message**, property title + reference → **Interested In**, price +
  offering type → **Budget**, location → **City**, `Platform="property_finder"`, `FormName="Property Finder — {type}
  enquiry"`, `ExternalLeadId` (drives dedupe), a readable **Notes** summary, and every listing detail (reference,
  type, offering, price, location, beds/baths, size, url, agent) stashed in `RawFields` → shows under the lead's
  **Form Responses** and is field-mappable. Optional HMAC-SHA256 verify over the raw body via
  `X-PropertyFinder-Signature`/`X-Signature`/`X-Vrodux-Signature` (`sha256=<hex>`); unsigned accepted on the
  unguessable inbound key (same posture as Calendly).
- Registered in `InfrastructureExtensions.AddCrmInfrastructure` (`AddSingleton<ILeadProvider, PropertyFinderLeadProvider>()`),
  right after Calendly. Everything funnels through the existing `ILeadIntakeService.IngestAsync` (field-mapping →
  dedupe → create → routing → `LeadIngestedNotification`), which already carries City/Requirements/Marketing/
  customFields onto the `Lead` (Module 10). Lead `Source` = the provider key `"property-finder"`.

### Frontend (`integrations-view.tsx`)
- `LOGO["property-finder"] = {label:"PF", color:"bg-rose-600"}`. The **"Property Portals"** category chip appears
  automatically (categories are derived from the catalog). Connect uses the generic inbound flow (no OAuth/manual
  import) → creates the integration with an inbound URL + secret → opens the configure drawer; `isInbound` (keys
  off `inboundUrl`) lights up the **Setup Guide** + **Inbound URL** tabs.
- New **`property-finder` case in `ProviderSetup`** — inbound URL, step-by-step portal wiring, the exact JSON
  payload Vrodux understands (nested client + property), a `curl` test, and optional HMAC signing docs.

### Scope note
Covers **lead/enquiry sync** (what the user asked for). Syncing Property Finder **listings** into an
inventory/listings module is a separate, larger scope (not CRM leads) — flagged, not built. If Property Finder's
account has no self-serve webhook option, leads can still be forwarded to the inbound URL via Zapier/Make or their
account manager's lead-export — the provider accepts any of those.

### Build / Verification Status
- **CRM.Infrastructure + full ApiGateway:** 0 errors ✅ · **Frontend `tsc --noEmit` + `vite build`:** 0 errors ✅
- No migration. **Pending (needs republish + restart):** the "Property Finder" card appears in Settings →
  Integrations under "Property Portals"; connect → POST the sample payload to the inbound URL → a lead appears
  with property title as Interested In, price as Budget, message + Form Responses populated.

---

## Module 17 — Identity: Tenant-owner activation email (super-admin create-tenant) + country dropdown

**Fixed "no email is sent to the tenant owner on creation."** `CreateTenantCommandHandler` was by design
sending **no email at all** — it required the super admin to type the owner's email + username + **password**,
created the owner **pre-verified** (`VerifyEmail()`), and never injected `IEmailService`. The owner was expected
to get credentials out of band. Now the owner receives an **activation email** to set their own password and log
in (industry-standard invite flow).

### Backend (Identity)
- **`IEmailService.SendTenantInviteEmailAsync(toEmail, toName, tenantName, setPasswordToken?, ct)`** +
  `SmtpEmailService` impl. When `setPasswordToken` is set → invite wording + link to
  `{FrontendUrl}/auth/reset-password?token=…&email=…` (**reuses the existing reset-password page/flow** — no new
  page/token type); otherwise → "your account is ready" login notice. Same SMTP config
  (`Email:SmtpHost/SmtpUsername/SmtpPassword/FromAddress/FromName` + `FrontendUrl`) and dev-fallback (logs the
  link when SMTP unset) as the reset/verification emails.
- **`CreateTenantCommandHandler`** — injects `IJwtTokenService` + `IEmailService`. **Admin password is now
  optional** (email + username still required). When blank = **invite mode**: seeds an unguessable placeholder
  password, pre-verifies the account (so login works once they set a password — `ResetPassword` does NOT verify
  email, hence the pre-verify stays), issues a single-use **password-reset token (7-day expiry)** via
  `SetPasswordResetToken`, and after commit sends the activation email **best-effort** (try/catch — SMTP failure
  never fails tenant creation). When a password IS provided, behaviour is unchanged except a "ready to log in"
  welcome email is sent. No migration (reuses existing reset-token columns).

### Frontend (`create-tenant-page.tsx`)
- Admin **Password field is now optional** — label "(optional)", placeholder "Leave blank to email an activation
  link", live helper text; validation requires only email+username (password ≥8 only *if* provided).
- **Country is now a dropdown** (was free-text) — reuses `COUNTRIES` from `lib/onboarding/geo-data.ts` (stores the
  country name, matching the prior free-text value).

### Notes
- Trial/onboarding path unchanged (self-serve — user sets their own password during onboarding).
- **Requires SMTP configured in prod** for the email to actually deliver (confirmed configured). If a send fails,
  the super admin can resend an activation link via the normal forgot-password flow.

### Build / Verification Status
- **Identity.Infrastructure + full ApiGateway:** 0 errors ✅ · **Frontend `tsc --noEmit` + `vite build`:** 0 errors ✅
- **Pending (needs republish + restart):** create a tenant with a blank admin password → owner receives the
  activation email → set-password link activates + logs in; create with a password → "ready" welcome email.

---

## Module 18 — CRM: Automatic rule-based lead scoring (make `Lead.Score` computed, not free-form)

**Roadmap slice 4 (see Module 8 build order).** `Lead.Score` (int 0–100) was a real column with a working
`PATCH /leads/{id}/score` endpoint + `ScoreBar`/Hot·Warm·Cold display, but **nothing ever produced a value** —
`CreateLeadCommand` had no score field, the intake pipeline never set it, there was no auto-scoring logic, and
the only UI writer (`useSetLeadScore`) was dead (never called; the edit form has no score input and just
re-sent the existing value). So every lead showed **0**. This makes the score automatic + computed.

### Scoring model — `Softaxis.CRM.Domain/Entities/LeadScoring.cs` (NEW, pure/deterministic)
`LeadScoring.Calculate(email, phone, whatsApp, budget, interestedIn, message, source, priority,
estimatedValue, activityCount)` → 0–100 (summed then clamped):
- Contactability (reachability) — max 25: email 10 · phone 8 · whatsapp 7
- Buying intent — max 30: budget 12 · interested-in 10 · message 8
- Source quality — max 20: referral/partner 20 · website/property-finder/walk_in 15 · trade_show 14 ·
  linkedin/social/email_campaign/google_ads/meta/facebook/instagram/whatsapp 12 · cold_call 5 · unknown 8
- Deal size (estimated value) — max 10 (tiered ≥100k/≥50k/≥10k/>0)
- Priority (manual rep signal) — max 10: high 10 · medium 5 · low 0
- Engagement — max 15: 5 per logged activity
UI banding unchanged: ≥70 Hot · ≥40 Warm · <40 Cold.

### `Lead.RecalculateScore(int activityCount = 0)` (Lead.cs) — overwrites Score (computed, not free-form)

### Wired at every producer
- `CreateLeadHandler` — `l.RecalculateScore(0)` before save.
- `LeadIntakeService.IngestAsync` — `newLead.RecalculateScore(0)` after SetRequirements/SetMarketing (all
  integration sources: Meta/import/webhooks/Property Finder/etc.).
- `UpdateLeadHandler` — recomputes from the edited signals + current activity count (ignores the incoming
  `cmd.Score`; score is now computed). Added `using Microsoft.EntityFrameworkCore;`.
- `CreateActivityHandler` — when the activity is `relatedToType == "lead"`, recomputes that lead's score with
  `priorCount + 1` (engagement bump), single SaveChanges. Added the EF using.

### Idempotent startup backfill — `RecomputeZeroScoreLeadsAsync` (InfrastructureExtensions, in `MigrateAndSeedCrmAsync`)
Existing leads all sit at Score = 0 (predate scoring). Recomputes **only** `Score == 0` rows (never clobbers a
computed score; no-op once all scored) across all tenants (`IgnoreQueryFilters()`, no ambient tenant at
startup), activity counts via one grouped query. **Best-effort `try/catch` — never crash-loops startup** (per
the deploy-runs-startup-seeding risk).

### Notes / scope
- The manual `PATCH /leads/{id}/score` endpoint + `useSetLeadScore` hook are left in place but are now moot
  (edit/activity recompute overrides them) — a future "manual override" toggle could reuse them.
- No migration (uses the existing `Score` column). No frontend change — the score already displays; it will
  simply be non-zero now.
- **Build:** CRM.API 0 errors / 0 warnings ✅. **Pending (republish + restart):** backfill runs on startup;
  spot-check — create a lead (email+phone, website, medium → ~38; +budget/interest → higher), a referral with
  budget/high priority → Hot; log an activity → score rises; a Meta/import lead shows a non-zero score.

### Module 18b — CRM: Purchase-timeframe urgency signal + auto-derived lead value

Extends Module 18 with two signals users asked for: **when** the lead plans to buy (urgency) and a **numeric
value** for leads that arrive without one (Meta/import).

- **`PurchaseUrgency` (Domain, NEW)** — `Classify(text)` maps a free-text "when are you planning to buy/invest?"
  answer to a ranked bucket via **dynamic keyword + number matching** (not a fixed enum): `immediate` /
  `1_month` / `1_3_months` / `3_6_months` / `6_plus` / `unknown`. Handles "ASAP", "within 30 days", "1-3
  months", "6+ months" (open-ended `+`/"more than" bumps ≥6 to `6_plus`), "just researching", "next year", etc.
  `Score(text)` → max **25** (immediate 25 · 1mo 20 · 1-3mo 13 · 3-6mo 7 · 6+/researching 3). New phrasings =
  add a keyword.
- **`BudgetParser` (Domain, NEW)** — `Parse(text)` turns a free-text budget ("50k–100k", "AED 500,000", "1.5M",
  "5 lakh", "2 crore", ">500k") into a decimal; **ranges → midpoint** (approved). Currency-agnostic (strips
  symbols, no FX — Module 6e model).
- **`Lead`** — new nullable `PurchaseTimeframe` column (raw text). `RecalculateScore` now takes the timeframe;
  new `DeriveEstimatedValueFromBudget()` fills `EstimatedValue` from the budget **only when it's 0** (a
  manually-entered value always wins — approved). `SetRequirements`/ctor/`Update` carry the timeframe.
  Migration `AddLeadPurchaseTimeframe` (1 column).
- **`LeadScoring` rebalanced** to fit urgency (max 100): urgency 25 · contactability 20 · buying-intent 20 ·
  deal-value 15 · source 12 · priority 8 · engagement 10.
- **Capture** — `CanonicalLead.Timeframe` + `CanonicalLeadFields.Timeframe`; `GenericInboundProvider`
  `TimeframeKeys`, Meta `field_data` timeframe cases, intake `KnownRawKeys` (so it doesn't double-show under
  Form Responses); `IngestLeadInput.Timeframe` (so `/internal/leads` + bulk import map it). Intake now calls
  `DeriveEstimatedValueFromBudget()` then `RecalculateScore(0)`. Create/Update handlers pass the timeframe +
  derive value before scoring.
- **Backfill broadened** — `RecomputeLeadValueAndScoreAsync` (was `RecomputeZeroScoreLeadsAsync`) targets
  `Score == 0` **or** `(EstimatedValue == 0 && Budget set)`, derives value + rescores; still idempotent,
  best-effort, all-tenants.
- **Frontend** — `crm.api.ts` `PurchaseUrgency` type + `URGENCY_META` (badge colors) + `TIMEFRAME_OPTIONS`;
  `LeadDto.purchaseTimeframe`/`purchaseUrgency`; Create/Update/Import requests carry timeframe; import modal
  synonyms + label. Add/Edit form gets a **"Planning to buy" dropdown** (standard buckets — approved). Urgency
  **badge** shown in the lead list (next to name) + drawer Requirements ("Planning to buy" row). Also fixed the
  drawer's `SOURCE_LABELS[lead.source]` → `sourceLabel()` (same empty-source fix as the list).
- **Build:** CRM.API + full ApiGateway 0 errors ✅ · Frontend `tsc` + `vite build` 0 errors ✅ · migration
  `AddLeadPurchaseTimeframe` created (auto-applies + backfill on startup). **Pending (republish + restart):**
  a Meta/import lead with a budget shows a non-zero Est. Value + urgency badge; a lead answering "immediately"
  scores Hot.

### Module 18c — CRM: fixes to field-mapping coverage, budget value, and score for inbound (Meta/IG/FB) leads
Follow-up fixing three linked issues reported on real Meta/Instagram/Facebook leads (value showing "50" or 0,
scores too low):
- **Root cause — field-mapping dropdown was missing most targets.** `MappingTab` in `integrations-view.tsx`
  hardcoded only 12 basic target fields, so users couldn't map Meta lead-form questions (which use custom field
  names) to `budget`/`timeframe`/`interestedIn`/`whatsApp`/`message`/`campaign`/`formName`. Those never got
  captured → no value derived (0) + missing urgency/intent/value score. **Fix:** `TARGET_FIELDS` now lists the
  full `CanonicalLeadFields` set with friendly labels (e.g. "Budget (→ lead value)", "Purchase timeframe (→
  urgency)"). Backend `ApplyFieldMappings` already supported all of them — only the UI list was short.
- **"50" value bug — `BudgetParser`.** A bare "50" (shorthand for 50k in these markets) parsed to literally 50.
  **Fix:** when a budget has no unit suffix and no thousands separator and the result is < 1000, treat it as
  thousands (`"50"`→50,000, `"75-100"`→75,000). Suffixed/separated values ("50k", "50,000", "1.5M") unchanged.
- **Existing leads repaired.** The startup backfill (`RecomputeLeadValueAndScoreAsync`) now also (1) recovers
  budget/timeframe/interest/whatsapp/message that landed in `CustomFields` (Form Responses) under a custom name
  — via `Lead.RecoverRequirements(...)` + a normalized synonym table, (2) force-re-derives value over bad tiny
  legacy values (`DeriveEstimatedValueFromBudget(overrideExisting: value < 1000)`), and (3) rescopes to
  `Score == 0 || EstimatedValue < 1000`. `RecalculateScore` is now idempotent (skips the `UpdatedAt` bump when
  the score is unchanged) so re-runs don't churn rows.
- **Backfill moved off the startup path.** All `MigrateAndSeed*Async` run **awaited before `app.RunAsync()`**, so
  a heavy CRM lead backfill would delay `/health` and could trip the deploy's 5-min health window → rollback.
  The value/score repair now runs **fire-and-forget on its own DI scope** (`Task.Run(... InBackgroundAsync)`,
  fully try/catch-guarded); the migration + seed stay synchronous.
- **Build:** CRM.API + full ApiGateway 0 errors ✅ · Frontend `tsc` + `vite build` 0 errors ✅. No new migration.

### Module 18d — CRM: intent-first scoring, honest lead value, richer kanban cards + summary
Product pass so reps can see a lead's potential at a glance and call the hottest first.
- **Scoring rebalanced to be intent-first** (`LeadScoring`, still 0–100): purchase urgency **28** ·
  intent keywords **12** (new — scans message/interest for "ready to buy", "cash", "urgent", "site visit",
  "pre-approved", …) · budget stated **10** · interested-in **6** · contactability **15** · **deal value only
  8** (down from 15 — the derived value is unreliable, so it no longer dominates) · source 8 · priority 5 ·
  engagement 8. Intent factors alone reach ~56, so "hot" means high intent, not just complete data.
- **Honest value derivation.** The bare-number ×1000 guess produced misleading **static 50,000** values (a
  budget of "50" → 50,000). `BudgetParser` now **refuses to guess**: a bare number with no unit (k/m/lakh/crore)
  and no thousands separator below 10,000 returns **null** (value stays 0; the UI shows the raw budget text).
  Trusted magnitudes ("50k", "5 lakh", "1.5M", "500,000") parse as before. New `ParseFromText` also pulls a
  value from the message/interest **only** when a money cue is present (never a phone/year). Startup repair uses
  `Lead.RepairEstimatedValueFromBudget()` (authoritative for budgeted leads — clears the bad legacy 50,000s).
- **Urgency tags for imported/inbound leads.** `PurchaseUrgency.DetectTimeframeText` + `Lead.DetectTimeframeFromText()`
  detect a timeframe from the message/interest ("looking to buy within 2 months", "ASAP") when no explicit
  timeframe field came through — wired into intake, create/update, and the backfill, so imported leads get an
  urgency badge. Hardened the `week` match (`\bweeks?\b`) so "weekend" isn't read as immediate.
- **Frontend — see the potential at a glance.** `crm.api.ts` adds `leadHeat(score)` (🔥 Hot ≥70 / 🌤️ Warm ≥40 /
  ❄️ Cold) and `buildLeadSummary(lead)` (one-line "3BHK · Budget 5M · Immediate"). **Kanban cards** rewritten to
  show heat chip + score, intent summary, click-to-call phone, interested-in, raw budget text, and the urgency
  badge. **List** shows a heat chip + urgency next to the name and the summary as the subline. **Drawer** shows a
  heat pill + summary above the score bar. **Both list and kanban now sort by intent score** (hottest first),
  not by the unreliable value.
- **Backfill rescopes ALL leads** (background, idempotent) to recompute under the new weights + repair values +
  detect timeframes for existing data.
- **Build:** CRM.API + full ApiGateway 0 errors ✅ · Frontend `tsc` + `vite build` 0 errors ✅. No new migration.
- **Note on value:** budgets written as bare numbers ("50" meaning 50 lakh) are inherently ambiguous, so those
  intentionally show value 0 with the raw "50" visible on the card, rather than a confidently-wrong number. Reps
  can set an exact value manually; the score no longer leans on value magnitude.

### Module 18e — CRM: robust Meta field capture (real form names), lakh/crore budget parsing, compact value, WhatsApp column
Driven by real Meta lead-form data (Pakistan real estate). Field names arrive like `your_budget?`,
`when_are_you_planning_to_buy?`, `what_are_you_interested_in?`, `whatsapp_number`; budget values like
`up_to_60_lakh`, `65–70_lakh`, `50_lakh_–_1_crore`. Most leads were showing **0 PKR** because (a) the providers'
exact-name matching missed the `?`-suffixed question names, and (b) `BudgetParser` couldn't read a `lakh` unit
detached from its number by an underscore.
- **`LeadFieldClassifier`** (NEW, `Application/LeadIntake`) — normalized keyword classifier: `Classify(name)`
  → canonical field, `Apply(canonicalLead, name, value)` assigns with `??=`. Rules like `contains "budget"` →
  budget, `contains "when" && (buy|invest|purchas|plan|move)` → timeframe, `interested|buyingfor|project` →
  interestedIn, `whatsapp` → whatsApp, etc. Wired as a fallback into **`MetaLeadProvider`** (after its explicit
  field_data switch) and **`GenericInboundProvider`** (over all raw fields), so custom question names are
  captured without the tenant hand-mapping each one. Tenant field mappings (Settings → Integrations) still run
  and win first; the classifier fills the gaps.
- **`BudgetParser` — lakh/crore + underscores/dashes.** Normalizes `_`/`/` → space (so `up_to_60_lakh` →
  `60 lakh`). Captures the **whole trailing word** as the unit (so "50 luxury" ≠ 50 lakh — only exact units
  `k/m/lakh(s)/lac(s)/l/crore(s)/cr/million/billion` count). Unitless numbers in a range **inherit the largest
  unit present**, so `65–70 lakh` → 6.75M, `2-3 crore` → 25M, `50-100k` → 75K, `50 lakh – 1 crore` → 7.5M.
  (1 lakh = 1e5, 1 crore = 1e7.)
- **Historical-lead recovery uses the classifier too.** The startup backfill's `RecoverFromCustomFields` now
  classifies each Form-Responses key via `LeadFieldClassifier` (was a brittle exact-synonym list), so existing
  leads whose budget/timeframe sat unpromoted in `CustomFields` get recovered + re-valued + rescored.
- **Frontend:** `formatCompactValue(amount, currency)` shows value "in words" with the tenant currency
  (`PKR 6M`, `PKR 750K`) on cards + the list Est. Value column. **Import auto-detect** gained the same
  keyword `classifyHeader` so a Meta CSV/Excel export auto-maps `your_budget?` / `when_are_you_planning_to_buy?`
  etc. **Leads table: removed the Company column, added a WhatsApp column** (click-to-`wa.me`).
- **Build:** CRM.API + full ApiGateway 0 errors ✅ · Frontend `tsc` + `vite build` 0 errors ✅. No new migration.
- **Known gap (not scored):** the `how_do_you_plan_to_purchase?` (cash vs financing) and site-visit questions
  aren't canonical fields — they stay in Form Responses (visible in the drawer) and aren't factored into the
  score yet. "invest"/"cash" still score when they appear in the interest/message text.

---

## Build Status
- **TypeScript (frontend):** 0 errors ✅
- **Backend Finance service:** 0 errors ✅
- **Backend HR service:** 0 errors ✅ (2 migrations applied)
- **Backend Identity service:** 0 errors ✅
- **Backend Inventory service:** 0 errors ✅
