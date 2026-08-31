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

## Module 19 — Restaurant POS: Enterprise Redesign Phase 1 (CQRS/DDD migration + permissions foundation)

**First phase of a full enterprise Restaurant Management Platform redesign.** Full Phase 1/2 analysis
(current-state audit + gap analysis vs. Toast/Micros/Square/Lightspeed/Revel/Foodics) and the complete
Phase 3–7 design (module design, DB schema, API design, frontend redesign, 5-phase roadmap, Jira backlog)
live in **`docs/restaurant-pos-enterprise-redesign.md`**. Key finding from that analysis: `Softaxis.Restaurant`
was a single-branch MVP — 4 anemic entities, 5 controllers injecting `RestaurantDbContext` directly (violates
the mandatory CQRS rule above), hardcoded 5% VAT, zero `restaurant.*` permissions, and a raw-SQL payment
workaround masking an unresolved EF concurrency bug. This module is the foundation fix — CQRS/DDD migration +
permissions — before any of the roadmap's new features (branch/session wiring, structured modifiers,
split-bill, etc. — Epics 2/3 in the design doc) get layered on.

### CQRS/DDD migration (mirrors the Finance/`Accounts` reference implementation exactly)
- **New `Softaxis.Restaurant.Application` project** — `Commands/Queries/Dtos` per feature
  (`Tables`, `Menu`, `Orders`, `Kitchen`, `Reservations`), FluentValidation validators alongside their
  commands, matching Finance's pattern (not POS's `Result<T>`/`AuditableEntity<Guid>`/domain-event style —
  confirmed by reading `Finance.Domain.Account` that the actual "reference implementation" CLAUDE.md
  designates uses plain entities with private setters; only the CQRS *layering* is mandatory, not that style).
- **All 5 controllers rewritten** to `(ISender sender) : RestaurantControllerBase` — no more injected
  `DbContext`, no more inline response DTOs (inline *request* records for route+body shapes, e.g.
  `CreateOrderReq`, are kept — same blessed exception Finance's `AccountsController.UpdateAccountRequest` uses).
- **`RestaurantControllerBase`** + **`RequirePermissionAttribute`** (`Softaxis.Restaurant.API`) — copied from
  the shared Finance/Purchase/CRM pattern, including the explicit `using Microsoft.AspNetCore.Http;` gotcha
  (Restaurant.API is a plain `Microsoft.NET.Sdk` project, not `Sdk.Web`, so `StatusCodes` doesn't resolve
  without it).
- **Gotcha confirmed and preserved**: `TenantIsolation.ApplyTenantId` overwrites each entity's
  `HasQueryFilter(!IsDeleted)` (same issue documented for CRM/Visa) — the pre-migration controllers already
  worked around this by re-applying `.Where(x => !x.IsDeleted)` on every query; every new handler does the same.

### Concurrency bug fix — replaces the raw-SQL payment workaround
`OrdersController.RecordPayment` previously bypassed EF change-tracking with `ExecuteSqlAsync` specifically to
dodge "optimistic concurrency rowcount issues" — there was no real concurrency token, so the workaround masked
the underlying problem rather than fixing it. Now: `Order.RowVersion` (`byte[]`, `IsRowVersion()`) is a real EF
concurrency token (migration `AddOrderRowVersion`), and a new `ConcurrencyRetry.ExecuteAsync` helper
(`Infrastructure/Common/`) retries the whole load-mutate-save operation up to 3× on
`DbUpdateConcurrencyException` — applied to every Order-mutating handler (payments, item add/remove, discount,
status transitions), not just payments, since adding a real concurrency token means *any* concurrent write to
an `Order` row can now throw where it silently last-write-wins'd before.

### Permissions — new `restaurant.*` module (previously nonexistent)
`PermissionSeedData.cs` — `restaurant.tables`/`.menu` (view/create/edit), `restaurant.orders`
(view/create/edit/**void**/**discount**/**refund** — mirrors `pos.transactions`'s action set),
`restaurant.kitchen` (view/edit), `restaurant.reservations` (view/create/edit). Migration
`AddRestaurantPermissions` (Identity) — auto-applies + admin-syncs on startup (`SyncAdministratorPermissionsAsync`
already generic, no per-module code needed). `TenantRoleProvisioner` gained `["restaurant"] = "Restaurant Manager"`
so restaurant-enabled tenants get a scoped manager role automatically (same pattern as every other module).
`[RequirePermission]` applied to every action across all 5 controllers — `Cancel` (voids the whole order) gates
on `.void`, `ApplyDiscount` gates on `.discount`, everything else on the standard view/create/edit split.
Frontend: `permission-matrix.ts` gained the `Restaurant` module group; `<Can>` gating added to
`restaurant-pos-view.tsx` (Add Table, Takeaway/new order, discount panel, remove-item, cancel-order, menu
availability toggle) and `kitchen-display-view.tsx` (Mark Ready/Served).

### Build / Verification Status
- **Full backend solution (`Softaxis.ERP.slnx`, all 16+ services via the gateway):** 0 errors ✅, only the
  pre-existing `SmtpEmailService` nullable warnings (unrelated) — confirmed via a full `dotnet build` of the
  solution, not just the touched service.
- **Frontend `tsc --noEmit`:** 0 errors ✅.
- Migrations `AddOrderRowVersion` (Restaurant) + `AddRestaurantPermissions` (Identity) created — auto-apply on
  next startup via the existing `MigrateAndSeedRestaurantAsync`/`MigrateAndSeedAsync`.
- **Pending (needs republish + restart per the on-prem deploy note):** live spot-check — grant only
  `restaurant.orders.view` → orders list 200, create/discount/void 403; confirm two concurrent item-adds to the
  same order no longer silently clobber each other (one should retry-and-succeed via `ConcurrencyRetry`).
- **Next (Epics 2/3 in the design doc, not done here):** `BranchId`/`SessionId`/`CustomerId`/`TaxRateId` wiring
  onto `Order` (ties into POS's existing `POSSession`/`TaxRate`/`Customer` — reuse, not rebuild, per the design
  doc's Appendix reuse map), manager-PIN approval, structured modifiers, split-bill, tips.

### Module 19b — Restaurant POS: Branch + POS Session wiring on Order (Epic 2)

**Second slice of the Restaurant redesign** (after Module 19's CQRS/permissions foundation). Wires `Order` to
Identity's `Branch` and POS's `POSSession` — **reuse, not rebuild**, per the design doc's Appendix reuse map.
Confirmed during this pass that neither concept existed anywhere in Restaurant before: `POSSession` itself has
no branch dimension either (cashier+register scoped only), and the frontend's `branchIds` on the auth-store
`User` is a hardcoded `[]` stub ("single-tenant for now") — so no real "current branch" selection UX exists yet
anywhere in this app. Building that UX is out of scope here (a separate Enterprise-phase item); this module
wires the *data path* (`Order.BranchId`, optional, informational) so it's ready when that UX exists, and fully
wires the *session* half end-to-end since POS already has a complete, working shift mechanism (`ShiftGate`/
`useShift()`) that Restaurant simply wasn't plugged into.

- **`Order`** gains `BranchId`/`SessionId`/`CashierId` (all nullable `Guid`, scalar cross-service references,
  no FK constraint — same convention as every other cross-service reference in this codebase). `CashierId` is
  **never client-supplied** — resolved server-side from the JWT via a new `ICurrentUser` (Restaurant didn't
  have one; added `Application/Abstractions/ICurrentUser.cs` + `API/Middleware/CurrentUserService.cs`,
  registered in gateway `Program.cs` — exact mirror of the CRM/ProjectManagement pattern, including the
  `<FrameworkReference Include="Microsoft.AspNetCore.App" />` gotcha Restaurant.API needed since it's a plain
  `Microsoft.NET.Sdk` project, not `Sdk.Web`).
- **`PosSessionLedger`** (`Infrastructure/Common/`) — raw cross-schema SQL against `[pos].[pos_sessions]`
  (confirmed same physical `SoftaxisErpDb`, different schema — every service's connection string points at the
  same database). Mirrors POS's own `CrossSchemaProductService` pattern exactly (`db.Database.SqlQuery<T>`/
  `ExecuteSqlAsync` with the `({bypass} = 1 OR TenantId = {tenant})` guard) rather than adding a project
  reference from Restaurant → POS, keeping the two services independently compilable. Two operations:
  `ValidateOpenSessionAsync` (checks the session exists, belongs to this tenant, and `Status = 1` i.e. Open) and
  `RecordSaleAsync` (mirrors `POSSession.RecordTransaction(amount, isRefund: false)` exactly — bumps
  `TotalTransactions`/`TotalSales`/`ExpectedCash` so a restaurant sale reconciles in the same Z-report as a
  retail POS sale; Restaurant has no refund flow yet, so this only ever records the sale direction).
- **`CreateOrderHandler`** — if the request carries a `SessionId`, validates it's open *before* creating the
  order (rejects a stale/closed cached session id up front); stamps `CashierId` from `ICurrentUser`.
- **Payment handlers** (`PayOrderHandler`/`AddOrderPaymentHandler`) — **re-validate** the order's stored session
  is *still* open before accepting a payment (a long-running dine-in bill could span a shift close), then call
  `RecordSaleAsync` after the payment is saved. Orders with no `SessionId` (legacy orders, or a register not
  using shift tracking) skip all of this — same behavior as before, no regression.
- New error codes `PosSession.NotFound`/`PosSession.Conflict` — chosen specifically to match
  `RestaurantControllerBase`'s existing suffix-based HTTP mapping (`.NotFound`→404, `.Conflict`→409); a naive
  `Order.SessionNotOpen`-style code would have silently fallen through to the 500 default.
- **Frontend**: `pages/pos/restaurant.tsx` now wraps `RestaurantPOSView` in `<ShiftGate>` (previously only
  `pages/pos/retail.tsx` did — Restaurant had no shift gate at all, so orders could be created with zero cash-
  drawer tracking regardless of an open POS session existing). `OrderDrawer` reads `sessionId` via `useShift()`
  and passes it into `createOrder`. `RestaurantOrder`/`useCreateOrder`/`restaurantApi.createOrder` types
  extended with `branchId`/`sessionId`/`cashierId`.
- **Deliberately not built here**: any branch-selection UI (no such UX exists anywhere in this app yet to hook
  into — `branchId` stays `undefined` from the frontend until that Enterprise-phase work happens), manager-PIN
  approval, structured modifiers, split-bill, tips (all still Epic 3 / later phases per the design doc).

### Build / Verification Status
- **Full backend solution:** 0 errors ✅ (verified after stopping a locally-running `Softaxis.ApiGateway`
  instance that was locking build output — restarted by the user afterward, not by this session).
- **Frontend `tsc --noEmit`:** 0 errors ✅.
- Migration `AddOrderBranchAndSession` (Restaurant, 3 additive nullable columns + 2 indexes) — auto-applies on
  next startup.
- **Pending (needs republish + restart):** live spot-check — open a shift, create a dine-in order, confirm
  `Order.SessionId`/`CashierId` populate; pay it and confirm the shift's `TotalSales`/`ExpectedCash` in the
  Close-Shift summary include that order; close the shift, then attempt a payment against an order still tied
  to it → expect `409 PosSession.Conflict`.

### Module 19c — Restaurant POS: Discounts/Voids/Refunds audit-trail overhaul (Epic 3, Feature 3.3)

**Third slice of the Restaurant redesign** (after 19's CQRS foundation, 19b's Branch/Session wiring). Replaces
the flat, unaudited `Order.DiscountAmount` field and the silent item-delete/order-cancel with a real audit
trail, and adds a refund capability that didn't exist at all before. Confirmed while touching `Recalculate()`
for this: **it had a real pre-existing bug** — `SubTotal = Items.Sum(i => i.LineTotal)` summed ALL items
including soft-deleted ones (no `!IsDeleted` filter), so removing an item from an order never actually reduced
the total. Fixed as part of this pass since the same method needed rewriting anyway for the discount-sum change.

- **Three new entities** (satellite classes in `Order.cs`, same convention as `OrderPayment`/`OrderItem`):
  `OrderDiscount` (Type/Amount/Reason/AppliedByUserId/ApprovedByUserId + `IsVoided`/`VoidedByUserId`/
  `VoidReason`/`VoidedAt` for when it's later removed), `OrderVoidLog` (OrderItemId nullable — null = whole-
  order void — /Reason/VoidedByUserId), `OrderRefund` (Amount/Reason/Method/RefundedByUserId). Migration
  `AddOrderAuditTrail` (3 tables, cascading FK to `Orders`, each with the standard shadow `TenantId`).
- **`Order.DiscountAmount` is now a computed sum** (`Discounts.Where(!IsVoided).Sum(Amount)`), recalculated in
  `Recalculate()` — not a settable field. `Order.ApplyDiscount(type, amount, reason, appliedByUserId,
  approvedByUserId?)` supersedes (voids with a system reason) any previously-active discount before adding the
  new one — preserves the existing "one active discount at a time" UX while the table itself supports stacking
  if a future UI wants it. `Order.RemoveDiscount(reason, voidedByUserId)` voids whatever's active.
- **Void, audited**: `Order.VoidItem(itemId, reason, voidedByUserId)` replaces the silent `item.Delete()` +
  logs an `OrderVoidLog` row; `Order.VoidWholeOrder(reason, voidedByUserId)` replaces the bare `Cancel()` status
  flip (kept `Cancel()` as a private primitive `VoidWholeOrder` calls internally). `RemoveOrderItemCommand` →
  renamed `VoidOrderItemCommand`, route changed `DELETE .../items/{itemId}` → `POST .../items/{itemId}/void`
  (a reason-bearing state-changing action reads more naturally as POST than as a DELETE-with-body, which the
  frontend's `rawApiClient.delete` doesn't even support passing a body for). `CancelOrderCommand` → renamed
  `VoidOrderCommand`, now requires `Reason`.
- **New refund capability** (`Order.Refund(amount, reason, method, refundedByUserId)`) — didn't exist before.
  Doesn't reverse `Status` away from `"paid"` (mirrors how `POSTransaction` refunds work — the sale stays
  completed, the refund is a separately tracked cash-flow event). `POST /orders/{id}/refund`
  (`restaurant.orders.refund` — this permission key was already seeded in Module 19, unused until now).
  **Deliberately more lenient than payments about the tied POS session**: payments are blocked outright if the
  session has since closed (protects the shift's Z-report from receiving late sales it didn't expect), but a
  refund is never blocked by that — a customer complaint the next day shouldn't be impossible to refund. Instead
  `PosSessionLedger.RecordRefundAsync`'s own SQL carries a `WHERE ... AND Status = {OpenStatus}` guard, so it
  silently no-ops against a closed session (never retroactively amends an already-reconciled shift) while the
  refund still succeeds on the order itself. `PosSessionLedger` also gained `RecordSaleAsync`/`RecordRefundAsync`
  as thin wrappers over one shared `RecordTransactionAsync`, mirroring `POSSession.RecordTransaction(amount,
  isRefund)` exactly — including that a refund does **not** decrease `ExpectedCash` in the existing POS domain
  model (replicated faithfully here, not "fixed", since this is POS's existing behavior, not Restaurant's to change).
- **New `ICurrentUser` (Module 19b) now actually load-bearing** — every audited mutation (apply/remove discount,
  void item, void order, refund) injects it to stamp who did it; each handler returns `Auth.Unresolved` if the
  JWT somehow has no resolvable user id (defensive; `[Authorize]` makes this practically unreachable).
- **Frontend**: `restaurant.api.ts`/`use-restaurant.ts` — `voidItem`, `applyDiscount({type,amount,reason})`,
  `removeDiscount(reason)`, `cancel(id, reason)`, `refund({amount,reason,method})`; `RestaurantOrder` gained
  `discounts`/`voidLogs`/`refunds`. `restaurant-pos-view.tsx` — new shared `ReasonModal` (reason textarea +
  confirm/cancel, matches this codebase's "never `window.prompt`, state-based modal" rule) used for void-item
  and cancel-order; the existing discount panel gained one shared reason `<Input>` used for both apply and
  remove; new `RefundModal` (amount capped at `amountPaid` + method + reason) wired to a new **Refund** button
  shown on paid orders with `amountPaid > 0`, gated by `<Can permission="restaurant.orders.refund">`.

### Build / Verification Status
- **Full backend solution:** 0 errors, 0 warnings beyond the pre-existing `SmtpEmailService` ones ✅ (confirmed
  the gateway process wasn't running before each build, per the file-lock issue hit in Module 19b).
- **Frontend `tsc --noEmit`:** 0 errors ✅.
- Migration `AddOrderAuditTrail` created (auto-applies on next startup).
- **Pending (needs republish + restart):** live spot-check — apply a discount with a reason, confirm it shows
  in the order's discount history; void an item and confirm the total actually drops (this is the bug-fix,
  worth specifically re-verifying); cancel an order with a reason; refund a paid order and confirm
  `TotalRefunds` on its (still-open) shift increases; close the shift, then refund an already-paid order tied
  to it → order refund still succeeds, that closed shift's totals are untouched.
- **Next (remaining Epic 3 features, not done here):** structured modifiers (replace the free-text
  `OrderItem.Modifiers` string), split-bill (`Order.ParentOrderId`), tips (`Order.TipAmount`) + hold/recall
  status. Manager-PIN approval (flagged in Module 19's Feature 1.3, still not built) would let a
  `restaurant.orders.void`-lacking cashier still void/discount/refund under a supervisor's PIN instead of a
  flat 403 — a natural next layer on top of this audit trail once built.

### Module 19d — Restaurant POS: Structured modifiers (Epic 3, Feature 3.1)

**Fourth slice of the Restaurant redesign.** Replaces the free-text-only "no onions, extra cheese" box with
real, priced `ModifierGroup`/`Modifier` entities (e.g. "Size": Small/Medium/Large at +0/+2/+4) and a proper
picker in the order-taking drawer — the free-text field is **kept** as a separate "special instructions"
channel (both exist simultaneously in real POS systems; they serve different purposes: priced/structured
choices vs. free-text kitchen notes).

- **Four new entities**: `ModifierGroup` (Name/MinSelect/MaxSelect — MinSelect=0 means optional, >=1 makes it
  required; no separate `IsRequired` flag, MinSelect already fully expresses it), `Modifier` (Name/PriceDelta/
  SortOrder/IsActive, belongs to a group), `MenuItemModifierGroup` (join — which groups apply to which menu
  item, with per-item ordering), `OrderItemModifier` (the actual selection on an order line — **snapshots**
  Name/PriceDelta at order time so a later price change to the Modifier itself never alters a historical
  order, same snapshot principle used for `OrderDiscount`). Migration `AddStructuredModifiers` (4 tables).
- **`OrderItem.LineTotal` changed** to `Quantity * (UnitPrice + SelectedModifiers.Sum(PriceDelta))` — modifier
  price deltas apply **per unit** (3× "Large Pizza" costs 3 × (base + delta), not base×3 + delta once),
  matching standard POS behaviour.
- **Admin CRUD** (`ModifiersController` + 2 new `MenuController` endpoints, all gated on the existing
  `restaurant.menu.view/create/edit` keys — no new permission keys needed): `CreateModifierGroupCommand`
  creates a group + its modifiers in one shot; `UpdateModifierGroupCommand` uses a **diff-and-replace**
  approach (modifier entries with an `Id` are updated in place, entries without one are added, any existing
  modifier not present in the submitted list is soft-deleted) rather than separate add/update/delete-modifier
  commands — collapses what would've been ~6 commands into 2, and matches how an admin would actually edit a
  modifier group (one form, save once). `AssignMenuItemModifierGroupsCommand` replaces the full assigned set
  for a menu item (simpler than incremental add/remove for a checkbox-list UI).
- **Order-time validation** — new shared `OrderItemFactory.BuildAsync` helper (`Infrastructure/Common/`) used
  by both `CreateOrderHandler` and `AddOrderItemsHandler` so validation can't drift between the two entry
  points: confirms every selected modifier belongs to a group actually assigned to that menu item, and that
  each assigned group's MinSelect/MaxSelect is respected (e.g. "'Size' requires at least 1 selection"). All
  three failure modes map to `Modifier.Conflict` (409) — chosen specifically to match
  `RestaurantControllerBase`'s existing `.Conflict`-suffix → 409 mapping.
- **Behavior change flagged**: `CreateOrderHandler`/`AddOrderItemsHandler` previously **silently skipped** a
  line referencing a nonexistent `MenuItemId` (`if (menuItem is null) continue;`) — since `OrderItemFactory`
  now returns a proper `Result.Failure` for that case, a bad line now fails the whole request with a clear
  404 instead of silently creating a smaller order than what was asked for. Deliberate fix, not an accident —
  matches this module's running theme of not letting invalid input pass through unnoticed.
- **Menu queries extended**: `MenuItemDto` gained `ModifierGroups` (nested — reuses
  `ModifierGroups.Dtos.ModifierGroupDto` directly rather than duplicating a parallel type). New
  `ModifierGroupLookup.GetGroupsForItemsAsync` helper loads groups for a whole batch of menu items in 3
  queries total, not N+1 — used by both `GetMenuHandler` and `GetMenuItemsHandler` so the order-taking picker
  gets everything it needs from the existing menu fetch (no extra round-trip per item).
- **Frontend**: `MenuItem` gained `modifierGroups`; `OrderItem` gained `selectedModifiers`; `OrderLineInput`
  gained `selectedModifierIds`. New `ModifierPickerModal` in `restaurant-pos-view.tsx` — radio-style for
  `maxSelect === 1` groups, checkboxes (capped at `maxSelect`) otherwise, required groups marked and validated
  client-side before "Add" enables, live price preview. `addPending(item)` now opens the picker when the item
  has any modifier groups, otherwise adds directly as before (no behaviour change for items with no
  modifiers). `PendingLine` gained a stable `key` (previously keyed by `menuItem.id`, which broke once the
  same item could appear twice with different modifier selections) and only merges duplicate add-clicks when
  the modifier selections match exactly.
- **Deliberately not built in this pass**: a dedicated "Modifier Groups" admin settings page (create/edit
  groups, assign to menu items via a UI) — the backend CRUD is complete and usable via the API, but there's no
  screen for it yet; same scoping call as skipping a branch-selector UI in Module 19b. Until that exists, groups
  have to be created via direct API calls.

### Build / Verification Status
- **Full backend solution:** 0 errors, 0 warnings beyond the pre-existing `SmtpEmailService` ones ✅.
- **Frontend `tsc --noEmit`:** 0 errors ✅.
- Migration `AddStructuredModifiers` created (auto-applies on next startup).
- **Pending (needs republish + restart, and an admin creating at least one group via the API to test with):**
  live spot-check — create a modifier group (e.g. "Size": Small +0/Medium +2/Large +4, MinSelect 1 MaxSelect
  1) via `POST /api/restaurant/modifier-groups`, assign it to a menu item via `PUT
  /api/restaurant/menu/items/{id}/modifier-groups`, then in the order drawer confirm the picker opens, enforces
  the required single selection, and the line total reflects the chosen delta; order two of the same item with
  different sizes and confirm they appear as separate lines, not merged.

### Module 19e — Restaurant POS: Split bills (Epic 3, Feature 3.2)

**Fifth slice of the Restaurant redesign — the most structurally involved of the four Epic 3 features.**
Before building, confirmed what already existed: the pay dialog (`restaurant-pay-dialog.tsx`) already has
"Split Pay" (arbitrary split-tender amounts) and "Members" (divide evenly by N guests, tagged via
`OrderPayment.Reference`) — genuine bill-splitting, just by **payment amount**, not by **item**. What's
missing, and what Feature 3.2 actually is, is item-level splitting: "Guest 1 had the steak, Guest 2 had the
salad" — each becoming its own independently-payable order.

- **`Order.ParentOrderId`** (nullable, real self-referencing FK — unlike the cross-service scalar refs
  elsewhere, this is same-table so a proper FK constraint applies, `DeleteBehavior.Restrict`). New `Status`
  value `"split"`. Migration `AddOrderSplit`.
- **`Order.CreateSplit(itemsToMove)`** — the core domain method: builds a new child `Order` copying
  table/waiter/session/branch/cashier context, moves the given `OrderItem`s onto it (`OrderItem.ReassignToOrder`,
  `internal`-scoped — only `Order.CreateSplit` calls it), recalculates the child. Caller calls this once per
  split group, then `order.MarkSplit()` on the parent. `Order.MarkSplitSettled()` (→ `Status = "paid"`) fires
  once every child is paid — safe for revenue reporting since the parent's own SubTotal/Total are exactly 0 by
  then (all its items live on the children).
- **`SplitOrderHandler`** validates before doing anything: not already paid/cancelled/split, not itself a split
  child, **no payments recorded yet**, **no active discount** (both intentionally block splitting rather than
  building pro-ration math — a clearly communicated v1 limitation, not an oversight), and every non-deleted item
  assigned to exactly one of ≥2 groups (no orphans, no double-assignment). All failures map to `Order.Conflict`
  (409).
- **Guards added to existing handlers**: `PayOrderHandler`/`AddOrderPaymentHandler` reject `Status == "split"`
  (a split parent holds no items — pay its children instead). `VoidOrderItemHandler`/`AddOrderItemsHandler`
  extended their closed-order check to include `"split"`. **`VoidOrderHandler` had no status guard at all**
  before this pass (a genuine gap noticed while adding the split check, from when it was built in Module 19c) —
  fixed alongside it, so an already-paid/cancelled order can no longer be "cancelled" again.
- **`OrderPaymentSupport.FreeTableIfFullyPaidAsync`** — the trickiest piece: when a **split child** is paid, the
  table is only freed (and the parent marked settled) once **every sibling** is also paid — one guest settling
  their share must never free a table other guests are still eating/paying at.
- **`OrderDto` gained `ParentOrderId` + `Splits`** (lightweight child summaries — id/orderNumber/status/total/
  amountPaid/outstanding) — populated only in `GetOrderByIdHandler` for parent orders (children aren't a
  navigation on `Order`, looked up via a separate query), matching the existing "list is lean, detail is rich"
  precedent already used for `Payments`. `OrdersSummaryDto` gained a `Split` count bucket.
- **Bug fix caught while re-reading `OrdersController` for this feature**: `OrderLineReq` (the controller's
  inbound request shape) never had a `SelectedModifierIds` property — Module 19d's structured-modifier
  selections were being silently dropped by JSON model binding on every `Create`/`AddItems` call, since extra
  JSON properties with no matching C# property are just ignored. Fixed by adding the field to `OrderLineReq`
  and threading it through both actions. This had been broken since 19d shipped; the picker UI worked, the
  selections just never reached the database.
- **Frontend**: `pages/pos/restaurant.tsx`'s per-table active-order lookup (`orderByTable`) now excludes split
  children (they share the parent's `tableId`, which would otherwise make the map ambiguous about which order
  represents "this table"). New `SplitBillModal` — a numeric "N guests" stepper + one-tap bucket assignment per
  item, live per-bucket subtotal preview, requires every item assigned and ≥2 buckets used. `OrderDrawer`'s
  "order" panel renders a **split overview** instead of the normal item list when `order.status === "split"` —
  each child's status/total/outstanding + a **Pay** button. Paying reuses the *existing* `RestaurantPayDialog`
  unchanged: `payTarget` state generalizes what used to be a `showPay` boolean to "the main order OR a specific
  split's child, looked up from the already-loaded `orders` list" (no extra fetch — children are just Orders
  that `useOrders()` already returns). `handlePaid` now only closes the whole drawer when the *main* order was
  paid; paying a split child just closes the pay dialog so the (now-updated) split overview stays visible for
  the next guest.

### Build / Verification Status
- **Full backend solution:** 0 errors, 0 warnings beyond the pre-existing `SmtpEmailService` ones ✅.
- **Frontend `tsc --noEmit`:** 0 errors ✅.
- Migration `AddOrderSplit` created (auto-applies on next startup).
- **Pending (needs republish + restart):** live spot-check — split a 4-item order into 2 guests, confirm each
  becomes an independently-payable order and the table stays occupied; pay one split → table stays occupied,
  parent stays `"split"`; pay the other → table frees, parent flips to `"paid"`; attempt to pay/add-items/cancel
  the parent directly at any point → `409`. Also verify the just-fixed modifier bug: add an item with a
  modifier selection, confirm `selectedModifiers` now actually appears on the created order (previously silently
  empty).
- **Next (remaining Epic 3):** tips (`Order.TipAmount`) + hold/recall status — the smallest of the four
  features, a reasonable next slice. Partial-quantity splitting (splitting a single line's quantity across
  guests, not just whole rows) and a dedicated "Modifier Groups" admin page remain flagged, not built.

### Module 19f — Restaurant POS: Tips + Hold/Recall (Epic 3, Feature 3.4 — last of Epic 3)

**Sixth and final slice of Epic 3 (Structured Ordering)** — the smallest of the four features. Adds a
tip amount separate from the bill total, and a way to park an order aside ("held") without losing its items
when the terminal is needed for something else before the order is ready to send/pay.

- **`Order.TipAmount`** (decimal, precision 18,2, default 0) — captured separately from `Total`
  (SubTotal+Tax-Discount) since tips aren't derived from line items and shouldn't get recalculated away by
  `Recalculate()`. `SetTip(amount)` clamps to zero as a defensive backstop; the handler is what actually blocks
  changing it on a closed order. New computed `Outstanding => Max(0, Total + TipAmount - AmountPaid)` (was
  `Total - AmountPaid`) — so the amount actually due to the guest includes the tip everywhere `Outstanding` is
  read (pay dialog, summary handlers, split-child summaries). `Pay()`'s single-method convenience path and
  `PayOrderHandler`'s due-amount fallback both switched from `Total - AmountPaid` to `Total + TipAmount -
  AmountPaid` so paying "the full amount" actually clears the tip too.
- **`Order.Hold()` / `Order.Recall()`** — new `Status` value `"held"`. `Hold()` only valid from `"open"`
  (`HoldOrderHandler` returns `Order.Conflict` 409 otherwise); `Recall()` only valid from `"held"`, returns to
  `"open"`. Migration `AddOrderTipAndHold` (one additive `TipAmount` column — `"held"` needed no schema change,
  it's just a new string value for the existing `Status` column).
- **Held orders extended the existing "closed order" guards** the same way `"split"` did in Module 19e:
  `PayOrderHandler`, `AddOrderPaymentHandler`, `VoidOrderItemHandler`, `AddOrderItemsHandler`, and
  `SplitOrderHandler` all now reject a `"held"` order (409 `Order.Conflict`/`Order.Closed` matching each
  handler's existing convention) — a held order must be recalled before anything else happens to it, including
  being split.
- **New commands/handlers**: `SetOrderTipCommand`/`SetOrderTipHandler` (`PATCH /orders/{id}/tip`),
  `HoldOrderCommand`/`HoldOrderHandler` + `RecallOrderCommand`/`RecallOrderHandler` (`PATCH /orders/{id}/hold` /
  `.../recall`) — all gated on the existing `restaurant.orders.edit` key (nearest-seeded-key convention, no new
  permission). `OrderDto` gained `TipAmount`; `OrdersSummaryDto` gained `Held` (count) and `TotalTips` (sum of
  `TipAmount` over paid orders).
- **Frontend**: `ORDER_STATUS` map gained a `"held"` entry (amber). Footer gained a **Hold** button (pause icon,
  shown only when `status === "open"`) and a **Recall Order** button (shown only when `status === "held"`); the
  existing "Bill & Pay" and "Split Bill" buttons now also exclude `status === "held"` from their visibility
  conditions (a held order shows only Recall until resumed).
- **`RestaurantPayDialog` — Tip section + fixed a pre-existing staleness bug.** The dialog previously read
  straight off the `order` prop, so after posting a payment the displayed Paid/Outstanding stayed stale until
  the parent's 15s-interval query happened to refetch and hand down new props (the payment mutation itself
  never fed back into what the dialog showed). Fixed by shadowing `order` into local `displayOrder` state
  (`useEffect` re-syncs when the prop changes) and updating it directly from every mutation's response
  (`post()` and the new `applyTip()` both call `setDisplayOrder(updated)`), so both payments and tips now
  reflect immediately without waiting on a refetch. New **Tip** panel: quick 10/15/20% buttons (computed off
  `subTotal`) + a "None" reset + a custom-amount input, shown whenever the order isn't closed (hidden once
  paid/cancelled/split/held, but still shown read-only if a tip was already set).

### Build / Verification Status
- **Restaurant.API standalone build:** 0 errors, 0 warnings ✅. **Full backend solution:** 0 errors, 21
  pre-existing warnings (NU1903 advisories + MSB3277 Serilog version-conflict noise, unrelated to this change) ✅.
- **Frontend `tsc --noEmit`:** 0 errors ✅.
- Migration `AddOrderTipAndHold` created (auto-applies on next startup).
- **Pending (needs republish + restart):** live spot-check — set a tip via each quick-percent button and via
  custom amount, confirm Outstanding updates immediately in the dialog; pay in full and confirm the tip is
  included in what's collected; hold an open order, confirm Bill & Pay / Split Bill / Send to Kitchen all
  disappear and only Recall remains; recall it and confirm normal actions return; attempt to pay/void-item/
  add-items/split a held order via a direct API call → `409`.
- **Epic 3 (Structured Ordering) is now fully complete** — all four features shipped: Discounts/Voids/Refunds
  (19c), Structured Modifiers (19d), Split Bills (19e), Tips + Hold/Recall (19f). Remaining flagged-not-built
  items across the epic: a dedicated "Modifier Groups" admin page (API-only today) and partial-quantity
  splitting (whole-row assignment only, no splitting a single line's quantity across guests).

---

## Module 20 — Subscriptions & Billing (Stripe + PayPal) + public plan tiers

Connects the marketing pricing page (`vrodux.com/pricing`) to a real, enforced, self-serve subscription.
Previously the tiers existed only on the website: signup **hardcoded `PlanType.Starter`**, module access came
from whatever the user ticked in onboarding (plan limits bypassed entirely), and there was **no payment
integration of any kind**.

### ⚠️ `Tenant.Plan` is persisted as a STRING — the legacy rename is mandatory
`TenantConfiguration` uses `HasConversion<string>()` (nvarchar(30)), so existing rows literally hold
`'Starter'`/`'Business'`. The new catalogue reuses the name **Starter with a different meaning** (10 seats,
not 3). Migration `AddBillingAndRenameLegacyPlans` therefore starts with a data rewrite, mapped **by seat
limit, not by name**, so no tenant loses capacity:
```sql
UPDATE [identity].[tenants] SET [Plan]='Micro'        WHERE [Plan]='Starter';   -- 3 seats → 3 seats
UPDATE [identity].[tenants] SET [Plan]='Professional' WHERE [Plan]='Business';  -- 15 → 50
```
Order matters (Starter→Micro first clears the name before it's reused). Needs `SET QUOTED_IDENTIFIER ON`
(filtered unique indexes on `tenants`). `PlanDefinitions.LegacyAliases` maps `"Business"` defensively in case
the migration is ever partially applied.

### Plan catalogue (`PlanType` / `PlanDefinitions`)
`Micro(3) · Starter(10) · Professional(50) · Enterprise(∞)` — prices $159/$299/$849 monthly, $129/$249/$699
annual-per-month. Professional adds `pos, restaurant, recipe, hospitality` + multi-currency/API/custom reports.
The old module lists used **dead keys** (`inventory.basic`, `crm.basic`, `manufacturing`) that exist nowhere in
the `ModuleKey` union — which is why plan→module entitlement had never actually worked. Enterprise is
**never self-serviceable** (`SelfServePlans`); a crafted `?plan=enterprise` falls back to Micro.

### Entitlement is now a ceiling
`Tenant.ResolvedModules` **intersects** the onboarding picks with `Limits.Modules` (previously returned them
verbatim). The tenant's own industry-pack module is still force-added on **every** tier — packs are sold by
industry, not tier, so a Micro real-estate tenant keeps `real-estate`.
**Run `Backend/scripts/entitlement-impact-report.sql` (read-only) BEFORE deploying** — it lists every tenant
that would lose a module, plus seat-limit and expired-trial exposure.

### Subscription domain (schema `identity`)
`Subscription` (one per tenant), `SubscriptionInvoice`, `BillingWebhookEvent`. The **unique index on
(Provider, ProviderEventId) is the idempotency ledger** — both providers retry aggressively and can redeliver
after success; re-applying `invoice.paid` would extend a paid period twice. Our DB is the source of truth for
*entitlement*; the provider is the source of truth for *money*.

### Providers — `IBillingProvider` (Stripe, PayPal, Manual)
- **Stripe** (`Stripe.net`): hosted Checkout + Billing Portal (no PCI surface, free card/plan/cancel UI).
  Webhook verified with `EventUtility.ConstructEvent` over the **raw body** (`Request.EnableBuffering()` —
  model binding breaks the signature).
- **PayPal**: no maintained .NET SDK → typed `HttpClient` (same pattern as `MetaGraphClient`), OAuth2
  client-credentials + REST v1 `billing/subscriptions`; webhook verified via PayPal's
  `verify-webhook-signature` API. No hosted portal → reported as a failure so the UI uses in-app controls.
- Both **fail closed**: no signing secret configured ⇒ every webhook rejected. Tenant is reconciled from
  metadata/`custom_id` **we** set at checkout, never from the browser's return URL.
- Handlers live in `Identity.Infrastructure/Handlers/Billing/` (they need the Stripe SDK, which has no place
  in Application) — so **`Identity.Infrastructure` is now registered with MediatR** in both `Program.cs` files.

### Trial lifecycle + lockout (data is NEVER deleted)
`TrialLifecycleService : BackgroundService` — daily, 5-min startup delay (never add work to the boot path;
the deploy health window is unforgiving), fully try/catch-guarded. Emails at **15/7/3/1 days** then on lapse,
idempotent via `Tenant.LastTrialReminderDaysLeft`; expires lapsed trials.
**`SubscriptionEnforcementMiddleware` already existed** and blocks Expired/Suspended/elapsed-trial tenants —
the gap was that `/api/billing/` wasn't exempt, so a lapsed tenant was locked out of the very endpoints
needed to pay. Now bypassed, and `subscription-expired.tsx` gained a **"Choose a plan"** CTA.
`ISubscriptionAccessCache` drops the middleware's 60s cached decision the instant a payment lands, so paying
restores access immediately rather than after a delay.

### Signup flow
`?plan=&billing=&intent=&utm_source=` captured by `useSignupAttribution` (sessionStorage — the params live
only on the entry URL and the form is multi-step), shown as a plan chip in the onboarding header, and passed
to `RegisterTrialCommand`. `intent=buy` → account created **on a trial**, then routed to checkout; only a
provider webhook ever activates the tenant.

### Frontend
`lib/billing/{plans.ts,billing.api.ts}`, `hooks/billing/use-billing.ts`,
`modules/settings/billing/components/billing-settings-view.tsx` (`/settings/billing`, deliberately **not**
module-guarded), `pages/billing/checkout-result.tsx` (polls our own API — the redirect is not proof of
payment), `components/billing/trial-banner.tsx` (JWT `trial_days_left`; only inside the final 15 days,
undismissable at ≤3). New JWT claims: `subscription_state`, `trial_days_left`.

### Gotcha fixed during build
`User.Email` is mapped with `HasConversion` (a value converter, **not** an owned type), so
`.Select(u => u.Email.Value)` compiles but is untranslatable and throws at query time. Project `u.Email`
whole and read `.Value` in memory.

### Build Status
- **Full ApiGateway:** 0 errors ✅ (only the pre-existing SmtpEmailService nullable warnings)
- **Frontend `tsc` (changed files) + `vite build`:** 0 errors ✅
- Migrations `AddBillingAndRenameLegacyPlans` + `AddBillingPermissions` created (auto-apply on startup).
- **Pending:** set `Billing__*` env vars (Stripe prices / PayPal plan ids / webhook secrets — see
  `.env.example`); run the impact report; then E2E: pricing-page CTA → signup → checkout → webhook activates
  → reminders → expiry → reactivate.

---

## Module 21 — Identity: Tenant recycle bin + deleted-tenant login guard

**Deleting a tenant was a one-way trip into invisibility.** `DELETE /api/admin/tenants/{id}` calls
`tenantRepo.Remove` → `BaseDbContext` converts it to `IsDeleted = true` → `TenantConfiguration`'s query filter
hides the row. There was no list of deleted tenants, no restore, and no permanent delete — the tenant and all
its data simply sat in the DB, unreachable.

### 🔴 The security half — a deleted tenant's users could still log in with a *less* restricted token
`LoginCommandHandler`/`RefreshTokenCommandHandler` both resolve `tenant` via `GetByIdAsync` (filtered) and then
happily continue with `tenant = null`. That is strictly worse than blocking: the issued JWT carries no
`tenant_id`/modules/`subscription_state` claims, so `SubscriptionEnforcementMiddleware` (which no-ops when
`tenantCtx.TenantId` is null) waves it straight through and the frontend falls back to a full module list.
**Fix:** both handlers now fail when `user.TenantId.HasValue && tenant is null` ("This workspace is no longer
available…"). The `HasValue` guard is what keeps super admins (legitimately tenant-less) working. Sessions
already in flight are covered separately: the middleware's `GetByIdAsync` returns null for a soft-deleted
tenant → `TENANT_NOT_FOUND` block, and `DeleteTenantCommandHandler` now calls `accessCache.Invalidate` so that
takes effect on the next request instead of up to 60 s later.

### Recycle bin (CQRS, `TenantsAdmin/Commands/RecycleBin/RecycleBinCommands.cs`)
- `GetDeletedTenantsQuery` → `GET /api/admin/tenants/deleted`; `RestoreTenantCommand` →
  `POST .../{id}/restore` (clears `IsDeleted`/`DeletedAt`/`DeletedBy`, invalidates the access cache so its users
  can log in again immediately); `PurgeTenantCommand` → `DELETE .../{id}/purge`.
- **Purge is only reachable for a tenant already in the recycle bin** (`Tenant.NotDeleted` otherwise) — so
  permanent loss always takes two deliberate actions, never one stray click.
- Repository gained `GetDeletedAsync` / `GetByIdIncludingDeletedAsync` (both need `IgnoreQueryFilters()` — the
  filter hides exactly the rows they exist to read) and `HardDeleteAsync`.
- **`HardDeleteAsync` gotcha:** `users.TenantId` is a real FK with `ON DELETE RESTRICT`, so deleting the tenant
  row alone **always** fails with an FK violation (every tenant has an admin user). It deletes, in one
  transaction: `audit_logs` → `subscription_invoices` → `subscriptions` → `users` (cascades refresh_tokens /
  user_roles / user_permissions) → `roles` (cascades role_permissions; legacy global `TenantId IS NULL` roles
  untouched) → `tenants`. Raw SQL is unavoidable — `BaseDbContext` turns any `EntityState.Deleted` back into a
  soft delete — so it commits on its own and the handler does **not** call `SaveChangesAsync`.
- **Scope:** purge clears the tenant's *identity* records only. Business rows in the other module schemas
  (crm/hr/finance/…) are keyed by a shadow `TenantId` with no cross-schema FK and are left in place —
  unreachable, not deleted. Wiping those is a DBA operation. The confirm dialog says what it actually removes.

### Frontend
- `tenants.api.ts` — `getDeleted` / `restore` / `purge`; `TenantDto.deletedAt` (backend `TenantDto` gained a
  trailing optional `DeletedAt`, populated by `TenantMappings`; null on every live tenant since every other
  query filters soft-deleted rows out).
- `modules/super-admin/components/deleted-tenants-panel.tsx` — slide-over listing deleted tenants (plan,
  contact, deleted date) with Restore, plus a permanent-delete modal that **requires typing the tenant name**.
- `super-admin-view.tsx` — header "Recycle bin" button with a count badge (`useDeletedTenantCount(binVersion)`;
  `binVersion` bumps on restore and on panel close, since a purge changes the count without a restore).

### Build / Verification Status
- **Full ApiGateway:** 0 errors ✅ (pre-existing SmtpEmailService warnings only) · **`vite build`:** ✅
  (`tsc -p tsconfig.app.json` errors are all pre-existing files — none in the ones touched here).
- **No migration** — uses the existing `AuditableEntity` soft-delete columns.
- **Pending (republish + restart):** delete a tenant → it disappears from the list, appears in the bin, its
  users can no longer log in or refresh; restore → it returns and login works again; purge → name-confirm,
  tenant + its users/roles/billing rows gone, no FK error.

---

## Module 22 — Billing: super-admin config screen (hybrid — secrets stay in env)

**Stripe/PayPal could only be configured by SSH-ing to the server and redeploying.** Module 20 shipped the
billing code but every knob lived in `Billing__*` env vars — rotating a key, flipping sandbox→live, or pasting
the 12 price/plan ids meant editing `/opt/vrodux/shared/.env` and restarting. Worse, the compose file never
mapped those vars in at all (fixed in the same pass), so the deployed gateway bound an **empty**
`BillingOptions`: both providers reported `IsConfigured == false`, and a "Buy Now" signup landed on the billing
page with no checkout to open.

### The split — and why it isn't "all of it in the UI"
Secrets (`Stripe:SecretKey`, `PayPal:ClientId`/`ClientSecret`, both webhook signing secrets) **stay in
environment variables**. A live payment secret in the app DB turns any DB read, injection bug or leaked backup
into "can charge cards as us" — the operational half doesn't carry that risk. So the new
`BillingSettings` row holds only: per-provider `Enabled`, `PayPalUseSandbox`, `Currency`, and the Stripe
price / PayPal plan id maps. The screen reports **whether** each env secret is present so an admin can tell
"turned off" from "turned on but missing credentials", but never reads a secret back, not even masked.

A provider is usable only when **enabled AND its secret exists AND it has ≥1 id** — the same test the checkout
path applies, so the screen can never report "ready" for something that would fail at checkout.

### Backend (Identity)
- `Domain/Entities/BillingSettings.cs` — single row on a well-known `SingletonId` (find-or-create, no "which
  row is current?" ambiguity). Blank ids are dropped rather than stored empty. Migration `AddBillingSettings`
  (one additive table, no data rewrite).
- `BillingSettingsConfiguration` — id maps stored as JSON. **Gotcha:** the `HasConversion` needs an explicit
  `ValueComparer`, or EF compares dictionaries by reference, never detects an in-place edit, and a save
  silently does nothing.
- **`BillingOptionsDbOverlay : IPostConfigureOptions<BillingOptions>`** — overlays the row on the env-bound
  options. Registered as a post-configure step (not a service callers opt into) so **every** consumer — both
  providers, the checkout handlers, the webhook handlers, anything added later — picks it up automatically;
  a separate "config service" would be silently missed by whoever forgot to use it. Reads through
  `IMemoryCache` (5-min backstop TTL, dropped on save) so the DB is hit at most once per TTL, and falls back
  to env on any exception — options are built during startup paths too, before migrations have run on a fresh
  DB, and throwing there would take down every billing request.
- ⚠️ **All 6 consumers switched from `IOptions<BillingOptions>` to `IOptionsSnapshot`.** `IOptions` resolves
  once per process, so it would freeze the config at first use and ignore every later save. Anything new that
  reads `BillingOptions` must use `IOptionsSnapshot` for the same reason.
- `GetBillingConfigQuery` / `UpdateBillingConfigCommand` + `BillingAdminController` at
  `/api/admin/billing-config` (`SuperAdminOnly` policy). The update response is rebuilt from the freshly-saved
  row rather than echoing the request — `options.Value` was built for the scope *before* the save, so it's
  stale by then.
- Stored in a dedicated `billing_settings` table, **not** `app_settings`: that table is global (no TenantId)
  and readable by any tenant admin through `GET /api/settings`, which would leak the platform's price ids.

### Frontend
- `lib/admin/billing-config.api.ts` — DTOs + `BILLABLE_PLANS`/`BILLING_CADENCES`/`idKey` (must stay in lockstep
  with the backend's `"Micro:Monthly"` key format). **Note the JSON casing:** `PayPal` camel-cases to
  `payPal`, not `paypal`.
- `modules/super-admin/components/billing-config-view.tsx` + `/super-admin/billing` route (inside the existing
  `RoleGuard roles={["super_admin"]}`) + a **Billing Setup** button in the console header. Per-provider status
  pill states the *specific* gap ("Disabled" / "Missing credentials" / "No price IDs"), a 3×2 id grid per
  provider, the exact webhook URL to register, the env var names for the secrets, and a prominent warning when
  **no** provider is usable — the state that silently breaks "Buy Now".

### Build / Verification Status
- **Full ApiGateway:** 0 errors ✅ · **Frontend `tsc` (touched files) + `vite build`:** 0 errors ✅
- Migration `AddBillingSettings` created (auto-applies on startup).
- **Pending:** deploy, then put the real secrets in `/opt/vrodux/shared/.env`, restart the api container, and
  fill in the price/plan ids from Super Admin → Billing Setup. Then E2E: pricing-page "Buy Now" → signup →
  checkout opens → webhook activates the tenant.

---

## Module 23 — CRM: Reporting system (8 reports) + the historical tracking they needed

**The CRM recorded current state but not when it changed**, so nothing could answer a time-based
question. `Deal` had `ExpectedCloseDate` (a forecast) but **no actual close date**; `Lead` had
`ConvertedDealId` but **no conversion timestamp**; and there was no stage-change history anywhere. The
existing `/crm/dashboard` is a filter-less snapshot. This module adds the missing history, then a
proper report section on top of it.

### New history (the enabling change)
- **`Deal.ClosedAt`** (`DateTime?`) — stamped the first time a deal enters `won`/`lost`, cleared if
  reopened, and **kept on re-save** so editing a won deal never moves it into another reporting period.
  Stamped from **all three** write paths: `MoveStage`, `Update` (the edit form can change stage too),
  and the ctor (a deal can be created directly closed).
- **`Lead.ConvertedAt`** (`DateTime?`) — set in `Convert(...)`, `??=` so a re-convert keeps the original.
- **`DealStageHistory`** (NEW, table `deal_stage_history`) — append-only transition trail
  `(DealId, FromStage, ToStage, Probability, ValueAtChange, DaysInFromStage, ChangedBy…)`.
  `ValueAtChange` snapshots the value so a later re-pricing cannot rewrite history.
  **`DaysInFromStage` is stored, not derived**: computing time-in-stage at query time needs a per-deal
  window function, which EF cannot translate and which scales badly. The duration is knowable at write
  time, so it is measured once. Reports then reduce to a plain `GROUP BY`/`AVG`.
  Clamped at 0 — clock skew must never drag a stage average negative.
- **`IDealStageRecorder`** (`Infrastructure/Services/DealStageRecorder.cs`) — the single writer, used by
  `CreateDealHandler` / `MoveDealStageHandler` / `UpdateDealHandler`. Centralised deliberately: a gap in
  any one path would silently corrupt the velocity reports rather than fail loudly. `RecordMoveAsync` is
  a no-op when the stage did not actually change, so callers invoke it unconditionally.
- Migration `AddCrmReportingHistory` (2 additive nullable columns + 1 table + indexes on
  `Deal.ClosedAt`, `Lead.ConvertedAt`, `(CreatedAt, ToStage)`).

### Backfill — approximate on purpose, and said so
`BackfillReportingDatesInBackgroundAsync` (`InfrastructureExtensions`, fire-and-forget on its own scope
like the lead-score repair, **never on the startup path** — a heavy job there delays `/health` and can
trip the deploy's health window). Fills `ClosedAt`/`ConvertedAt` from `UpdatedAt ?? CreatedAt`.
**These dates are approximate**: the true moment was never recorded, and `UpdatedAt` on a closed deal is
usually the close itself. The alternative — leaving them null — drops every historic deal out of every
report, which reads as "we never sold anything". Reporting is exact from deploy onward. Idempotent
(only ever fills a NULL), fully `try/catch`-guarded.

### The 8 reports (`/api/crm/reports/*`, all read-only)
`Application/Reports/{Dtos,Queries}` + `Infrastructure/Handlers/Reports/*` + `CrmReportsController`.
A shared `ReportFilter(From, To, OwnerUserId, Source, Stage, CustomerId)`; each report documents **which
date** the range applies to, because "deals in July" means different things per report — surfaced in the
UI and stamped into every export.

| Report | Route | Range applies to |
|---|---|---|
| Sales Pipeline (stage + forecast category, weighted) | `/pipeline` | deal created (open deals have no close date) |
| Win / Loss (trend, win rate, loss reasons) | `/win-loss` | deal closed |
| Team Performance (per-owner scorecard) | `/performance` | closed deals + lead/activity created |
| Lead Source ROI | `/lead-sources` | lead created |
| Lead Conversion (funnel, trend, time-to-convert) | `/conversion` | lead created |
| Sales Velocity (stage duration, cycle length) | `/velocity` | stage change |
| Activity Report (volume, completion, overdue) | `/activities` | activity created |
| Account Revenue | `/accounts` | deal closed |

**Every handler runs through `ILeadAccessGuard`** (`ScopeReadable`/`ScopeDeals`/`ScopeCustomers`/
`ScopeActivities`), so a report can never become a side channel to totals the caller could not open in
the list screens — a rep sees their own numbers, a team lead their team's. Velocity scopes history by
joining to the visible-deal ids (the history table has no owner of its own).

**Every handler also applies `!IsDeleted` by hand** — the tenant global filter replaces any entity-level
soft-delete filter (the recurring CRM/Visa/Restaurant gotcha), so a report that forgets it silently
counts deleted rows and disagrees with the list screens.

### Design decisions worth knowing
- **Lead-source won-value is traced lead → `ConvertedDealId` → deal**, not matched on `Deal.Source`. A
  deal's own source field is free-form and frequently differs from the originating lead's.
- **Account revenue reports `WonValue` and `RecordedRevenue` side by side** rather than merging them.
  `CrmCustomer.TotalRevenue` is manually maintained and often disagrees with the deal data; quietly
  picking one would hide that. The UI says so.
- **The conversion funnel is a snapshot, not a cohort**: leads have no per-status history (only
  opportunities do), so a lead at "qualified" is counted there and not also at "contacted". Documented on
  the handler so the step rate is not read as something it isn't.
- **Velocity returns `HasHistory`/`HistoryNote`** — stage timings only accrue from deploy, so the UI
  states that instead of showing an empty chart that reads as "no deals move". Cycle length works
  immediately (created → closed), independent of the history table.
- `Rate()` returns 0 on a zero denominator — never `NaN`, which reaches the UI as "NaN%" and breaks
  `double.NaN` JSON serialisation.
- **Bug caught in self-review:** the performance scorecard keyed leads/deals by owner **id** but
  activities by owner **name** (`Activity` has no owner id), so every user appeared as two rows — one
  with their revenue, one with their activities. Fixed with a name→bucket index so name-only records
  join the existing id-keyed bucket.

### Permissions — new `crm.reports` group
`PermissionSeedData`: `["crm.reports"] = ["view","export"]`, migration `AddCrmReportsPermissions`
(Identity; auto-applies + `SyncAdministratorPermissionsAsync` grants it to every Administrator on
startup). Separate from the record permissions on purpose — reports aggregate across leads,
opportunities, accounts and activities, so seeing them is its own decision. Data is still tier-scoped.
Controller is class-level `[RequirePermission("crm.reports.view")]`; the frontend Export button is gated
on `crm.reports.export`.

### Frontend
- `lib/crm/reports.api.ts` (typed client + catalogue), `hooks/crm/use-crm-reports.ts` (8 queries,
  2-min `staleTime`, content-based cache keys so empty/undefined filter fields don't fragment the cache).
- `modules/crm/reports/components/` — `reports-view.tsx` (catalogue hub → report, date presets computed
  dynamically **not** hardcoded, owner/stage filters, one Export button), `report-panels.tsx` (the 8
  panels), `report-primitives.tsx` (`StatTile`/`ReportCard`/`BarList`/`ReportTable`/empty+error states),
  `report-export.ts` (panels register a `{title, subtitle, columns, rows}` payload; the hub's single
  `ExportMenu` serves CSV via `toCsv` and PDF via `exportPdf`). The registration signature includes the
  subtitle so an export is never stamped with the previous filter's scope.
- Route `/crm/reports` inside `ModuleGuard module="crm"`, nav item "Reports" (icon `BarChart3`),
  page-level `<Can permission="crm.reports.view">` with a clear denial message rather than 8 × 403.
- **Fully translated (en + ar), key parity verified** — CRM is a 100 %-translated module, so an
  English-only section would have been a regression. Reuses the existing `crm:stage.*`/`source.*`/
  `forecast.*`/`activityType.*`/`funnel.*` label keys rather than duplicating them. `useReportFormat()`
  handles month names + day pluralisation per locale (Arabic has six plural forms — a hand-rolled
  `n === 1` check gets it wrong). RTL-safe (`ms-`/`me-`, `text-start`, mirrored back chevron).

### Build / Verification Status
- **Full backend solution (`Softaxis.ERP.slnx`):** 0 errors ✅ (6 pre-existing warnings — Smtp nullable +
  NU1903 advisories). **CRM.API alone:** 0 errors, 0 warnings ✅
- **Frontend `vite build`:** ✅ · `tsc -p tsconfig.app.json`: **0 errors in any file this module touched**
  (279 pre-existing errors remain in 30 unrelated files — the known `tsc -b` strict-mode drift from
  Module 12, unchanged by this work).
- Migrations `AddCrmReportingHistory` (CRM) + `AddCrmReportsPermissions` (Identity) created — auto-apply
  on startup.
- **Pending (needs republish + restart per the on-prem deploy note) — not runtime-verified by the author:**
  1. Grant `crm.reports.view`/`.export`, open **CRM → Reports**, check all 8 render.
  2. Move a deal to Won → it appears in Win/Loss for the current month; the backfill dated historic
     deals (approximately — see above).
  3. Move a deal between stages twice → Velocity shows a non-zero average for the stage it left.
  4. Convert a lead → Lead Conversion's time-to-convert and the source's won value pick it up.
  5. Export CSV + PDF from two different reports → correct columns, and the subtitle reflects the
     **current** filter.
  6. Log in as a rep with only the assigned tier → the reports show only their own records.

### Module 23b — Surfacing CRM reports in the central Reports hub (+ runner routing fix)

The CRM reports above were initially built as their own section without checking `/reports` first —
**a central Reports hub already existed** (`modules/reports/`). This wires CRM into it.

**What the hub actually is:** a *tabular* report engine. Registry entries declare filters + preview
columns; `ReportRunnerModal` calls an API returning `ReportResult { rows, totalCount }`, renders a
generic table, exports it. Country-aware and regulator-tagged (built for Z-reports, VAT returns).

**Why the CRM reports are deep-linked, not migrated.** They are analytical — funnels with step
drop-off, won/lost split bars, forecast rollups, score-quality comparisons. Forcing them through
`{ rows, totalCount }` renders a conversion funnel as a 4-row table and discards the point. So:
- `ReportDefinition` gained **`href?`** (navigate instead of opening the runner), plus
  `requiresModule?: ModuleKey` / `requiresPermission?` for gating.
- `CRM_REPORTS` in `report-registry.ts` is **derived from the CRM module's own `REPORT_CATALOGUE`**, so
  hub titles/descriptions can never drift from the CRM section's. Each entry links to
  `/crm/reports?report=<id>`, gated on `crm` module + `crm.reports.view`. **Gated entries are hidden,
  not shown-and-denied** — a discovery surface should only advertise what the user can open.
- `reports-view.tsx`: `"CRM"` added to `ReportCategory` + `CATEGORY_CONFIG` (icon `Handshake`); merge
  includes the gated CRM entries; new `openReport()` navigates when `href` is set; the card's hover
  affordance reads **"Open Report"** (ExternalLink) instead of "Run Report" for deep links.
- `modules/crm/reports/reports-view.tsx` reads `?report=<id>`, **validates it against the catalogue**
  (a stale/hand-typed id falls back to the catalogue, not a blank panel) and strips the param via
  `setSearchParams(..., { replace: true })` so "back to catalogue" isn't undone on re-render.

**Runner routing fix (real bug found while integrating).** `handleRun` was
`if (category === "Inventory") inventoryApi else posApi`. The hub also renders `STATIC_REPORTS` —
**14 Finance/Sales/Purchase/HR/Real Estate/Construction reports defined inside `reports-view.tsx`**,
none of which have a backend. Clicking Run on any of them POSTed to the **POS** reports endpoint and
surfaced a confusing API error. Replaced with a `CATEGORY_RUNNERS` map (`POS` → `reportsApi`,
`Inventory` → `inventoryReportsApi`); an unmapped category now throws a clear *"{Category} reports
aren't connected to a data source yet"*. `CRM` is deliberately unmapped and never reaches the runner.

- **Build:** `vite build` ✅ · `tsc -p tsconfig.app.json`: **279 errors, unchanged from before this work**,
  none in any touched file. No backend change, no migration.
- **Pending (needs the same republish + restart):** Reports hub shows a **CRM** category with 8 cards →
  clicking one lands on that exact CRM report → the category is absent for a tenant without the CRM
  module or a user without `crm.reports.view`.

### Module 23c — Reports hub: remove unbacked reports, gate by subscribed modules

Two follow-ups on 23b, both user-requested after seeing the hub.

**1. The 14 static reports are deleted, not just fixed.** `STATIC_REPORTS` (Finance / Sales / Purchase /
HR / Real Estate / Construction) was a hardcoded array inside `reports-view.tsx` with **no backend at
all**. 23b made them fail honestly, but a report that cannot run should not be advertised at all —
removed outright. The hub now lists **only reports that actually execute**: POS (19) + Inventory (17)
from the registry, plus the 8 deep-linked CRM reports. The `CATEGORY_RUNNERS` map from 23b stays; it is
the guard that stops a future unbacked category from silently hitting the wrong service.

**2. Every report is gated on the tenant's subscription.** New `CATEGORY_MODULE: Record<ReportCategory,
ModuleKey>` in the registry maps each category to its module (`POS` → `pos`, `Inventory` → `inventory`,
`CRM` → `crm`, …). The hub filters on `hasModuleAccess(r.requiresModule ?? CATEGORY_MODULE[r.category])`.
It is a **full `Record`, not `Partial`**, on purpose: adding a category without deciding its module is
then a compile error rather than a category that silently shows to every tenant.

This is genuine subscription gating, not merely permissions — `hasModuleAccess` step 3 hard-gates on
`tenant.enabledModules` for **everyone, tenant admins included**, and Module 20 derives that list by
intersecting the onboarding picks with the plan's `Limits.Modules`. A Micro-plan tenant without POS
therefore sees no POS reports.

**Knock-on UI fixes** — both were quietly wrong once filtering applied:
- Quick Stats tiles hardcoded "POS Reports" and "Inventory Reports", which read a permanent `0` for any
  tenant without those modules. Now the tenant's **two largest subscribed categories**, computed.
- The empty state always said "No reports match your search". A tenant whose plan includes no reporting
  modules was sent hunting for a typo. Now distinguishes **"No reports available on your plan"** from a
  genuine search miss.

- **Build:** `vite build` ✅ · `tsc -p tsconfig.app.json`: **279 errors, unchanged** — none in a touched
  file. Frontend-only; no backend change, no migration.
- **Pending:** confirm on a tenant lacking POS that no POS category or cards appear, and that the stat
  tiles and empty state read correctly on a minimal plan.
---

## Module 24 — 🔴 Identity: app_settings unique index missing TenantId (settings save broken for every tenant)

**Reported as "can't change VAT from 17% to 5%"; the actual failure was `Cannot insert duplicate key …
IX_app_settings_Category_Key … (notifications, emailSystem)`.** VAT was incidental — Settings saves the
whole category map in one `UpsertAllSettingsCommand`, so an unrelated key aborted the batch. **No tenant
could save any setting, in any category.**

### Root cause
`AppSetting` is tenant-scoped (`TenantId`) and `AppSettingRepository.Scoped()` correctly filters reads by
tenant — but the two unique indexes did **not** include `TenantId`:
```
IX_app_settings_Category_Key         UNIQUE (Category, Key)         WHERE UserId IS NULL
IX_app_settings_Category_Key_UserId  UNIQUE (Category, Key, UserId) WHERE UserId IS NOT NULL
```
So a company-wide setting key was unique **across the entire platform**. Confirmed against the live dev DB:
all **65** `app_settings` rows carry `TenantId = NULL` (legacy rows predating tenant scoping) while **8**
active tenants exist. Sequence:
1. Tenant reads settings → `Scoped(tenantId)` matches no NULL-tenant row → screen shows frontend defaults.
2. Tenant saves → `UpsertAllSettingsCommandHandler` finds no row to update → `Add(new AppSetting(...))`.
3. Insert hits `IX_app_settings_Category_Key`, which ignores `TenantId` → collides with the legacy row → throw.

The same shape as the Module 6a `Role.TenantId` leak: an entity that is tenant-scoped in code but not in
its database constraints.

### Fix
- `AppSettingConfiguration` — both unique indexes now lead with `TenantId`:
  `UNIQUE (TenantId, Category, Key) WHERE UserId IS NULL` and
  `UNIQUE (TenantId, Category, Key, UserId) WHERE UserId IS NOT NULL`.
  SQL Server treats NULLs as equal for uniqueness, so the legacy `TenantId IS NULL` rows stay unique among
  themselves and no longer collide with any tenant's own row.
- Migration `FixAppSettingsTenantUniqueness` — drop + recreate. **Widening a unique index cannot fail on
  existing data** (it only permits more rows), so it is safe to apply to a populated database.

### Second, independent path to the identical error — also fixed
`UpsertAllSettingsCommandHandler` matched existing rows with `s.Key == key`, i.e. **C# ordinal
case-sensitive**, while the SQL indexes live under a **case-insensitive collation**. A payload sending
`EmailSystem` where the DB holds `emailSystem` would miss the match, insert, and fail on the index with the
same duplicate-key message. Now matched with `StringComparison.OrdinalIgnoreCase` for both Category and Key.
Newly-added rows are also appended to the in-memory `existing*` list, so a case-variant of the same key
later in the *same* payload updates the pending row instead of queueing a second insert.

### Verified (not "pending" — actually run)
- Migration **applied to the local dev DB** (`SHAHBAZ-QFINITY / SoftaxisErpDb`); `sys.indexes` confirms
  `IX_app_settings_TenantId_Category_Key` and `IX_app_settings_TenantId_Category_Key_UserId`.
- **Reproduced the exact failing insert** (`notifications` / `emailSystem` for a real tenant id) against the
  fixed schema inside `BEGIN TRAN … ROLLBACK` → **succeeded** where it previously threw; rolled back, so no
  data changed (row count unchanged at 1).
- **Identity.API build:** 0 errors ✅. Full-solution build could not complete — the running
  `Softaxis.ApiGateway` (PID 6836) holds a lock on shared BuildingBlocks DLLs; that is a file lock, not a
  compile error, and the process was left running rather than killed.

### Deploy note — the reported bug is already unblocked
The index lives in the **database**, and the migration is applied, so the currently-running build can save
settings now with no republish. The handler's case-insensitive matching is a hardening fix that needs the
usual republish + restart, but is not required for the reported failure.

### Flagged, NOT actioned — 65 orphaned `TenantId = NULL` rows
Every existing `app_settings` row is a legacy NULL-tenant row. They are invisible to all 8 tenants (reads
are tenant-scoped) and are now harmless, but they cannot be attributed to a tenant automatically and
deleting them is a data decision for the owner. Left in place; each tenant will create its own rows from
the next save onward. A super-admin (null tenant context) still sees them.

---

## Module 25 — Identity: `reports` permission group (the Reports module could not be granted to anyone)

**Reported as "Roles & Permissions shows Reports under CRM, and granting it doesn't unlock the Reports
module."** Two separate things, one of them a real gap.

### Why "Reports" appeared under CRM — working as intended
The key is `crm.reports.*`. `groupPermissions` buckets by the first segment (`crm`) and `moduleLabel`
renders the remainder (`Reports`) as the row. That is correct: `crm.reports.view` governs the **CRM
report data** (scoped by the CRM lead/pipeline/customer tiers), not the hub. Same shape as
`pos.reports.*` and `restaurant.reports.*`.

### The real gap — no `reports` permission group existed
Grep confirmed the only report keys were `pos.reports`, `crm.reports`, `restaurant.reports` — all
module-scoped. The standalone hub at `/reports` had **zero permission keys**, so no role could be
granted access to it.

`/reports` is guarded by `<ModuleGuard module="reports" />` → `hasModuleAccess("reports")`:
- step 3 `tenant.enabledModules.includes("reports")` — passes (`reports` is in `PlanDefinitions`' base
  module set, so every plan has it),
- step 4 tenant_admin / manager → true,
- step 6 `ROLE_DEFAULTS` → only legacy role names (`hr_manager`, `accountant`, `sales_rep`, …),
- step 7 `user.permissions.some(p => p.startsWith("reports:"))`.

Step 7 is the intended hook for custom roles, and it works — but `toFrontendPermission` derives the
`reports:` prefix from a backend key's **first segment**, and no `reports.*` key existed to produce one.
So outside tenant admins and a handful of legacy role names, **nobody could be given the Reports module**.

### Fix
- `PermissionSeedData` — new `["reports"] = ["view","export"]`, commented to distinguish it from the
  per-module `*.reports` keys. Migration `AddReportsModulePermissions` (2 rows). Existing tenants'
  Administrator roles gain it automatically via the idempotent `SyncAdministratorPermissionsAsync` on
  next startup; custom roles need an explicit grant, which is the point.
- `permission-matrix.ts` — `reports: "Reports"` in `MODULE_GROUPS`, `"Reports"` in `GROUP_ORDER`
  (before Settings), so it renders as its **own group**, not under CRM.
- `moduleLabel()` bug — single-segment ids were returned verbatim. `reports` is the first such id, so it
  would have rendered lowercase beside every other title-cased row. Now title-cased.

### Second bug found while verifying the chain — per-user overrides didn't affect module access
`mapUserDto` built `user.permissions` (what `hasModuleAccess` step 7 reads) from `dto.roles[].permissions`
**only**, ignoring the Module 5h per-user grant/deny overrides — while `extractRawPermissions` (what
`hasRawPermission` reads) applies them. Consequence: a permission granted to a single **user** rather
than through a role satisfied `hasRawPermission` but not `hasModuleAccess` — the button unlocked while
the module stayed hidden. A deny had the mirror problem: revoked at the button, still granting the
module. `mapUserDto` now derives from `extractRawPermissions(dto)`, so both paths use the same effective
`(roles ∪ grants) − denies` set.

### Verified
- **Identity.API build:** 0 errors ✅ · **Frontend `tsc`:** 279 errors, **unchanged baseline**, none in a
  touched file · **`vite build`:** ✅
- Migration **applied to the local dev DB**; `identity.permissions` now contains `reports/view` and
  `reports/export`. Confirmed **0** Administrator roles hold them yet — as expected, the sync runs at
  startup.

### To actually use it (needs restart + re-login)
1. Restart the API → `SyncAdministratorPermissionsAsync` grants `reports.*` to all 9 Administrator roles.
2. Settings → Roles & Permissions → the custom role → new **Reports** group → tick **View**.
3. **The user must log out and back in** — permission keys are embedded in the JWT at login/refresh, so
   an existing session keeps the old claim set until the token is re-issued.

---

## Module 26 — File Manager folder tree + Reports report-type level (owner-scoped, tier-enforced)

Requested: File Manager as `Module → Team member → Document type → files`, Reports as
`Reports → Module → Report type → Report`, both showing only what the caller is permitted to see —
admin all teams, team lead their team, member their own.

### 🔴 Security bug found and fixed first
`SearchCrmDocumentsHandler` — the query the File Manager runs — access-checked **lead documents only**.
Deal, account and contact documents were returned to anyone who could open the library, so a rep saw
files attached to other reps' opportunities. The class comment even documented this as intended
("documents on accounts/opportunities/contacts stay visible to anyone with the CRM view permission"),
which is directly at odds with the tiering the rest of CRM enforces.

Now every target type is scoped through its own guard — leads `ScopeReadable`, opportunities
`ScopeDeals`, accounts `ScopeCustomers`, contacts through their account. Stale comment rewritten.

**Also fixed two things in the same handler:**
- **N+1 removed.** The old per-row `CanManageActivityAsync` hit the database once per document (up to
  500 round-trips). Replaced by four set queries building an in-memory `(type, id) → owner` map.
- **Pagination was unfair to restricted users.** It took the newest 500 rows and *then* filtered, so a
  rep got only the visible remainder of a tenant-wide page — often almost nothing. Now a wider
  `fetchLimit` (2,000) feeds a `resultLimit` (500) of *visible* rows, so a rep fills a page with their
  own files while the query stays bounded.

### Owner = record owner, not uploader (deliberate)
`CrmDocumentDto` gained `OwnerUserId` / `OwnerName`, resolved from the linked record: lead →
`AssignedToUserId`, deal → `AssignedToUserId`, account → `AccountManagerUserId`, contact → its
account's manager. **Not** `UploadedByUserId`, which already existed: a manager uploading a contract
onto a rep's deal must still file under that rep, or the rep's folder understates their own book.
Documents whose record is unassigned go to an explicit "Unassigned" folder rather than being dropped.

### File Manager (`file-manager-view.tsx`, rewritten)
`Module → Owner → Document type → files`, with breadcrumbs, an "Up" control, and the existing
grid/list toggle, preview and download preserved.
- **Searching flattens the tree** (standard file-manager behaviour — finding a file by name shouldn't
  require knowing its folder). Cards then name the owner, since folder context is gone.
- **Your own folder sorts first**, then by volume.
- Module level lists only modules that both the tenant has AND that actually store files — today just
  CRM, so no empty drawers are advertised.
- Stat tiles changed Categories → **Owners** (the level that now matters).
- The client never filters for security; it only lays out what the tier-scoped API returned.

### Reports hub — report-type level
`ReportDefinition.subGroup?` added; `CRM_REPORTS` maps it from the CRM catalogue's own
Sales / Leads / Accounts grouping, so there is one source of truth. The hub renders sub-headings
**only for categories that declare them** — POS and Inventory keep their flat grid rather than being
given an invented grouping to fill the level. Module gating from 23c is unchanged, so a category only
appears if the tenant's subscription includes it.

### Access tiers — already enforced, now visible
Report *data* was already tier-scoped (Module 23). Documents now are too. Neither relies on the
frontend: an admin sees every rep's folder, a team lead their team's, a rep only their own, because
the API returns only those rows.

### Scope boundaries — flagged, NOT built
- **Only CRM has a document store.** Finance holds a single receipt blob per expense
  (`Expense.ReceiptData`) — not a library; Visa's `CaseDocument` stores a **URL**, not a file; HR,
  Purchase, Sales, Inventory and the industry packs have no file storage at all. A shared documents
  service every module can attach to is a separate, much larger project (chosen against in scoping).
- **Report permissions stay per module** (`crm.reports.view` covers all 8) — per-group or per-report
  keys were considered and deliberately not taken.
- No upload from File Manager: there is no generic upload target, files attach from a record's
  Documents tab. Unchanged.

### Build / Verification Status
- **CRM.API:** 0 errors, 0 warnings ✅ · **Frontend `tsc`:** 279 errors, **unchanged baseline**, none in
  a touched file · **`vite build`:** ✅ · No migration (DTO/query change only).
- **Pending (needs republish + restart):** log in as admin → every rep's folder; as a team lead → only
  their team's; as a rep → only their own, with their own folder first. Confirm a document on a deal
  owned by another rep is **no longer** visible to a restricted user (the security fix). Confirm the
  CRM category in Reports shows Sales / Leads / Accounts sub-headings while POS stays flat.

---

## Module 27 — Identity: `file-manager` permission group (+ File Manager was ungated for everyone)

Follow-up to Module 25's `reports` group. Same defect, different module: **File Manager had no
permission keys at all**, so it could not be granted or withheld — and worse, it was not merely
ungrantable but *unconditionally open*.

### The gap
`hasModuleAccess` step 2 listed `file-manager` alongside `dashboard` / `notifications` /
`ai-assistant` as an "always-on UI module" and returned `true` before any role, plan or permission
check ran. So **every authenticated user could browse the CRM document library**, regardless of role.
Nothing in Settings → Roles & Permissions could change that, because no `file-manager.*` key existed
for the matrix to render.

### Fix
- `PermissionSeedData` — `["file-manager"] = ["view","export"]`. `view` opens the browser; `export`
  covers taking a copy off the system, which is a separate decision from being able to look at a
  file. Migration `AddFileManagerPermissions`, applied.
- `permission-matrix.ts` — `"file-manager": "File Manager"` in `MODULE_GROUPS`, placed in
  `GROUP_ORDER` between Reports and Settings, so it renders as its own group.
- `auth.store.ts` — `file-manager` **removed from the always-on list**, so it now falls through to
  the normal checks. `file-manager` is in `PlanDefinitions.CoreModules` (every plan), so step 3
  passes for all tenants and the decision lands on role/permission where it belongs.
- `file-manager-view.tsx` — download actions gated on `file-manager.export`; `DocumentPreviewModal`'s
  `onDownload` is now optional and its button hidden when omitted, so the preview modal cannot be
  used as a download bypass.

### ⚠️ Behaviour change — this one can lock people out
File Manager goes from "open to everyone" to "requires a grant". Impact:
- **tenant_admin / manager** — unaffected (step 4 passes them).
- **Legacy role names** (`hr_manager`, `accountant`, `sales_rep`, `purchase_officer`,
  `warehouse_manager`, `viewer`) — unaffected, `ROLE_DEFAULTS` lists `file-manager` for each.
- **Custom roles** (e.g. "CRM Team Lead") — **lose File Manager until granted**. That is the point of
  the change, but it is a visible regression for anyone relying on the old open access, so grant
  `file-manager.view` to the roles that need it as part of the same deploy.

### Note on the reported symptom
The screenshot showed **REPORTS (1 module)** already present — Module 25 landed correctly; the group
was simply collapsed, and expanding it reveals the `Reports` row with View / Export. The genuinely
missing one was File Manager, addressed here.

### Build / Verification Status
- **Identity.API:** 0 errors ✅ · **Frontend `tsc`:** 279 errors, **unchanged baseline** · **`vite
  build`:** ✅
- Migration applied to the dev DB; `identity.permissions` now holds `reports/view`, `reports/export`,
  `file-manager/view`, `file-manager/export`.
- **Pending (restart + re-login):** `SyncAdministratorPermissionsAsync` grants all four keys to every
  Administrator role on startup. Then grant `reports.view` and `file-manager.view` to the custom
  roles that need them, and have those users **log out and back in** — permission keys are embedded
  in the JWT at login, so an existing session keeps the old claim set.

### Module 28 — Team Performance report grouped by team (visibility follows who leads what)

The scorecard was a flat owner list, so a manager could not compare teams and a team lead saw a
mixed list rather than "my team". Now grouped: `Reports → CRM → Team Performance → Team A … Team N`.

### Visibility — derived, not configured
New `ILeadAccessGuard.VisibleTeamsAsync()` returns the teams the caller may report on:
- **Full access / super admin** (`crm.leads.view`) → every active team in the tenant.
- **Anyone else** → only teams where they are the `TeamLeadUserId`. A rep who leads nothing gets an
  empty list, so team grouping shows them nothing rather than a team they shouldn't see.

**Tenant scoping had to be explicit.** `IdentityTeamView` lives in `Softaxis.CRM.Infrastructure`, not
`.Domain`, so `TenantIsolation.ApplyTenantId` deliberately skips it — it carries Identity's own
`TenantId`. The existing team queries never needed a tenant filter because they were inherently
user-scoped (`TeamLeadUserId == me`); the new "all teams" branch is not, so it filters on
`TenantAmbient.TenantId` by hand. An unresolved tenant matches **nothing** rather than everything.
`IdentityTeamView` gained `Name` (it previously carried only ids and flags).

### Shape
`TeamPerformanceDto(TeamId, TeamName, TeamLeadName, Members[], TotalLeads, TotalWonDeals,
TotalWonValue, TotalOpenValue)`; `SalesPerformanceReportDto` gained trailing optional `Teams` and
`Ungrouped`. The flat `Owners` list is retained, so nothing that already consumed it breaks.

Two deliberate calls:
- **A user in several teams appears under each.** Their numbers genuinely count toward every team
  they belong to; showing them in only one would make the other team's totals wrong.
- **`Ungrouped` is surfaced explicitly** — visible owners in none of those teams, including legacy
  rows keyed by owner *name* with no user id (which can never match a team). Without it, a person's
  numbers would silently disappear the moment team grouping turned on just because nobody put them
  in a team.

### Frontend
`PerformancePanel` renders one card per team (lead name, members-with-activity count, team revenue
total) plus a "Not in a team" card when relevant. **Falls back to the flat table when no teams are
visible**, so a tenant that hasn't set teams up sees the report it had rather than an empty page.

Export now carries a **Team** column with one row per (team, member) so the file matches the screen;
the team-less case exports as before with "—".

The member count label reads "N with activity", not "N members" — it counts members who own records
in the period, not the team roster, and the old wording would have been read as team size.

Translations added to en + ar.

### Build / Verification Status
- **CRM.API:** 0 errors, 0 warnings ✅ · **Frontend `tsc`:** 279, unchanged baseline · **`vite build`:** ✅
- No migration — reads Identity's existing `teams` / `team_members` through the cross-schema views.
- **Verified against live data (Qfinity tenant):** teams are `Warsan` (lead: Aslam; members: Ahmed,
  Aslam) and `Business Bay Team` (no lead; members: Ghafoor, Mujtaba). So an admin should see both
  team cards; Aslam should see only **Warsan**. Ahmed's records land in Warsan.
- **Pending (republish + restart):** confirm the above, and that a team with no producing members
  still renders (a team producing nothing is a signal a manager wants, not noise to hide).

### Module 29 — Lead assignment pickers grouped by team

The reassign dropdown was a flat name list, so an assigner could not tell which team anyone belonged
to. Now grouped with `<optgroup>` per team.

### Backend — team names on the assignable pool
`assignable-users` is the only teams endpoint a restricted user can reach (`[Authorize]` only; the
teams list itself needs `settings.users.view`), so the team labels had to come from there rather than
from a second call the client couldn't make.

- `ITeamRepository.GetTeamNamesByUserAsync(userIds, tenantScope, ct)` → `Dictionary<Guid, List<string>>`.
  Joined **through the tenant-scoped team query**, so a membership row can never surface a team from
  another tenant.
- `TeamMemberDto` gained a trailing optional `IReadOnlyList<string>? Teams` — additive, so existing
  consumers are untouched.
- `GetAssignableUsersQueryHandler` fills it on both branches (admin → everyone; team lead → their
  members plus the leads they can hand work back up to).

### Frontend — one shared hook, two pickers
`useAssignableByTeam()` (`hooks/identity/use-assignable-by-team.ts`) returns `{ groups, options }`.
Used by **both** the reassign dialog and the create/edit lead form — they already shared
`useAssignableUsers`, and leaving one grouped and the other flat would have been an obvious
inconsistency the moment anyone used both.

**Many-to-many is handled explicitly**, as requested:
- Someone in several teams is listed under **each** of them. Dropping them from one would make that
  team look smaller than it is.
- Options are keyed `${team}-${userId}` — a user id alone is **not** unique across groups once the
  same person appears twice, and a duplicate React key silently breaks list reconciliation.
- People in no team fall into a trailing **"No team"** group rather than being omitted.
- The reassign dialog carries a one-line hint that a person under several teams belongs to all of
  them, so a repeated name doesn't read as a duplicate bug.

The pool itself is still decided server-side by the caller's tier — the hook only arranges, never
filters, so grouping cannot widen who a team lead may assign to.

Translations added (`drawer.noTeam`, `drawer.multiTeamHint`) in en + ar.

### Build / Verification Status
- **Identity.API:** 0 errors, 0 warnings ✅ · **Frontend `tsc`:** 279, unchanged baseline ·
  **`vite build`:** ✅ · No migration — reads existing `teams` / `team_members`.
- **Expected against live data (Qfinity):** an admin sees **Business Bay Team** (Ghafoor, Muhtaba) and
  **Warsan** (Aslam 👑, Ahmed); "Qfinity" has no team so it lands under **No team**. Aslam sees only
  Warsan.
- **Pending (republish + restart).**

---

## Module 30 — 🔴 CRM: records carry their own team (ownership alone could not say whose work it is)

**Reported as "why is Aslam seeing this lead — he isn't lead of that team?"** He was: the lead is owned
by **Ahmed**, who belongs to **Warsan** (led by Aslam) *and* **Team D** (led by New CRM Team Lead Test).
The old rule — *"is this record's owner in a team I lead?"* — answers **yes for both leads**.

Not an implementation bug: a modelling gap. Records were owned by a **person**, and a person can be in
several teams, so nothing recorded *whose work* a record was. Module 29's team-grouped picker made it
visible — Ahmed appeared under both teams, but picking either stored the same owner and no team.

### The model change
`Lead`, `Deal` and `CrmCustomer` gained **`TeamId`** (nullable) + `AssignTo(userId, name, teamId)` and a
`BackfillTeam` hook. Assigning now records **who** and **which team's work**. Unassigning clears the
team — a record with no owner belongs to no team.

### The visibility rule (query and per-record check, kept identical)
```
own it                                  → visible
TeamId set    → only that team's lead   → visible to the lead of THAT team alone
TeamId null   → fall back to owner membership (previous behaviour)
```
The null fallback is the safety net: nothing vanishes from a team lead's view on deploy day.
`OwnerAllowedAsync` gained the same `teamId` parameter so single-record reads/edits and
`CanManageActivityAsync` (activities + documents) cannot diverge from the list query — a lead you
can't see in the list is one you can't manage attachments on either. New `LedTeamIdsAsync`,
cached per request like `TeamUserIdsAsync`.

### Backfill — only where unambiguous (as chosen)
`BackfillRecordTeamsInBackgroundAsync` tags records whose owner belongs to **exactly one** active team.
Owners in several teams — the very case that broke the model — are **left untagged**, because guessing
one would silently remove a record from a team lead who legitimately had it. Fire-and-forget on its own
scope (never on the startup path), idempotent, `try/catch`-guarded. Cross-schema `HAVING COUNT(DISTINCT
t.Id) = 1` read; `TeamId` selected as string because SQL Server's `MIN()` rejects `uniqueidentifier`.

**Verified against live data:** ghafoor and newteamlead have one team each → their records get tagged.
**ahmed, mujtaba and aslam are in two** → left untagged, so **Zubair Ali stays visible to Aslam until
someone reassigns it and picks a team.** That is the deliberate consequence of not guessing.

### Assignment now submits the team
`TeamMemberDto.Teams` changed from `string[]` to `UserTeamRef(TeamId, Name)` — a picker needs to both
label *and* submit the team. `AssignLeadCommand`, `Create/UpdateLeadCommand`, `AssignReq` and `LeadDto`
all carry `TeamId`.

Frontend: a `<select>` holds one value, so options encode `userId::teamId` via
`encodeAssignee`/`decodeAssignee`. Picking Ahmed under **Warsan** files the lead to Warsan; picking him
under **Team D** files it to Team D. Wired into both the reassign dialog and the create/edit form.
`UpdateLeadHandler` re-stamps owner **and** team together, so an edit that changes the owner cannot
leave the record filed under the previous owner's team.

### Deals and Accounts wired too (no scope gap)
Their assignment forms use the same grouped picker and `encodeAssignee`/`decodeAssignee`, and
`Create/UpdateDealCommand`, `Create/UpdateCrmCustomerCommand`, both controller request records and
both DTOs carry `TeamId`. `UpdateDealHandler` / `UpdateCrmCustomerHandler` re-stamp owner + team
together, same as leads.

**`ConvertLeadHandler` also carries the team across.** Converting a team-filed lead previously
produced an untagged account and opportunity, which fall back to the owner-membership rule —
quietly undoing the lead's team context at the exact moment it becomes revenue. Both now inherit
the lead's `TeamId` alongside its owner.

### Build / Verification Status
- **CRM.API + Identity.API:** 0 errors ✅ · **Frontend `tsc`:** 279, unchanged baseline · **`vite build`:** ✅
- Migration `AddRecordTeamOwnership` (3 nullable columns + 3 indexes) created; backfill SQL validated
  against the live DB.
- **Pending (republish + restart):** reassign Zubair Ali to Ahmed **under Team D** → disappears for
  Aslam, appears for New CRM Team Lead Test; reassign under Warsan → the reverse. Confirm untagged
  legacy leads still show for both until explicitly filed.

### Module 31 — Untagged records no longer fall back to owner membership (+ bulk filing)

**Correction to Module 30.** That module kept a fallback: a record with no `TeamId` stayed visible to
every team lead the owner belonged to, so "nothing disappears on deploy day".

That was the wrong trade, and the reason is structural: **the fallback only ever fires for multi-team
owners**, because single-team owners get tagged by the backfill. So it was not a mild safety net — it
guaranteed the reported bug survived in precisely the case that caused it, until every affected record
was re-filed by hand. Verified on the live tenant: all three leads still `TeamId = NULL`, both team
leads still saw all of them, and every lead owner there is multi-team, so the feature achieved nothing.

### New rule
```
own it                → visible
TeamId set            → visible to the lead of THAT team
TeamId null           → owner + full-access roles only, never a team lead
```
Applied identically in `ScopeReadable` / `ScopeDeals` / `ScopeCustomers`, in `OwnerAllowedAsync`, and in
`CanManageActivityAsync` — a record a team lead cannot see in the list is one they cannot manage
activities or documents on either. Nothing becomes unreachable: owners keep their own records and
admins keep everything. The interface doc comment was rewritten; leaving it describing the old
membership rule would have been worse than no comment.

### Bulk filing (needed for this to be usable)
Sharpening the rule without a filing tool would just move the pain: existing records go invisible to
team leads with no practical way to tag them.
- `BulkFileLeadsToTeamCommand(LeadIds, TeamId)` → `BulkFileResultDto(Filed, Skipped)`;
  `POST /api/crm/leads/bulk-file-to-team`. **Every lead is still permission-checked individually** via
  `CanEditAsync` — a bulk action must not become a way to touch records the caller could not edit one
  at a time. Failures are skipped and counted rather than failing the batch, so one stray id in a
  selection does not lose the user's other work. Null `TeamId` un-files.
- `leads-view.tsx` — a selection column (header ticks only what is **on screen**, since silently
  selecting off-screen rows makes the count meaningless), and a filing bar that appears only while
  something is selected. Row checkbox `stopPropagation`s so ticking doesn't also open the drawer.
  Result toast reports filed and, separately, skipped.
- `useTeamsForFiling` derives the team list from the **assignable-users** pool rather than
  `/api/teams`, which needs `settings.users.view` a team lead does not have. So a lead can file to the
  teams they lead and an admin to any team.

### Bug caught while wiring this
`LeadsController.Update` did not pass `TeamId`, and `UpdateLeadHandler` re-stamps owner + team
together — so **editing any lead silently un-filed it**. `UpdateLeadRequest` now round-trips `TeamId`,
with a comment saying why it must.

### Build / Verification Status
- **CRM.API:** 0 errors, 0 warnings ✅ · **Frontend `tsc`:** 279, unchanged baseline · **`vite build`:** ✅
- No new migration (uses `AddRecordTeamOwnership`). Translations added en + ar.
- **Pending (republish + restart):** as an admin, select the Qfinity leads → file to **Team D** → they
  disappear for Aslam and appear for New CRM Team Lead Test; file to **Warsan** → the reverse. Confirm
  Ahmed still sees all of his own regardless, and that editing a filed lead keeps its team.

### Module 32 — 🔴 CRM dashboard 403s for every non-full-tier role (+ the UI hid it as "Loading…")

**Reported as "CRM dashboard shows only Loading CRM dashboard…".** Two independent defects, one
causing it and one hiding it.

### Cause — the dashboard was gated on the tenant-wide key only
`CrmDashboardController` carried `[RequirePermission("crm.leads.view")]`. Confirmed against the live
tenant: **CRM Team Lead has `crm.leads-team.view` but not `crm.leads.view`** — as do Real Estate Team
Lead and every assigned-tier role. So the endpoint 403'd for them. Only Administrator and CRM Manager
hold the full key.

Every other CRM read endpoint had already moved to `RequireAnyPermission(view, team-view,
assigned-view)` when the tiers were introduced (`LeadsController`, `ActivitiesController`); the
dashboard was missed. Now aligned — the handler already scopes each figure, so a team lead gets their
team's numbers rather than a permission failure.

### Leak that opening it up would have created — fixed in the same pass
`GetCrmDashboardHandler` scoped **leads** but not deals or activities; its own comment admitted
"deals are NOT lead-scoped". That was survivable only while the endpoint required the tenant-wide
key. Letting team-tier users in without fixing it would have handed a team lead the whole tenant's
pipeline value and open-task count. Both now go through `ScopeDeals` / `ScopeActivities`.

### Why it looked like an infinite load
`crm-dashboard-view.tsx` returned the loading message on `isLoading || !data`. On **error**,
`isLoading` is false and `data` is undefined — so a failed request rendered as "Loading…" forever and
the 403 was invisible. Replaced with a real error state: message, the server's reason, and a retry
button. `visa-dashboard-view.tsx` had the identical pattern and got the same fix.

This is why the symptom was so hard to place: the screen reported the wrong thing. A failing request
should never be indistinguishable from a slow one.

### Diagnosis notes (for next time)
Ruled out before finding it: schema (all three `TeamId` columns present, migration applied), data (all
three dashboard queries run clean in SQL), service health (`/health` 200, endpoint 401 unauthenticated
as expected), and build currency (gateway started after the latest DLL). The decisive step was
comparing `crm.leads.view` against `crm.leads-team.view` **per role** in the database.

### Build / Verification Status
- **CRM.API:** 0 errors, 0 warnings ✅ · **Frontend `tsc`:** 279, unchanged baseline · **`vite build`:** ✅
- No migration. Error-state translations added en + ar (crm + visa).
- **Pending (republish + restart):** open the CRM dashboard as Aslam — it renders with his team's
  figures instead of hanging; as the Administrator, totals are unchanged. Verify a team lead's pipeline
  value now reflects only their team's deals, not the tenant's.

### Module 33 — Bulk team filing for opportunities and accounts (what made Files + Reports hierarchical)

**Reported as "reports and file manager should work like leads hierarchically — a team lead can't
access team member files."** The plumbing was already right: documents scope through
`ScopeReadable`/`ScopeDeals`/`ScopeCustomers` (Module 26) and reports through the same guard
(Module 23). What was missing was **filed data**.

### Diagnosis against the live tenant
| Entity | Total | Filed to a team |
|---|---|---|
| Leads | 4 | 3 |
| Deals | 2 | **0** |
| Customers | 2 | **0** |

Module 31 had removed the untagged fallback, so an unfiled record is invisible to a team lead by
design. Bulk filing existed **only for leads** — deals and accounts could be filed one at a time via
their edit forms and nothing else. Consequence: a team lead's Pipeline, Win/Loss, Velocity and Account
Revenue reports were all empty (every one reads deals), and any document hanging off a deal or account
was unreachable. Nothing was broken in the scoping; there was simply no way to file the data.

Also confirmed while diagnosing: the one existing document sits on lead *Hamza Bhi*, now filed to
**Warsan** — Aslam's team — so that file is reachable to him; and the CRM Team Lead role already
holds `reports.view` / `file-manager.view` / `crm.reports.view`. Permission grants land in the JWT at
login, so a user granted them mid-session still needs to log out and back in.

### Backend
`BulkFileDealsToTeamCommand` / `BulkFileCustomersToTeamCommand` + handlers, and
`POST /api/crm/deals/bulk-file-to-team` / `POST /api/crm/customers/bulk-file-to-team`. Both mirror the
lead version exactly: **each record is still permission-checked individually** (`CanEditDealAsync` /
`CanEditCustomerAsync`) — a bulk action must not become a way to touch records the caller could not
edit one at a time — and failures are skipped and counted rather than failing the batch. Re-passing
the current owner keeps ownership untouched and changes only the team; `AssignTo` clears the team when
there is no owner, so an unassigned record cannot be filed. They share `BulkFileResultDto`.

### Frontend — one shared component, three lists
`modules/crm/shared/components/team-filing-bar.tsx` exports `TeamFilingBar` + `useRowSelection`, now
used by **Leads, Pipeline and Accounts**. The bespoke implementation added to Leads in Module 31 was
refactored onto it rather than copied twice — three divergent copies of a permission-sensitive bar is
how one of them ends up subtly different.

`useRowSelection`'s header checkbox acts on **visible rows only**; silently selecting rows the user
cannot see makes the count meaningless. Row checkboxes `stopPropagation` so ticking doesn't also open
the drawer. The bar renders only when something is selected.

### Typing fix in the same pass
`useCrmMutation<TArgs>` erased its result to `unknown`, so `mutateAsync` gave `Promise<unknown>` and
any caller needing the response had to cast. Now `useCrmMutation<TArgs, TResult>` — the filing bar
reads real `filed`/`skipped` tallies, and the import summary benefits too.

### Build / Verification Status
- **CRM.API:** 0 errors, 0 warnings ✅ · **Frontend `tsc`:** 279, unchanged baseline · **`vite build`:** ✅
- No migration (uses `AddRecordTeamOwnership`).
- **Pending (republish + restart):** file the 2 deals and 2 accounts to a team, then open Reports and
  File Manager as Aslam — pipeline/win-loss figures and the team's documents appear. Confirm a
  freshly-logged-in team lead is required for the newer module permissions.

### Module 34 — Creator auto-assignment on create, + 🔴 documents were unreachable for the team tier

Two requests in one pass.

### 1. A record now belongs to whoever created it
`CreateLeadHandler` / `CreateDealHandler` / `CreateCrmCustomerHandler` default the owner to the
**creating user** when the form leaves it blank. Previously the record was created unowned — and since
Module 31 an unowned record is visible only to full-access roles, so **a rep who added a lead
immediately lost the lead they had just typed in**.

The team is defaulted too, via new `ILeadAccessGuard.SoleTeamOfCurrentUserAsync()`: the creator's team
when they belong to **exactly one** active team, null when they belong to several. Same "don't guess"
rule as the backfill and for the same reason — filing a multi-team person's record to an arbitrary one
of their teams hides it from a lead who legitimately had it. The query `Take(2)`s: enough to
distinguish "exactly one" from "more than one" without loading every membership.

An explicit choice from the form always wins over both defaults.

### 2. 🔴 The team tier was missing from every document endpoint
Reported as *"can't upload a document on a converted lead"*. The status was incidental — the real
defect was broader. **All six** actions on `CrmDocumentsController` were gated as
`RequireAnyPermission("crm.leads.view"/"edit", "crm.leads-assigned.*")`, omitting
`crm.leads-team.*` entirely. So a team lead could neither **view, upload, download, edit nor delete**
any document, on any lead, at any stage.

Same class as the CRM dashboard gap (Module 32): a tier introduced later, and an endpoint never
updated to accept it. Confirmed against the live tenant — CRM Team Lead holds `crm.leads-team.edit`
but not `crm.leads.edit`, so every upload returned 403. Fixed on all six.

Ruled out first, so the search is recorded: the upload handler, `ResolveRelatedNameAsync`, the
`UploadCrmDocumentCommandValidator`, `DocumentFileRules`, `CanManageActivityAsync`, and the Documents
tab in `lead-drawer.tsx` — none of them treats a converted lead differently, and the two converted
leads in the tenant are both filed to Warsan and owned by Ahmed.

**Known quirk, deliberately not changed:** the document endpoints gate on `crm.leads.*` for *every*
target type, so attaching to an account or opportunity also requires lead permissions. The per-record
`CanManageActivityAsync` check inside does use the correct area's tier. Re-gating per target type is a
separate change and would need its own thought about mixed-permission roles.

### Build / Verification Status
- **CRM.API:** 0 errors, 0 warnings ✅ · **Frontend `tsc`:** 279, unchanged baseline · No migration.
- **Pending (republish + restart):** create a lead as a rep with the assignee left blank — it comes
  back owned by them and filed to their team when they have exactly one; upload a document as a team
  lead onto any lead, converted or not.

### Module 35 — CRM permissions no longer leak into other modules (or other CRM areas)

**Directive: a module outside CRM must never require a CRM permission.** Audited the whole codebase for
`crm.*` permission keys used outside CRM.

**Backend: clean** — no other service references a `crm.*` key. Two violations in total, both around
documents.

### 1. File Manager demanded CRM permissions to open
`file-manager-view.tsx` computed `canRead = (crm.leads view tier) && hasModuleAccess("crm")`, so a
tenant or user without CRM saw *"You don't have permission to view stored documents"* in a module they
legitimately hold `file-manager.view` for.

Separated the two questions:
- **Opening** File Manager needs only `file-manager.view` (route guard, Module 27).
- **What it lists** depends on the document stores the caller can read. CRM is the only one today, so
  the CRM query runs only when they hold some CRM view tier — otherwise the empty state reads
  *"There are no document libraries available to you yet."*, which is the truth, rather than implying
  they were denied File Manager.

Also widened the tier check from lead-only to **any** CRM area, so someone who works purely on
opportunities or accounts gets their files.

### 2. Document endpoints gated on `crm.leads.*` for every target type
All six actions on `CrmDocumentsController` required lead permissions even when attaching to an
opportunity or an account — the wrong area's key guarding another area's records, and the reason File
Manager had been made to demand lead permissions in the first place. They now accept **any** CRM
area's tier; the attribute is only a coarse "may this user touch CRM documents at all" gate.

### 3. The same fault one layer down — `CanManageActivitiesFreely`
The per-record check short-circuited on `crm.leads.create` / `crm.leads.edit` **for every target
type**, so anyone with lead-edit could manage activities and documents on opportunities and accounts
they had no permission to see. Replaced with `CanManageFreely(area)`, and each branch now passes its
own area (`deal → pipeline`, `customer`/`contact` → `customers`, `lead → leads`). The per-record tier
logic below it was already area-correct; only the fast path was wrong.

**This is a tightening**, worth stating plainly: a role holding only `crm.leads.edit` previously could
attach documents to, and log activities on, opportunities and accounts. It no longer can — it needs
the matching `crm.pipeline.*` / `crm.customers.*` key. That is the point of the directive, but it will
change behaviour for any role that was relying on the old blanket rule.

### Build / Verification Status
- **CRM.API:** 0 errors, 0 warnings ✅ · **Frontend `tsc`:** 279, unchanged baseline · **`vite build`:** ✅
- No migration.
- **Pending (republish + restart):** open File Manager as a user with `file-manager.view` and **no**
  CRM permissions — the module opens and shows the empty state rather than a permission error; as a
  user with only `crm.pipeline.*`, documents on their opportunities are visible and uploadable.

### Module 36 — 🔴 The upload UI was hidden from record owners (frontend tier gating swept)

**Reported as "the assignee can't upload a document on the converted lead Hamza Bhi".** Module 34 had
fixed the *server*; this was the client hiding the control before any request was made — which is why
it read as "nothing happens" rather than an error.

### Cause
`documents-panel.tsx` wrapped the entire upload area in `<Can permission="crm.leads.edit">`.
Ahmed (CRM Agent, the lead's owner) holds **`crm.leads-assigned.edit`**, not the tenant-wide
`crm.leads.edit` — so `Can` failed and the drop zone, file picker and upload button never rendered.

Wrong on two counts, both instances of the same fault chased through Modules 32, 34 and 35:
1. **Only the tenant-wide tier checked** — the `-team` and `-assigned` tiers ignored, so the record's
   own owner was locked out of their own record.
2. **Wrong area** — the panel is shared by the lead, opportunity and account drawers, so attaching to
   an opportunity or account also demanded the *lead* key (the Module 35 directive).

Now derives its area from `relatedToType` (`deal → pipeline`, `customer`/`contact` → `customers`,
otherwise `leads`) and accepts any of that area's three edit tiers. The server still decides per record
whether this particular one is theirs, so widening the client gate grants nothing.

### Swept the rest of the CRM UI for the same pattern
Audited every `useCan("crm.…")` / `<Can permission="crm.…">` in the module:
- **`deal-drawer.tsx`** — three `crm.pipeline.edit` gates with no tier variants: the stage control,
  the edit action and the contact-role picker were hidden from a rep on their **own** opportunity.
  Fixed.
- **Correct as-is, deliberately left:** `crm.*.create`, `crm.*.delete` and `crm.reports.*` — those
  actions have no `-team`/`-assigned` variants seeded, so the single key *is* the whole permission.
- `lead-drawer.tsx` was already tier-aware via its `canEditThis` computation.

**Rule going forward:** `view` and `edit` have tier variants and must be checked with `anyOf`;
`create`, `delete`, `export`, `approve` do not. Gating a tiered action on the tenant-wide key alone
silently hides the UI from exactly the people the tiers were introduced to serve.

### Build / Verification Status
- **Frontend `tsc`:** 279, unchanged baseline · **`vite build`:** ✅ · Frontend only; no backend change,
  no migration.
- **Verified from the data:** CRM Agent holds `crm.leads.create` + `crm.leads-assigned.edit/view` (and
  the equivalents for pipeline/customers) but no tenant-wide `.edit` — so every `<Can>` above failed
  for Ahmed. The gateway was already current (DLL 22:54, started 23:02), which is what ruled the
  backend out.
- **Pending:** rebuild/serve the frontend, then upload as Ahmed on *Hamza Bhi* — converted or not.

### Module 37 — Reports owner filter leaked the whole tenant roster

**Reported from the Team Performance screen: a team lead's Owner dropdown listed other teams' leads and
members.** Confirmed — it listed Aslam Bhi, Qfinity and everyone else, none of whom are in a team that
lead runs.

### Cause
`reports-view.tsx` built the dropdown from `useUsers({ pageSize: 200 })` → `/api/users`, which is
`[Authorize]`-only (deliberately, so restricted users can resolve names) and returns **every** tenant
user. The filter offered all of them.

**The report data was never at risk** — every handler scopes through `ILeadAccessGuard`, so selecting
an out-of-scope owner returned an empty report rather than someone else's numbers. What leaked was the
**roster**: names and existence of colleagues outside the caller's scope, plus a list of choices that
could only ever come back empty.

### Fix
Switched to `useAssignableByTeam()`, the same server-scoped pool the assignment pickers use — the
backend resolves it from the caller's tier (`GetAssignableUsersQueryHandler`: everyone for an admin,
otherwise members of the teams they lead plus the leads above them). Rendered as `<optgroup>` per team,
so the filter reads the same way as the reassign and create pickers.

**Verified against the live tenant:** for *New CRM Team Lead Test* the scoped pool is exactly
`ahmed`, `ghafoor`, `mujtaba`, `newteamlead` — the members of Team D and Team E, which they lead —
and the handler does **not** classify that role as admin (no `crm.leads.edit`, no
`settings.users.edit`). Aslam and Qfinity correctly disappear.

### Swept for the same pattern
No other CRM screen builds a picker from `useUsers`. Outside CRM: the AI-assistant modals (admin-only
account linking, `search`-driven) and the dashboard's user **count** are legitimate;
`pos/restaurant/reports-view.tsx` also lists all users, but Restaurant has no team tier model at all,
so it is a different question and was left alone rather than changed speculatively.

### Build / Verification Status
- **Frontend `tsc`:** 279, unchanged baseline · **`vite build`:** ✅ · Frontend only; no backend change,
  no migration.
- **Pending:** reload as a team lead — the Owner dropdown shows only their own teams, grouped.

### Module 38 — Create forms start on the creator + their team (auto-file could never fire for multi-team users)

**Reported: a team lead cannot see the deals Ahmed moved to won/lost, though Ahmed and the admin can.**

### Cause
Both deals carry `TeamId = NULL`, and since Module 31 an unfiled record is visible only to its owner
and full-access roles. Ahmed and the admin qualify; a team lead does not.

The deeper problem is *why* they were unfiled. Module 34's server-side auto-file only fires when the
creator belongs to **exactly one** team — and **Ahmed belongs to two** (Warsan and Team D). So for him
the auto-file never fires, and every record he creates or converts is born invisible to both of his
team leads. Not a one-off: the most active user in the tenant is precisely the case the safety rule
skips.

### Fix — ask instead of guess
New `useDefaultAssignee()` returns the option a create form should start on:
- Creator in **one** team → pre-selected as owner **under that team** → filed automatically, no friction.
- Creator in **several** teams → pre-selected as owner with **no team**, and `needsTeamChoice` is set so
  the form can prompt. The lead form shows an inline warning telling them to pick themselves under a
  team so that team's lead can see the record.

Guessing a team for a multi-team creator is the one thing that must not happen: filing to the wrong
team both reveals the record to a lead who should not see it and hides it from the one who should —
the original complaint that started this whole thread.

Applied to the lead, opportunity and account create forms. Only on **create** — the effect bails when
`editing`, so opening an existing record never overwrites its stored owner or team.

### The two existing deals
They predate all of this and stay unfiled until filed explicitly. The Pipeline list's bulk filing bar
(Module 33) handles that: select both → file to a team → they appear for that team's lead.

### Not changed — converted leads still listed on the Leads page
Checked: `statusFilter` defaults to `"all"`, and `converted` is both a filter option and a kanban
column, so converted leads remain visible by design. That matches how CRMs generally treat them — the
lead is history, not deleted, and its documents and activity stay reachable. Whether the default view
should exclude them is a product preference, so it was left as-is and raised rather than changed
unilaterally.

### Build / Verification Status
- **Frontend `tsc`:** 279, unchanged baseline · **`vite build`:** ✅ · Frontend only; no backend change,
  no migration. Hint translated en + ar.
- **Verified from data:** both deals `TeamId = NULL`, owner Ahmed Khan; Ahmed is a member of Warsan
  **and** Team D — hence no auto-file.
- **Pending:** as Ahmed, create a lead — it comes back owned by him with the team prompt shown; file
  the two existing deals from Pipeline and confirm they appear for that team's lead in won/lost.

### Module 39 — Lead vs opportunity outcomes: converted leads now report what became of them

**Question raised: should a lead show won/lost, and why do converted leads still appear in the list?**

### The model, settled explicitly
**Win and loss are opportunity outcomes, not lead outcomes.** A lead's life ends at *converted* or
*unqualified* — winning means money, and money lives on the deal. Salesforce, HubSpot and Dynamics all
draw the line the same way, and `LeadStatus` here already has no `won`. Adding one would blur a person
you qualified with revenue you actually closed, and would double-count: the deal is already the thing
being forecast and reported on.

So the observed behaviour was correct — Ahmed moved two **deals** to won/lost; the leads stayed at
*converted* because that is genuinely where their story ended.

The real defect was that **a converted lead was a dead end** — it said "converted" and could not tell
you what happened next.

### Converted leads report their outcome
- `LeadDto` gained `ConvertedDealStage` / `ConvertedDealValue`.
- `ConvertedDealOutcomes` (new) resolves them in **one batched query per page**, not one per lead. The
  deal id is stored on the lead as a string, so it is parsed in that one place.
- Deliberately **not** access-scoped: it exposes only stage and value of a deal whose *origin* the
  caller can already see — no owner, contacts or notes. Scoping it would leave the lead's own history
  unreadable to the person working it.
- Wired into `GetLeadsHandler` and `GetLeadByIdHandler`; `LeadMappings.ToDto` takes the two values as
  optional trailing parameters so every other caller maps exactly as before.
- UI: a **Won**/**Lost** chip beside the status in the list, and in the drawer's converted banner with
  the deal value.

### Leads list defaults to open leads
`statusFilter` now starts at **"open"** — excluding `converted`, `unqualified` and `lost` via a new
`CLOSED_LEAD_STATUSES` constant — with "Open leads" and "All statuses" both offered.

Closed leads are **kept, not hidden away**: they are history rather than deletions, and their documents
and activity hang off them. But they are not the working list, and mixing them in made the page read as
though closed leads were still open — which is exactly what prompted the question.

### Build / Verification Status
- **CRM.API:** 0 errors, 0 warnings ✅ · **Frontend `tsc`:** 279, unchanged baseline · **`vite build`:** ✅
- No migration — reads the existing `Lead.ConvertedDealId` link.
- **Pending:** open Leads — only live leads by default; switch to "All statuses" and *Sufian Jaabar*
  shows **converted + Lost**, *Hamza Bhi* **converted + Won** with the deal value in the drawer.

### Module 40 — Converted deals/accounts inherit their originating lead's team (backfill step 1)

**Reported: the team lead still cannot see the two won/lost deals.** Correct, and not a permission
problem — both deals carry `TeamId = NULL`, and an unfiled record is visible only to its owner and
full-access roles.

### Why the existing backfill could not fix them
`BackfillRecordTeamsInBackgroundAsync` filed a record from its **owner's** team, but only when that
owner belongs to exactly one team. Both deals are owned by Ahmed, who is in **Warsan and Team D**, so
the rule deliberately skipped them — leaving the only remedy as filing by hand, forever, for the most
active user in the tenant.

### The link that was there all along
Both deals were created by **converting a lead**, and both those leads are filed to **Warsan**. So the
team is not a guess: `Lead.ConvertedDealId` / `Lead.ConvertedCustomerId` say exactly which record came
from which lead. Module 30 made new conversions carry the team across; these predate it.

New **step 1** of the backfill inherits the team from the originating lead, for both the opportunity
and the account. It runs **before** the owner heuristic, because a real link beats an inference — and
it is the only rule that can file records whose owner sits in several teams, which is precisely the
case the owner rule must skip. Idempotent (`BackfillTeam` only ever fills a NULL), background,
`try/catch`-guarded, all tenants.

**Dry-run against the live data:** files *Sufian Jaabar* (lost) and *Test - Hamza Bhi* (won) plus their
two accounts, all to **Warsan** — Aslam's team. He sees them on next startup with no manual filing.

### Note on ordering
Step 1 (origin) then step 2 (owner's sole team). Both only fill NULLs, so they cannot fight; the order
matters only for a record that both rules could file, where the conversion link is the more precise
answer.

### Build / Verification Status
- **CRM.API:** 0 errors, 0 warnings ✅ · No migration, no frontend change.
- **Pending:** restart the gateway — the backfill runs in the background on startup; then check the
  won/lost figures as Aslam.

---

## Build Status
- **TypeScript (frontend):** 0 errors ✅
- **Backend Finance service:** 0 errors ✅
- **Backend HR service:** 0 errors ✅ (2 migrations applied)
- **Backend Identity service:** 0 errors ✅
- **Backend Inventory service:** 0 errors ✅

---

## Module 41 — HR employee/leave completion + 🔴 codebase-wide tenant-scoping of unique indexes

Two threads: finishing the half-built HR employee & leave surfaces, and — triggered by a duplicate-key
crash — a full sweep of every unique index in the backend for missing tenant scope.

### HR — dead UI and invented data, replaced with real records
- **Job designation** was a hardcoded 11-item list. Now defaults ∪ every title already in use
  (from `useEmployees()`), plus an inline **"+ Add new designation…"** free-text mode. No new table:
  the title is persisted on the employee, so it reappears for the next one.
- **Upload Photo** was a button with no `onClick` and **no backend field at all**. Added
  `Employee.AvatarData` (data URI, `nvarchar(max)`, validators cap it at ~2 MB and require `data:image/`),
  a real file picker with preview + remove. Migration `AddEmployeeAvatar`.
- **Employee Edit did not exist** — the drawer's Edit button was dead and `AddEmployeeForm` was
  create-only. It now takes an `editing` prop (prefill, retitle, `useUpdateEmployee`).
- **8 form fields were silently discarded** (Nationality/EmiratesId/Passport/VisaExpiry/ReportingTo, and
  Bank/IBAN/Insurance which the drawer showed as permanently "Not provided"). Added to `Employee` via
  `SetPersonalDetails` / `SetBankDetails` rather than growing a 12-arg constructor. IBAN is normalised —
  the WPS SIF export depends on it. Migration `AddEmployeePersonalAndBankDetails`.
- **Print** now renders the profile through the shared `exportPdf` helper.
- **Salary structure was fabricated by the UI** — `basicSalary * 0.25` housing, `* 0.10` transport, flat
  1000 medical. Nothing stores those; allowances are entered per payroll run. Now reports the latest
  issued payslip, or says none exists.
- **Recent Payslips was a hardcoded 3-month array.** New `GetEmployeePayslipsQuery` +
  `GET /payroll/employees/{id}/slips`, filtered to `processed`/`paid` — a draft run is not a payslip
  anyone received.
- **Documents tab** listed `emp.documents`, which the API never populates, above an Upload button with
  no store behind it. Replaced with the compliance records that do exist (Emirates ID / passport / visa)
  and a real expiry status. HR has no document store; that is stated, not faked.

### HR — leave entitlements became a model (`LeavePolicy`)
Balances were `emp.annualLeaveBalance` against **hardcoded 30/15-day** totals, and the Balances tab was
permanently empty (`getLeaveBalances` hit an endpoint that never existed, behind `.catch(() => [])`).
- New tenant-scoped `LeavePolicy` (type, annual entitlement, paid flag), UAE-baseline defaults seeded
  lazily per tenant on first read and never re-applied over an edit. Full CRUD + a policies editor.
- **Balances are derived, never stored**: `entitlement − approved − pending`. Pending is held against the
  balance so nobody books past entitlement while an earlier request awaits approval. Per-employee and
  all-employees queries; the latter is one grouped query, not N+1 over headcount.
- The Balances tab's columns now come from the tenant's own policies instead of a fixed annual/sick/unpaid
  trio. Migration `AddLeavePolicies`.

### 🔴 The sweep — unique indexes ignoring TenantId (found via a real crash)
Creating an employee threw `DbUpdateException` → `IX_employees_Email UNIQUE (Email)`, unfiltered and
**not tenant-scoped**. Two defects in one index, and the same shape existed across the codebase:
1. one tenant's value blocked **every other tenant** from using it;
2. a **soft-deleted** row kept its claim forever, so an email/code could never be reused.

New shared helper **`TenantIsolation.TenantUniqueIndex<T>`** — `(TenantId, …)`, filtered
`[TenantId] IS NOT NULL AND [IsDeleted] = 0`. Two rules it encodes:
- It **must** be called from the DbContext **after** `ApplyTenantId` — `TenantId` is a shadow property
  that does not exist inside an `IEntityTypeConfiguration`.
- Legacy `TenantId IS NULL` rows are exempt, because **SQL Server treats NULLs as equal for uniqueness** —
  without that clause the index cannot even be created on an existing database.

Applied to **~35 indexes across 8 services**: HR (employee email/number, department name/code, leave and
payroll-run numbers), Finance (customer/supplier codes, expense/invoice/journal/voucher/bill numbers,
fiscal period), Inventory (brand name/code, product SKU, UoM symbol), POS (15 — barcode, SKU, customer
phone, transaction/order/quotation numbers, currency/tax/voucher/term codes), Sales, Purchase, Visa
(case number), ProjectManagement (project key). Migrations: one `Scope*UniqueIndexesToTenant` per service.

**Also found: `Branch` had no tenant column at all** — a global table behind a per-tenant API, so every
tenant saw and collided with every other tenant's branches. Given `TenantId` following the `Role`/`Team`
precedent: repository scoped (splitting on `HasValue` so null emits `IS NULL`, not `= @p`), all five
handlers scoped, cross-tenant reads return **NotFound** rather than Forbidden so existence never leaks.
Table was empty, so no data risk. Migration `ScopeBranchesToTenant`.

**Deliberately left global**, each verified: Currency/ExchangeRate (global by Module 6e), Identity
Permission/RefreshToken/Tenant.Slug/User email+username/subscription idempotency ledger, AiAssistant
inbound key, Restaurant QR + tracking tokens (resolved publicly, without tenant context). Composite
indexes led by a tenant-owned parent GUID (`ProductId+WarehouseId`, `PayrollRunId+EmployeeId`, …) are
implicitly safe — a GUID cannot repeat across tenants.

**Duplicates now fail properly**: create/update employee pre-check the email and return
`Employee.Duplicate` → **409** with a readable message, instead of an unhandled `DbUpdateException`.

### Build / Verification Status
- **Every service project: 0 errors** ✅ (the full-solution build only fails on MSB3027 file locks from
  the user's **running** ApiGateway — not compile errors).
- **Frontend `tsc`:** 279, unchanged baseline, none in a touched file · **`vite build`:** ✅ · en/ar
  key parity verified.
- `ScopeEmployeeUniqueIndexesToTenant` was **applied to the local dev DB and verified in `sys.indexes`**.
- **Pending (republish + restart):** all other migrations auto-apply on startup. Worth a spot-check that
  two tenants can now hold the same employee email / product SKU / invoice number, and that a deleted
  employee's email can be reused.

---

## Module 42 — HR can create an employee login without holding user administration

**Reported from the employee drawer: the Login Account panel offered no way to create a login.** The
"Create login" button existed (Module 41) but was gated on `settings.users.create`, which HR Manager
does not hold — and should not, since that key also creates administrators. So the panel could report
*"No login found"* and then offer nothing.

### New key — `hr.employees.create-login`
Seeded as a fifth action on `hr.employees` (migration `AddHrCreateLoginPermission`; admins gain it
automatically via `SyncAdministratorPermissionsAsync`). Added to `PrivilegedActions` in
`ModuleRoleCatalogue`, so **HR Manager gets it and HR Staff does not** — minting a login is a manager
decision, and it consumes a plan seat.

`ProvisionUserCommandHandler` accepts **either** `settings.users.create` or the new key. The check
lives in the handler because `UsersController` is `[Authorize]`-only with no per-permission attributes.

Frontend gate widened to match. `ACTION_ORDER` gained `create-login` with en/ar labels, so it renders
as a real column in both the role editor and the per-user override matrix.

### A role-less login is not a working login
If the caller picks no role, provisioning now falls back to the tenant's **Employee (Self-Service)**
role rather than creating an account that signs in and sees nothing. That is exactly the access an
employee being given portal access needs: their own profile, leave requests, attendance and payslips
(`hr.self.*`), and nothing else.

### Build / Verification Status
- **Identity.API:** 0 errors ✅ (4 pre-existing SmtpEmailService warnings) · **`tsc`:** 277, unchanged
  baseline · **`vite build`:** ✅ · en/ar parity verified.
- **Pending (restart):** the migration and `SyncAdministratorPermissionsAsync` run on startup; grant
  `hr.employees.create-login` to the HR Manager role, and **the holder must re-login** — permission
  keys are embedded in the JWT at sign-in.

### Module 42b — HR Manager actually receives the new key, and linking an existing login grants HR access

Two gaps in 42, both found by asking "does this reach an existing tenant?"

**1. A newly seeded key never reached an existing role.** `SyncAdministratorPermissionsAsync` tops up
Administrator every startup, but `EnsureModuleRolesAsync` only *creates* missing roles — it
deliberately never touches an existing one's permissions, since a tenant may have customised it. So
an already-provisioned **HR Manager** would never gain `hr.employees.create-login`.

New `ITenantRoleProvisioner.SyncNewTemplatePermissionsAsync()` tops up template roles, with one
narrow test: it grants only keys that **no tenant-owned, non-system role anywhere holds**. That is
true exactly once — for a freshly seeded key — and false forever after, so a tenant that
deliberately narrows a role is never overridden. Administrator is excluded from the "already held"
set on purpose: it holds every key, so counting it would make the sync a permanent no-op.

*Known limit:* on a single-tenant install, removing the key from the only role holding it would see
it re-granted on the next restart. Acceptable for a one-shot rollout; noted rather than hidden.

**2. Linking an existing login granted nothing.** The account may exist for an entirely different
job, and its role decides what it sees — so linking left the person with no HR access at all. New
`GrantSelfServiceCommand` + `POST /api/users/{id}/grant-self-service` assigns the tenant's
**Employee (Self-Service)** role. Purely additive; it never removes or replaces existing roles.

Surfaced as an **explicit checkbox** beside the match ("also give them access to their own HR
record…"), default on, rather than happening silently — it widens a real person's access.
Orchestrated frontend-side in two calls because HR must never write into the identity schema; the
link goes first and the grant is best-effort, so a failed grant leaves a correct link plus a toast.

**Also:** provisioning a *new* login with no role selected now falls back to the same self-service
role, instead of creating an account that signs in and sees nothing.

Gated on `hr.employees.create-login` **or** `settings.users.create` — the same pair as provisioning.

- **Identity.API + full solution:** 0 errors ✅ · **`tsc`:** 277, unchanged baseline · **`vite
  build`:** ✅ · en/ar parity (the 5 Arabic plural forms of `self.daysCount` are the intended
  exception).
- **Pending (restart):** the top-up runs automatically; then HR Manager shows **Create login**, and
  its holders must re-login for the key to enter their JWT.

### Module 42c — three permissions existed but had no column in the matrix (ungrantable)

Spotted from the HR group of the role editor: `hr.self` rendered **one** cell (`view`) and no
`x/y` count, while the other six HR rows showed 4–6. Confirmed against the live database — three
seeded actions have no entry in `ACTION_ORDER`:

```
attendance · leave-request · payslip
```

`ModuleRow` maps `ACTION_ORDER` to build its cells, so an action missing from that list renders
**no column at all**. The permissions exist and are enforced, but could not be granted or revoked
through the UI in either the role editor or the per-user override tab. Introduced with `hr.self`
itself: the keys were seeded without adding their columns.

Fixed by adding the three actions plus en/ar labels. Named for what they actually authorise
("Request own leave", not "Leave") — every other column is a verb applied to other people's
records, and these three are strictly about the signed-in person.

`ACTION_ORDER` now carries a comment stating that a missing action is invisible, so the next key
with a novel verb does not repeat this.

**Not a bug (checked while here):** an all-`+` SETTINGS block on HR Manager is correct — `+` means
the permission exists but this role lacks it, and HR Manager holds **0** `settings.*` permissions
by design.

**Module 42b verified against live data:** all six tenants' HR Manager roles now hold
`hr.employees.create-login` (28 perms each); all six HR Staff roles do not (23) — the top-up ran
exactly as intended.

- **`tsc`:** 277, unchanged baseline · **`vite build`:** ✅ · en/ar parity (only the intended
  Arabic plural forms differ). Frontend only — no backend change, no migration.

### Module 42d — "Create login" is offered only after the search finds nothing

The panel showed **Find account** and **Create login** side by side from the start, so the obvious
move was to press Create — which is the wrong one whenever a login already exists. Best case it
fails on the taken email; worse, an administrator creates a *second* account for someone who
already had one, and the person ends up with two sets of credentials.

Now the panel is a sequence, not a choice: **Find account** first, and Create login appears only in
the "no login found for …" branch. Linking an existing account is the other branch, so both
outcomes lead somewhere and neither can be reached by mistake.

- **`tsc`:** 277, unchanged baseline · **`vite build`:** ✅ · frontend only, no new strings.

### Module 42e — hand the account over by email invite, not by a password anyone has to carry

Provisioning returned a temporary password for the administrator to relay. That works, but it means
a real credential travels through a third party — read off a screen, typed into WhatsApp, written
on paper — and it was the only option. Worse, it depended on the administrator seeing and acting on
a value shown exactly once; miss it and the account is stranded.

**Invite is now the default.** `ProvisionUserCommand.SendInvite` (default true) issues a single-use,
hashed-at-rest password-reset token (7 days) and emails a set-your-own-password link, reusing the
existing `/auth/reset-password` page and token rather than inventing a parallel flow. Nobody but the
employee ever learns the password.

**The temporary password stays**, as a deliberate second option — site, warehouse and retail staff
frequently have no working mailbox, which is the whole reason this flow is separate from Create
User. The modal offers both, invite first.

**Neither path can strand an account.** A password is generated either way. It is withheld *only*
when the invite genuinely went out: `SendEmployeeInviteEmailAsync` returns `bool` (false when SMTP
is unconfigured — the existing dev-fallback logs the link and would otherwise be indistinguishable
from success), and any send exception is caught. If the invite did not go, the response carries the
password and the modal shows it under "the account was created, but the invite could not be sent".
`ProvisionedUserDto.TemporaryPassword` is therefore nullable, paired with `InviteSent`.

The email is sent **after** the commit: an account without its invite can be re-invited, while an
invite for an account that failed to save is a dead link.

`MustChangePassword` is still set on both paths and is harmless on the invite path —
`ResetPassword` calls `ChangePassword`, which clears it.

- **Identity.API + full solution:** 0 errors ✅ · **`tsc`:** 277, unchanged baseline · **`vite
  build`:** ✅ · en/ar parity. No migration — reuses the existing reset-token columns.

**Flagged, not changed:** `ApiGateway/appsettings.json` carries a **live SMTP password in plain
text** and is committed to git (`3e9623e`). It works, which is why the invite path is usable today,
but it belongs in an environment variable like every other secret — and since it is in history,
rotating the mailbox password is the actual remedy.

### Module 42f — "not found" then "already registered": two checks scoped differently

Search said *no login found for kiani789@gmail.com*; creating one then failed *Email is already
registered*. Both were telling the truth about different populations.

Confirmed against the live database:
- the employee sits in tenant `82351952-…`; the existing `kiani789@gmail.com` login sits in
  tenant `A606706C-…` — a **different workspace**;
- `FindUserMatch` queries the Identity view **tenant-scoped** (correct — it must never surface
  another tenant's logins), so it found nothing;
- `IX_users_email` is `UNIQUE (email) WHERE IsDeleted = 0` — **global, no TenantId** — so
  `EmailExistsAsync` matched across the platform and rejected the create.

**The global index is correct and was left alone.** Sign-in resolves an account by email with no
workspace selector (`LoginCommandHandler` → `GetByEmailAsync`), so a per-tenant email would make
login ambiguous. Scoping that index to the tenant — the reflex after Module 41 — would have broken
authentication. One email = one login, platform-wide, is the actual rule.

So the defect was the **contradiction**, not the constraint. Fixed at both ends:
- `FindUserMatchHandler`, on finding nothing in this workspace, now checks whether the address
  exists anywhere before reporting "not found", and returns `RegisteredInAnotherWorkspace`. **Only
  a boolean crosses the tenant boundary** — no name, status or workspace — and it reveals nothing
  the create endpoint did not already reveal by rejecting the address.
- The panel renders that as its own outcome and **does not offer Create login**, so the button is
  never shown for an address that cannot work.
- `ProvisionUserCommandHandler`'s message now says *"in this or another workspace"* and explains
  that an address can only belong to one login — the old wording was baffling precisely because the
  conflicting account is invisible to the caller.

- **Full backend solution:** 0 errors ✅ · **`tsc`:** 277, unchanged baseline · **`vite build`:** ✅
  · en/ar parity. No migration.

### Module 42g — invites work on the server but not locally: Zoho refuses the sign-in from this IP

Follow-up to 42e. A raw SMTP handshake from the dev machine to `smtp.zoho.com:587` reaches Zoho,
completes STARTTLS, is offered `AUTH LOGIN`, and is answered **535 Authentication Failed** — with
the same credentials that send successfully from the production server.

So the credential is valid and the code is right; Zoho is declining the sign-in **from this
location**. SMTP returns 535 for a wrong password and for a blocked sign-in alike, so a client
cannot tell them apart — the server working is what settles it.

**Local development no longer depends on Zoho.** `appsettings.Development.json` (already
gitignored, so local-only and never deployed) blanks `Email:SmtpHost`/`SmtpUsername`, which takes
the existing unconfigured-SMTP path: the invite URL is written to the gateway console as a warning,
and `SendEmployeeInviteEmailAsync` returns false so the modal shows the temporary password. Both
halves of the hand-over are therefore testable locally. Delete the file to go back to attempting
real sends.

Production is untouched — it reads its own configuration and already sends.

To send from a workstation as well: add an app-specific password (Zoho requires one when 2FA is
enabled) or allow the IP in Zoho's security settings.

## Module 43 — HR: office timings, and an honest on-time / late verdict

Requested: HR sets office hours, and an employee can see whether they arrived on time.

### The blocker found first — attendance was stamped in UTC
`SelfAttendance.Now` used `DateTime.UtcNow`, so a 09:00 arrival in Dubai was recorded as **05:00**.
No lateness rule can work on top of that, and the times already shown to employees were wrong by
the UTC offset. The timezone therefore lives **on the schedule** rather than being assumed:
check-in, check-out and the date now come from `WorkScheduleRules.LocalNow(schedule)` — the date
too, or a late-evening check-in lands on tomorrow.

### `WorkSchedule` (tenant-scoped)
`(Name, StartTime, EndTime, GraceMinutes, WorkingDays, TimeZoneId, IsDefault)`. Seeded on **first
read**, not at startup: a startup seed has no ambient tenant and would write rows nobody can see —
the Module 5g mistake. Default 09:00–18:00, 15 minutes grace, Mon–Fri, `Asia/Dubai`, all editable.
The table takes many rows so per-department shifts can be added later; **assigning schedules to
individual employees is deliberately not built**.

`WorkScheduleRules` is pure — `LocalNow`, `LateMinutes`, `IsWorkingDay`. An unresolvable timezone
falls back to UTC rather than throwing: a bad id must not stop someone checking in.
`UpdateWorkScheduleHandler` still rejects one, so it cannot be saved in the first place.

### Lateness is snapshotted, never derived on read
`AttendanceLog.LateMinutes` — 0 on time, null when not judged. Written at check-in against the
hours **in force then**, so changing office hours never rewrites who was late last month. Counted
from the *end* of grace, so an arrival inside grace is 0 rather than a small positive number.
`Update` re-judges only when the arrival time actually changed — editing a note must not erase the
verdict recorded on the day.

**Dead metric fixed:** the attendance summary counted `Status == "late"`, and nothing ever set that
status, so "Late today" was permanently 0. It now counts `LateMinutes > 0`.

**Two stale projections caught by the compiler** (`GetAttendanceLogById`, `GetAttendanceLogs`) —
the same silent-null class as Module 41, which is why `LateMinutes` was added mid-record rather
than as a trailing optional.

### Surfaces
- **HR** — an *Office Timings* button on the attendance page (`hr.attendance.edit`), sitting with
  attendance rather than in a settings page nobody visits while looking at a late arrival.
  `GET/PUT /api/hr/attendance/schedule`. The table's check-in cell now colours by recorded lateness
  and carries a "Late 12m" badge.
- **Employee** — the office hours are shown **before** check-in (knowing the deadline is what lets
  someone avoid being late), and a chip afterwards: green *On time*, amber *Late by N min*, and
  **nothing at all when null** — "on time" would be a claim the data does not support. The same
  chip appears on every history row. The schedule rides along in `MyAttendanceTodayDto`, so ESS
  needs no second call and no permission to read the schedule.
- HR needed a design-time `HrDbContextFactory` — EF was building the API host, which lacks the
  gateway's `ICurrentUser`, so no migration could be created.

### Build / Verification Status
- **Full backend solution:** 0 errors ✅ · **`tsc`:** 277, unchanged baseline · **`vite build`:** ✅
  · en/ar parity. Migration `AddWorkSchedulesAndLateMinutes` created (auto-applies on startup).
- **Pending (restart):** set office hours; check in before and after the grace window and confirm
  the chip and the HR table agree; confirm times are now local, not UTC.
- **Note:** rows created before this change have `LateMinutes = NULL` and correctly show no verdict
  — they were never judged, and back-filling them from today's hours would be inventing history.

### Module 43b — Frontend timestamps were rendered as local when the API sends UTC

Reported alongside the attendance work, and broader than HR. .NET serialises a `DateTime` whose
Kind is Unspecified **without a trailing `Z`** — `"2026-08-25T19:03:55.12"` — and JavaScript reads
a bare date-time like that as **local**. Every timestamp in the product was therefore wrong by the
viewer's UTC offset: four hours in the Gulf, enough to show last night's activity as today.

New `parseApiDate()` in `lib/utils.ts` treats a string with no zone and no offset as UTC — what the
server meant — and lets the browser format it in the viewer's own timezone. `formatDate()` now goes
through it, which covers most of the app in one place.

**Date-only values are deliberately left alone.** `"2026-08-25"` (attendance dates, leave dates) is
a calendar day, not an instant; shifting it by an offset would move it a day.

The 14 places that bypassed `formatDate` and called `new Date(x).toLocale…` directly — POS receipts
and transaction lists, the AI assistant, super-admin, report exports, delivery tracking — were
routed through the same helper. Zero remain.

- **`tsc`:** 277, unchanged baseline · **`vite build`:** ✅ · frontend only, no migration.

---

## Module 44 — Payroll: Finance approves before money moves

Requested: HR must not be able to pay staff on its own say-so. Both follow-up decisions were the
user's — Finance **sees and can edit individual salaries**, and approval **posts to the ledger**.

### The chain
```
draft → processed → finance_approved → paid
         (HR ends here)   (Finance)      (HR disburses)
```
`PayPayrollRunHandler` now requires `finance_approved`, so the gate is enforced in the handler, not
merely hidden in the UI. A run stuck at `processed` reports *"waiting for Finance approval"* rather
than a generic conflict.

### The permission is a Finance key, not an HR one
`finance.payroll` = `view`, `approve` (migration `AddFinancePayrollPermissions`). Deliberately not
`hr.payroll.approve`: that key also processes and pays, so granting it to Finance would dissolve
the separation this step exists to create. The approver needs **no HR permissions at all** —
`RequireAnyPermission` (copied into HR from CRM) opens payroll reads, slip edits and reject to
`hr.payroll.*` **or** `finance.payroll.approve`.

### Finance can correct figures, not just accept or refuse
`UpdatePayrollSlipHandler` previously allowed edits on draft/rejected only. `processed` is now
editable too — that is precisely when Finance reviews the run, and bouncing a whole payroll back to
HR over one wrong allowance is not how this works in practice. Once approved or paid, figures are
fixed. `RejectPayrollRunHandler` likewise accepts `processed`, so Finance can send a run back.

### Money moves at approval
`useFinanceApprovePayroll` approves, then posts a journal entry through the existing Finance API and
links it onto the run (`JournalEntryId`/`JournalEntryNumber`). Frontend orchestration, because HR
must never write into the Finance schema — the same shape the visa module uses to raise an invoice.

**Order matters and is deliberate:** approval first. An approval without its posting is a run that
can be paid and whose entry can be retried; a posting without an approval is money in the ledger
that nothing authorised.

The entry is an **accrual** — salary expense debited, salaries payable credited — so paying later
clears the liability rather than double-counting the cost. Accounts are matched by name from the
tenant's own chart, falling back to type. If no suitable accounts exist the run is still approved
and the toast says **plainly** that nothing was posted; "approved" on its own would hide that the
books are untouched.

`Reopen()` clears the Finance sign-off as well as the rejection: the figures are about to change,
so an approval of the old ones must not survive.

### Build / Verification Status
- **Full backend solution:** 0 errors ✅ · **`tsc`:** 277, unchanged baseline · **`vite build`:** ✅
  · en/ar parity. Migrations `AddPayrollFinanceApproval` (HR) + `AddFinancePayrollPermissions`
  (Identity) created; both auto-apply, and Administrator roles gain the key on startup.
- **Pending (restart + re-login):** create a "Finance Manager" role holding `finance.payroll.view`
  and `.approve` and nothing from HR; confirm they can open a processed run, edit a slip, approve
  or reject — and that HR alone cannot pay a run that Finance has not approved.

## Module 45 — 🔴 A self-service employee could read the entire payroll

Reported from a screenshot: `doob ja`, holding only **Employee (Self-Service)**, saw the HR
dashboard, a **Add Employee** quick action, and — on clicking it — the full staff directory with
**every salary**.

### Three independent failures, all of which had to hold for this to happen
**1. `hr.self.*` unlocked the whole HR module.** `toFrontendPermission` takes the first dotted
segment as the module, so `hr.self.view` became `hr:read`, and `hasModuleAccess("hr")` step 7
matched on the `hr:` prefix. Self-service now maps to its own module id (`hr-self`), so it can
never satisfy an HR check. `/hr/me` moved **outside** the HR `ModuleGuard` — an ordinary employee
legitimately has no HR access — and the sidebar keeps a parent visible when any child survived
filtering, so "My HR" does not vanish with its parent.

**2. The dashboard's Add Employee quick action was gated on module access.** Quick actions
navigate to pages, so each needs the permission that page requires. Now `hr.employees.create`.

**3. 🔴 The actual leak — `GET /api/hr/employees/all` was authenticated-only and returned
`BasicSalary` for every employee.** It was left ungated on purpose as a dropdown feed for the
leave/attendance/payroll forms (Module 5j), but "ungated" meant *any* signed-in user could read the
roster and the payroll. It now requires one of the nine HR permissions that genuinely needs the
list, and the handler **withholds the salary** unless the caller holds `hr.employees.view` or a
payroll permission — the forms still work, the figure is simply absent.

Fixing only the frontend would have left the endpoint open to anyone with a token.

- **Full backend solution:** 0 errors ✅ · **`tsc`:** 277, unchanged baseline · **`vite build`:** ✅
- **Pending (restart + re-login):** sign in as a self-service employee — no HR nav beyond My HR, no
  Add Employee action, and `/api/hr/employees/all` returns 403.

---

## Module 46 — WPS: a salary file the bank can actually accept

The existing export was fabricated. It was pipe-delimited (the format is CSV), wrote the literals
**`MOB`** and **`COMPANY`** where the MOHRE establishment number and agent routing code belong,
used the internal employee number as the Employee Unique ID, expressed amounts in **fils**, and
emitted a trailing `EOS` record that is not part of the format. No agent bank would have taken it.

### The data did not exist, so it is collected rather than improvised
- `WpsConfiguration` (tenant) — **Employer Unique ID** (MOHRE establishment) and **agent bank
  routing code**, plus a **file sequence** so a corrected resubmission never reuses a filename the
  agent already processed. Seeded **empty** on first read: an empty row is honest, invented
  identifiers are not, and `IsComplete` is what the UI keys off.
- `Employee.LabourCardNumber` (MOHRE Person ID) and `Employee.BankRoutingCode`. Neither is
  derivable — an IBAN carries a 3-digit bank code, WPS wants the agent's 9-digit routing code.

### `WpsSifBuilder`
SDR rows per employee then a single EDR totalling them; comma-separated, CRLF; dates `YYYY-MM-DD`,
salary month `MM-YYYY`, amounts decimal AED to 2 places. Basic pay is the fixed component and
allowances the variable one, with deductions taken off the **variable** side only — a negative
fixed component is rejected outright. Filename `{establishment}{MM}{YY}{seq}.SIF`.

**IBANs are validated properly** — AE + 21 digits *and* the ISO 13616 mod-97 check, so a
transposed digit is caught here rather than by the bank.

### Generated on the server, and it says what is wrong
`GET /api/hr/payroll/{id}/wps-sif` returns the file **with** the list of employees left out and
why ("No labour card number", "IBAN … is not a valid UAE IBAN"). Reporting issues instead of the
file would block a payroll over one incomplete record; reporting only the file would let the bank
find the problem first. The sequence is consumed only when a file is actually produced.

### ⚠️ Verify against your agent's template before the first live submission
This is the published MOHRE layout, but banks and exchange houses issue their own SIF templates and
some differ in optional trailing fields. Treat the builder as the shape to check, not an authority.

- **Full backend solution:** 0 errors ✅ · migration `AddWpsSalaryFileData`.
- **Not finished in this pass:** the WPS settings screen, the labour-card/routing fields on the
  employee form, and switching the WPS modal from the old client-side generator to the new
  endpoint. The backend is complete and callable; the UI still writes the old file until wired.

### Module 46b — Employees can download their own payslip as a PDF
`My HR → Payslips` gained a **PDF** button per row, rendering through the shared `exportPdf`
helper (browser print-to-PDF, no new dependency, same look as every other document). Built from the
figures already on the payslip plus the employee's own profile, so no id is passed and nothing can
be requested for anyone else. Bank rows appear only when the details exist. Translated en + ar.

### Module 45b — the sidebar fix was too permissive and showed every module

Making a parent visible when **any** child survived filtering was wrong: most children carry no
gate of their own (their visibility comes from the parent), so "any surviving child" is always
true — and the self-service employee then saw Finance, CRM, Sales, Purchase, Inventory and every
industry module in the sidebar.

Only a child that declares its **own** module or permission can now rescue a parent. In this
config that is exactly the seven HR children, which is the case the rule exists for: "My HR" is
gated on `hr.self.view` and must survive when the HR module does not. Every other group falls back
to the module check, as before.

- **`tsc`:** 277, unchanged baseline · **`vite build`:** ✅ · frontend only.

### Module 46c — WPS export switched to the server, and the "0 records" cause found

Reported: the downloaded file contained only two lines and **0 employees**:
```
EDR|MOB|COMPANY|202608|0|3410000|AED
EOS|MOB|COMPANY|202608|0|3410000|AED
```

That was still the old client-side generator (Module 46 built the backend but left the UI wired to
it). The **0** had its own separate cause, worth recording:

**`run.payslips` was permanently `undefined`.** The detail endpoint returns the collection as
`slips`; this client has always typed it `payslips`. Nothing ever failed — the field was simply
absent, so the SIF preview table was empty and the file reported zero records while the *total*
came from `run.totalNetSalary` and looked right. Same silent-mismatch class as Module 41, and
exactly why the total and the count disagreed. Normalised at the API boundary.

The generator is now deleted and the modal calls `GET /api/hr/payroll/{id}/wps-sif`:
- **Included / Excluded** counts, the real filename, and every excluded employee named with the
  reason — "no labour card number", "IBAN … is not a valid UAE IBAN". "3 employees excluded" is
  not actionable; a name and a reason is.
- A **WPS Settings** dialog for the MOHRE establishment number and agent routing code, reachable
  from the footer and offered directly when the error says they are missing.
- **Labour card number** and **bank routing code** added to the employee form's bank section, with
  a note on why neither can be derived.

- **Full backend:** 0 errors ✅ · **`tsc`:** 277, unchanged baseline · **`vite build`:** ✅ · en/ar
  parity (only the intended Arabic plural forms differ).
- **Pending (restart):** enter the WPS employer details, add a labour card + routing code to one
  employee, then export — the file should carry real SDR rows and name anyone still incomplete.

### Module 46d — the disabled download was correct; the screen around it was not

Reported as a bug. It was not: checked the database — **25 employees, 0 with an IBAN, 0 with a
labour card number, 0 with a bank routing code**. There is genuinely nothing to put in a salary
file, and offering a download would produce one the bank rejects.

Three things around it were wrong, though:

- **The row status was hardcoded to `ps.iban`** — so it named one requirement out of three, and
  would have said "Ready" for anyone who merely had an IBAN while still missing a labour card. It
  now shows the server's own verdict per employee, so the table and the file cannot disagree.
- **The Employees tile was blank.** `PayrollRunDetailDto` carries the slips, not a `SlipCount`, so
  the field was undefined. Falls back to the slip count.
- **"No eligible records" was returned as a failure**, which threw away the per-employee reasons at
  exactly the moment they matter most — the first export, before anyone has entered anything. It
  now returns an empty file **with** the issues, and the download is disabled on `recordCount === 0`
  rather than on an error. The file sequence is still only consumed when a real file is produced.

- **HR.API:** 0 errors ✅ · **`tsc`:** 277, unchanged baseline · **`vite build`:** ✅ · en/ar parity.

## Module 47 — Assignment pickers list only people who can open the record

The CRM reassign dropdown offered every tenant user, including HR-only accounts and employees
provisioned purely for self-service. Handing a lead to one of them creates a record its assignee
cannot open and only an administrator can then find.

### Filtering is by *effective* permission, not by role
New `ITeamRepository.FilterUsersWithModuleAccessAsync(userIds, modulePrefix)` returns the users
holding at least one permission in the module, computed as **(roles ∪ user grants) − user denies**
— the same formula the JWT is built from (Module 5h). Filtering on roles alone would disagree with
what the person can actually do: a per-user grant would be ignored, and a per-user deny would leave
someone in the picker who can no longer open a lead.

The prefix is matched as `crm.` (or the exact key), so `crm` covers `crm.leads`, `crm.pipeline` and
`crm.customers` without also matching an unrelated module that merely starts with the same letters.

`GetAssignableUsersQuery` gained an optional `Module`, applied to **both** branches — an admin
routing a lead should no more be offered a warehouse clerk than a team lead should. Super admins
hold no explicit permission rows, so the caller is kept when they are one, rather than filtering
themselves out of their own picker.

`GET /api/teams/assignable-users?module=crm`; the module is part of the React Query key, since
"who can take a lead" and "who can take a job" are different lists and must not share a cache entry.
`useAssignableByTeam` / `useTeamsForFiling` default to `crm`, which is every current caller.

- **Full backend solution:** 0 errors ✅ · **`tsc`:** 277, unchanged baseline · **`vite build`:** ✅
  · no migration.
- **Verified against live data:** in the Qfinity tenant 6 users hold `crm.*` and 8 do not (HR test
  accounts and self-service employees) — exactly the ones the picker was offering.

## Module 48 — Provisioning a login bypassed the plan's seat limit

Settings → Users refused a fourth user on a Micro plan; creating a login from an employee record
did not. Both mint a real user on the same plan, so both consume a seat — the rule existed in one
of its two implementations.

The check is now `PlanSeatGuard.CheckAsync`, called by **both** `CreateUserCommandHandler` and
`ProvisionUserCommandHandler`, with the same `Plan.UserLimitReached` code and wording. Extracted
rather than copied: a duplicated limit is how the two drifted apart in the first place.

**Linking an existing login is deliberately not gated** — that account already exists and is
already counted, so it consumes no additional seat. Same for the trial/tenant-creation paths, which
create a workspace's first admin before there is a plan to measure against, and for super admins,
who operate above any single tenant's plan. `MaxUsers <= 0` means unlimited.

Audited every `User.Create(` call site in Identity: the five are Register (dead endpoint),
CreateTenant, RegisterTrial, CreateUser and ProvisionUser — the last two are the seat-consuming
ones and both now guard.

- **Full backend solution:** 0 errors ✅ · **`tsc`:** 277, unchanged baseline · **`vite build`:** ✅
  · no migration. The Create Login modal already surfaces the API message, so the employee path now
  shows the same "Your Micro plan allows a maximum of 3 users" text.

---

## Module 49 — AI Assistant: create/modify across every module, discoverable in Auto mode, formatted replies

Reported as "I'm not able to create a new bug or task — the tools available to me only let me
**list** projects", plus asterisks showing raw instead of bold, plus "make sure add/modify only
happens after confirmation, as it does for CRM".

### Why it said a capability did not exist (three independent causes)
1. **Auto mode never shows a write tool.** `IAiTool.IncludeInAutoMode` is false for every write and
   every deep read (deliberately — Module: the tool-schema payload goes into *every* request and a
   tenant with all modules on was tripping Groq's TPM limit before the question was even read). So
   in Auto mode the model saw only `projects_list` and answered, truthfully but uselessly, that
   there was no function for adding — while `projects_create_issue` had existed the whole time.
2. **The agent picker could not reach those modules either.** `GetAgentsHandler` built the picker by
   grouping `GetTools(null)` — the *Auto-mode* set. Any module without a cheap cross-module read
   tool therefore never appeared: **Restaurant, Visa, POS, B2B, Education, Healthcare and Insurance
   had no picker entry at all**, so naming the agent was not a workaround. It also showed the
   Auto-mode tool count rather than what the agent actually offers.
3. **Whole modules genuinely had no write tools**, and *no module had an update tool of any kind* —
   the catalog was create-only.

### Fix 1 — progressive tool disclosure (`use_module`)
New `Orchestration/UseModuleTool.cs` (agent `core`, read-only, in Auto mode). The model calls it with
a module key; `AiOrchestrator.ExpandToolsIfRequested` then appends that module's full tool set —
writes included — to `toolDefs` for the remaining iterations of the same turn. Applies to both
`RunAsync` and `RunAutonomousAsync`. Auto mode's baseline payload is unchanged, so the TPM problem
that motivated the restriction does not come back. `AiSystemPrompt` now states plainly that the
assistant *can* create and modify, that the listed tools are a starting set, and that it must call
`use_module` before ever claiming a capability is unavailable.

**DI gotcha:** `UseModuleTool` needs `IAiToolRegistry`, and the registry needs every `IAiTool` — as a
DI registration that is a cycle. `AiToolRegistry` constructs it in its own constructor instead; it is
deliberately *not* in `AddScoped<IAiTool, …>`.

`AiToolAgents.Core` ("core") is exempt from the module-licence gate — plumbing belongs to no module,
and gating tool discovery on a subscription would make the assistant unable to find its own
capabilities. It is excluded from `GetAvailableModules()` so it never shows up as an agent.

### Fix 2 — three new data-driven tool kinds (`Tools/Generic/`)
- **`AiUpdateSpec` / `GenericUpdateTool`** — modify an existing record. Almost every PUT in this
  codebase **replaces** the whole record, so sending only the changed field would blank the rest.
  The tool therefore **reads the record first and merges** the model's fields over it. Merging from
  the full read result also preserves what a flat field list cannot express (tag arrays, labels)
  without the model restating it. Refuses when no field was supplied, and when the read fails it
  says so rather than writing a body assembled from guesses. Unwraps POS's `ApiResponse<T>`
  envelope (`{ success, data }`) — merging the envelope would send a body with none of the real fields.
- **`AiActionSpec` / `GenericActionTool`** — approve / reject / change status / move stage. Any
  `{placeholder}` in the path is filled from the same-named field and then excluded from the body,
  so one field list drives both route and payload. `RawBodyField` covers the three endpoints that
  bind a bare value (`[FromBody] string status` on Sales orders, Purchase orders, POS purchase
  orders) rather than an object.
- **`AiListSpec.QueryParams`** — optional filters, and path placeholders for project-scoped lists.
  This also fixed a live bug: `projects_list_issues` called `GET /issues` with no `projectId`, which
  the API requires, so it could never return anything.

**`AiFieldDefaults.CurrentUserId` / `CurrentUserName`** — fields whose value is "whoever is doing
this" (`approverId`, `requestedBy`, `by`, `byName`) are filled from `ICurrentUser` and **omitted from
the JSON schema entirely**, so the model is never tempted to invent a GUID for them.

**`IAiTool.RequiredPermission` now accepts comma-separated alternatives** ("any of"). This mirrors
the `[RequireAnyPermission]` attributes on the tiered CRM controllers: a team lead holds
`crm.leads-team.edit`, not the tenant-wide `crm.leads.edit`, so naming only the tenant-wide key would
have hidden every CRM tool from exactly the roles those tiers exist to serve.

### Fix 3 — coverage: 254 tools, every module, create **and** modify
`ModuleToolCatalog` grew to 226 data-driven entries (Lists / GetByIds / Creates / Updates / Actions)
plus the bespoke tools. Per-module tool counts: finance 36, hr 33, crm 28, restaurant 26, inventory
22, projects 20, sales 15, purchase 14, visa 11, b2b 10, education 10, insurance 10, healthcare 9,
pos 9. **Visa, the four industry packs and POS had zero tools before this** and now have full
list/create/modify coverage.

Four new hand-written tools for bodies with nested line-item arrays (which a flat field list cannot
express): `VisaCreateCaseTool` (applicants), `SalesCreateQuotationTool`, `RestaurantCreateOrderTool`,
and `PurchaseCreateRequisitionTool` — the last one closes the gap flagged in Module 5p, where
`POST /api/purchase/approvals` existed but the web UI's "New Request" button was never wired, so the
assistant is currently the only way to raise a requisition. Shared readers live in `Tools/ToolJson.cs`.

**Deliberately not exposed:** no delete tool anywhere (creating or correcting from chat is
recoverable; deleting from a mis-parsed instruction is not), and no POS sale / void / refund /
session tool — those move cash in a physical drawer against an open shift and belong at the terminal.

### Fix 4 — confirmation (already universal; now reviewable everywhere)
`AiOrchestrator` gates on `IsReadOnly == false`, so every one of the new write tools is held as a
pending action for confirm/reject exactly like the CRM ones — no per-tool wiring, nothing to opt in
to. The **side panel** only showed the model's prose summary, though; it now renders the same
field-by-field table as the full assistant page, because a confirmation you cannot inspect is not
much of a safeguard.

### Fix 5 — Markdown rendering (the raw asterisks)
Both chat surfaces printed `msg.content` as plain text, so the Markdown the models are instructed to
produce came through literally. New `components/ui/markdown.tsx` renders headings, bold/italic/
strikethrough, inline code, fenced code, bullet/numbered lists, GFM tables, blockquotes, rules and
links. Dependency-free (same call as `lib/pdf.ts`) and it builds **React elements, never
`dangerouslySetInnerHTML`**, so model output cannot inject markup; only `http(s):`/`mailto:` hrefs
render as links. Two deliberate restrictions: no single-underscore emphasis (the answers are full of
snake_case tool names, which `_x_` matching mangles) and no regex lookbehind (an unsupported
construct is a parse-time SyntaxError that would take down the whole chunk). User messages stay
plain text.

### Verification
- **Full solution build:** 0 errors ✅ (7 pre-existing MSB3277 Serilog version-conflict warnings).
  **`vite build`:** ✅ · **`tsc`:** 277, unchanged baseline, none in a touched file.
- **Every catalog path checked against the real routes** — a script derived 931 `(verb, path)` pairs
  from every controller in the solution and matched all 226 catalog paths: **0 mismatches**. This
  caught `purchase_set_order_status` needing `RawBodyField` (its endpoint binds a bare string).
- **All 226 data-driven tools built and their JSON Schemas validated at runtime** (valid JSON,
  snake_case names ≤ 64 chars, known primitive types, non-empty descriptions, every `required` entry
  declared, every path placeholder fillable): 0 problems.
- **Wire-level execution through a fake HTTP layer**, asserting the exact method/path/body: path
  params excluded from the body, bare-string bodies, caller-identity defaults filled, multi-placeholder
  routes, literal defaults, list querystring + path substitution, merge-update reading before writing
  and preserving untouched values including tag arrays, empty updates refused without writing, and a
  missing id refused before any HTTP call. All pass.
- **Not runtime-tested against a live model or a running gateway** — needs the usual republish +
  restart. Then spot-check: in Auto mode ask "log a bug in <project> that the login button does
  nothing" → the assistant calls `use_module("project-management")`, then proposes
  `projects_create_issue` for confirmation; the agent picker now lists Restaurant/Visa/POS and the
  four industry packs; a reply containing `**bold**`, a list and a table renders formatted.

---

## Module 50 — Real Estate: rent schedules, rent/overdue reminders, lease-expiry notices

Requested: alert tenants before rent falls due, chase them when it is not paid, and warn before a
lease expires — all by email.

### The blocker: there was nothing to alert on
`LeaseContract` held `StartDate`, `EndDate`, `AnnualRent`, `Cheques` and a single running
`TotalPaid`. **No due dates, no payment frequency, no per-payment records.** Nothing could know rent
was *due*, let alone *late*, so this is built on a new rent schedule rather than on top of one.

Three other gaps found while surveying the module:
- **`ContractsController` was read-only** (GET list + summary). The frontend called
  `POST`/`DELETE /api/real-estate/contracts`, which did not exist — **Add Contract was dead UI**.
  Same for `createUnit`/`deleteUnit`/`createBroker`/`deleteBroker`.
- **Real Estate had no permission keys at all** and no `[RequirePermission]` anywhere — the last
  unaudited module. Every endpoint was `[Authorize]`-only.
- The frontend `ContractDto` described a contract that does not exist (`type`, `brokerId`,
  `rentAmount`, `saleAmount`, `depositAmount`, `contractDoc`, `paymentFrequency`,
  `nextPaymentDate`), so all of those were `undefined` at runtime — the same silent-mismatch class
  as the WPS `payslips`/`slips` bug (Module 46c). `UnitDto`/`TenantDto` have the same drift (below).

### Rent schedule
`RentInstallment` (contract, number, `DueDate` as `yyyy-MM-dd`, amount, amount paid, status, paid
date/method/reference). `LeaseContract.PaymentFrequency` = monthly / quarterly / semi_annual /
annual; `GenerateSchedule()` cuts the term into dated installments.

- **Pro rata by term, not by name.** `AnnualRent` is a yearly rate, so a 6-month lease owes half.
- **The remainder lands on the last installment**, so the schedule sums to the total *exactly*. A
  naive divide leaves 100,000/12 short by 0.04, which then shows as an outstanding balance nobody
  can ever clear. **Verified by execution**: 12×monthly of 100,000 → eleven at 8,333.33 + one at
  8,333.37; 99,999.99 half-yearly → 50,000.00 + 49,999.99; 6-month at 120,000/yr → 60,000 total;
  24-month quarterly at 120,000/yr → 8 × 30,000.
- **Regeneration is refused once any money is recorded** — rebuilding would discard payments taken
  against the old rows. Verified.
- **There is deliberately no stored "overdue" status.** Lateness is a function of today's date, so a
  stored flag is wrong from the moment the clock passes it until something re-runs. `overdue` is
  derived at read time; the stored status stays pending/partial.
- Payment settles at a 0.01 tolerance, so a transfer landing 0.004 short does not leave the row
  forever "partial" and forever generating chasers. **Overpayment is refused**, not absorbed: it is
  nearly always a payment entered against the wrong installment, and absorbing it hides the real one.

### The reminder ladder
`RentAlertSettings` — one row per workspace, **seeded on first read, never at startup** (the startup
seed has no ambient tenant, so the row would land `TenantId = NULL` and be invisible to the very
workspace it was for; Module 5g hit exactly this). Holds: enabled, days-before list (default
`30,7,1`), overdue repeat (3 days) and cap (6), expiry days-before (`90,60,30`), CC list, "CC
everyone with Real Estate access", and a **time zone** (default `Asia/Dubai`).

**The time zone is stored, not assumed.** Rent due today in Dubai is still yesterday in UTC for four
hours — Module 43 hit the same thing with attendance. An unresolvable id falls back to UTC rather
than throwing, but the update handler rejects one up front so it cannot be saved.

**Rungs match by "tightest applicable", not by exact day.** An exact match (`daysUntil == 30`) sends
*nothing at all* if the service was down that day — the one failure mode this feature exists to
prevent. Taking the tightest unsent rung also means a first run against an existing book sends one
notice per payment, not one per configured lead time. `0` is always implicitly in play, so a payment
falling due today is announced even when the ladder stops at 1.

### Idempotency: claim first, then send
`RentAlertLog` + a **tenant-scoped unique index on (contract, installment, kind, offset key)**. The
sweep re-evaluates every open installment daily; without this a tenant is emailed the same "due in 7
days" notice every day until it falls due.

`ClaimAndSendAsync` writes the ledger row **before** sending — the opposite of the obvious order.
Sending first means a crash in between re-sends the notice next pass, and a tenant emailed the same
demand twice is a complaint. Claiming first means the worst case is a row recorded as *failed* and
visibly not delivered, which an operator can see and re-send. A duplicate claim (second worker,
retried run) hits the unique index and is skipped. Manual "send now" uses a `manual:<timestamp>` key
so it neither no-ops nor consumes a rung the automatic ladder still needs.

### Delivery
`IRealEstateEmailService` + `SmtpRealEstateEmailService` — the service's own small interface, per
this codebase's one-per-service convention (Identity, Restaurant), reading the same shared `Email`
config section. **Returns `bool`**: false when SMTP is unconfigured, so the log records the attempt
honestly instead of claiming a send that never happened. The settings screen surfaces that as a
banner, and `SendRentReminderHandler` returns a *failure*, not a cheerful 200 — "sent" when nothing
left the building is the most misleading thing this feature could say.

Recipients: tenant in **To**; CC = the configured list, plus (opt-in) every user holding a
`real-estate.*` permission, resolved by raw cross-schema SQL. **Not every workspace user** — that
list includes HR-only and self-service accounts with no business seeing a tenant's arrears.
`[identity]` is a reserved SQL Server keyword and must be bracketed (Module 5g). Scope note:
role-derived only; per-user grants/denies (Module 5h) are not applied. A failure to build the CC
list never stops the tenant's own reminder. Templates inline all CSS (mail clients strip
stylesheets) and HTML-encode every interpolated value — a tenant named `Smith & Co <Ltd>` would
otherwise break the markup.

### `RentAlertBackgroundService`
Daily, **5-minute startup delay** — every `MigrateAndSeed*` runs awaited before `app.RunAsync()`, so
work on the boot path delays `/health` and can trip the deploy's health window into a rollback (same
reasoning as `TrialLifecycleService`). `try/catch`-guarded at both levels: one workspace's bad data
must not stop every other workspace's rent, and an unhandled exception would kill the service for the
process lifetime. Fresh DI scope per workspace, and `TenantAmbient` is **cleared in a `finally`** —
it is an `AsyncLocal` and would otherwise leak into whatever runs next.

### Permissions — the module's first
`real-estate.properties/units/tenants/contracts/brokers/sales` (view/create/edit/delete),
`real-estate.rent` (**view/record/remind** — taking a cheque at the counter is a different decision
from editing the rent), `real-estate.alerts` (view/edit). Migration `AddRealEstatePermissions`
(29 rows; admins gain them via `SyncAdministratorPermissionsAsync` on startup).
`[RequirePermission]` applied across all 7 controllers. `ModuleRoleCatalogue` gained
`["real-estate"] = "Real Estate"`; `remind` added to `PrivilegedActions`.

**`record` and `remind` were added to `ACTION_ORDER`** — an action missing from that list renders no
column at all and cannot be granted through the UI (Module 42c).

### Frontend
`ContractDto` replaced with the real shape plus the derived fields the schedule makes possible
(`nextDueDate`, `overdueCount`, `overdueAmount`, `daysToExpiry`). Contracts view rewritten (overdue
sorts first, then soonest payment); contract drawer gained a **rent schedule tab** — record payment,
waive, send this reminder now; Add Contract wired to the real endpoint with property → vacant-unit →
tenant selectors (offering an occupied unit only produces a 409 after the form is filled in); new
**Rent & Expiry Alerts** page at `/real-estate/rent-alerts` with the settings, live overdue/due/
expiring queues, a **Preview (dry run)** button, and a sent log that shows *why* a notice failed.

### Build / Verification Status
- **Full backend solution:** 0 errors, 5 pre-existing warnings ✅
- **Frontend `tsc`:** 277 errors, **unchanged baseline**, none in a touched file · **`vite build`:** ✅
- **Schedule math verified by execution**, not assertion (figures above).
- Migrations `AddRentSchedulingAndAlerts` (Real Estate) + `AddRealEstatePermissions` (Identity)
  created; both auto-apply on startup.
- **Pending (needs republish + restart) — not runtime-verified against a live SMTP server:** create
  a lease → schedule generates; set the ladder and press **Preview** to see what would send; **Run
  now** and confirm the tenant receives it and the log shows it sent; record a payment and confirm
  the chasers stop; let one pass its due date and confirm the overdue ladder starts.

### Flagged, NOT fixed (scope)
- **`UnitDto` and `TenantDto` carry the same fictional-field drift `ContractDto` did.** The units
  endpoint returns `unitType`/`rentPerYear`/`salePrice`/`currentTenantName`; the frontend type
  declares `type`/`rentPricePA`/`bedrooms`/`bathrooms`/`contractExpiry`/`lastMaintenanceDate`, none
  of which exist — so those columns are blank in the Units and Tenants screens today. The **real**
  fields were added alongside the fictional ones and the new lease form uses them; rewriting
  `units-view` and `tenants-view` (~50 usages) is its own task.
- `createUnit` / `deleteUnit` / `createBroker` / `deleteBroker` still call endpoints that do not
  exist — Units and Brokers remain read-only on the server.
- Rent payments are recorded in Real Estate only; posting them to Finance as receivables was
  considered and deliberately not built (the self-contained option was chosen).

### Module 50b — Add Tenant 400, field-level validation errors, advance rent

**Three follow-ups from using the module.**

#### 1. Add Tenant returned 400 "The Name field is required"
`CreateTenantCommand` takes `Name`/`NationalId`/`CompanyName`; the form sent `fullName`/`emiratesId`/
`company`. It also sent six fields — `passportNo`, `trn`, `occupation`, `monthlyIncome`,
`emergencyContact`, `notes` — that the entity had nowhere to store, so even once the names matched
they would have been **silently discarded** (the Module 3 payroll-allowances bug again).

- `Tenant` gained `PassportNumber`, `Trn`, `Occupation`, `MonthlyIncome`, `EmergencyContact`,
  `Notes` (+ `SetProfile`, `SetStatus`, `Update`). Migration `AddTenantProfileFields`, applied.
- **`createTenant` was typed `Record<string, unknown>`** — which is precisely why the drift went
  unnoticed. Now a real `CreateTenantRequest`, so the compiler catches the next one.
- `CreateTenantHandler` rejects a duplicate tenant email with a readable `Tenant.Duplicate`:
  reminders are addressed by tenant, so two records sharing an address means one person gets both
  leases' notices and nobody can tell which is which.
- Validator messages renamed to the labels the user sees ("Full name is required", not "The Name
  field is required"), and the form now gates its button on nationality — which the API requires —
  instead of letting someone fill in fourteen fields and get a 400 back.

#### 2. Validation failures now land on the field, not in an anonymous toast
The shared client **ignored the `errors` dictionary entirely**, so a ProblemDetails 400 fell through
every `detail`/`description`/`message` lookup to a bare **"HTTP 400"** toast — the response named
the exact field and the user was told nothing.

- `ApiError` gained `fieldErrors` + `fieldError(name)` + `hasFieldErrors`. `extractFieldErrors`
  reads both shapes this backend produces: ASP.NET `{ errors: { Name: [...] } }` and
  FluentValidation `{ failures: [{ propertyName, errorMessage }] }`. Keys are lower-cased, because
  the server answers in PascalCase and forms think in camelCase. Applied to **both** clients — the
  envelope one too, since Identity can fail model binding before its envelope exists.
- The message now falls back to the first field message, then `title`, before `HTTP {status}`.
- **`useFieldErrors()`** (`hooks/use-field-errors.ts`) + **`<FieldError>`** (`components/ui/`).
  `capture(e)` only takes validation failures, so a generic error is still reported once by the
  mutation hook's toast rather than twice. `clearField` fires on edit — a message left up while the
  user fixes the value reads as "still wrong" when it no longer is. `role="alert"` because red text
  appearing below an input the user has already left is no signal to a screen reader.
- Wired into the Add Tenant form as the **reference implementation** (same approach as `<Can>` in
  Module 5h): per-field message, red border, `aria-invalid`, plus a form-level banner for ASP.NET's
  unnamed `""` bucket, which would otherwise be invisible.

#### 3. Advance rent at signing
`LeaseContract.ApplyAdvancePayment(amount, date, method, reference)` fills installments **in order**
until the advance runs out, and returns what was applied.

It cascades rather than paying only the first: an advance is usually "first and last month" or a
full year of cheques handed over on day one, and splitting that across twelve rows by hand is
exactly the chore that gets skipped — leaving a tenant who has already paid being chased for it.

- `CreateContractCommand` gained `AdvanceRentAmount` + date/method/reference (all optional,
  trailing). The handler refuses an advance larger than the whole schedule rather than absorbing it,
  and updates the tenant's stats with what was collected.
- `CreatedContractDto` returns `AdvanceApplied`, `InstallmentsSettledByAdvance` and `NextDueDate`,
  and the success toast states all three — that is the question the person creating the lease has.
- Form: an **Advance rent received** panel with one-tap "First payment / First two / Full year"
  buttons computed from the schedule, and a live line saying either *"the first payment is due on
  {startDate}, so reminders begin straight away"* or *"covers the first payment — reminders start
  from the one after it"*.

**"Start chasing from day one" already held**: `GenerateSchedule` dates installment 1 on the lease
start date, so with no advance it is due (or overdue) immediately and the ladder fires.
**"Stop once paid" already held too**: the sweep iterates `!i.IsSettled`, and `paid`/`waived` are
settled — so a paid installment leaves the reminder queue permanently, for the tenant and every
CC'd user alike.

**Verified by execution** (domain-level, not asserted): no advance → 4/4 unsettled, next due
2026-01-01; one quarter → 1 settled, next due 2026-04-01; full year → 0 in the reminder queue,
`nextDue` none; 1.5 months → row 1 paid, row 2 `partial` with a real balance and still in the queue;
an advance beyond the schedule caps at the scheduled total; and a settled installment stops
reporting overdue.

- **Full backend solution:** 0 errors ✅ · **`tsc`:** 277, unchanged baseline · **`vite build`:** ✅
- Migration `AddTenantProfileFields` created **and applied**; gateway restarts clean.

### Module 50c — Startup: a migration lock-release failure no longer kills the gateway

Reported as `SqlException: Cannot release the application lock ... '__EFMigrationsLock' ... because
it is not currently held`, thrown from `MigrateAndSeedCrmAsync`.

**It fires after the work has already succeeded.** EF takes a **session-scoped** `sp_getapplock`
before migrating and releases it in `SqlServerMigrationDatabaseLock.Dispose()`. A session lock dies
with its session, so if that connection is dropped or reset in between — a killed connection, a pool
reset, a second instance racing the same database — SQL Server has already released it and the
explicit release fails with **SQL error 1223** (confirmed by reproducing it directly).

CRM had no pending migrations at the time, so nothing was half-applied. But because the startup
block awaits each service in turn, this cleanup error **took down the whole gateway and skipped the
eight services queued after CRM** — which is why the Real Estate migration had not applied.

**Fix:** `MigrationRunner.MigrateTolerantOfLockReleaseAsync()` (BuildingBlocks), applied to all
**16** `MigrateAsync()` startup call sites. It swallows **only** 1223; anything else still
propagates, so a genuine migration failure still fails loudly rather than leaving the app running
against a half-migrated schema.

**Operational note:** running the VroduxERP Windows Service and an IDE instance at the same time
puts two processes on the same database and the same lock — a plausible route to exactly this.

### Module 50d — Properties page crashed on open (`Cannot read properties of undefined (reading 'className')`)

`properties-drawer.tsx` ran `STATUS_CONFIG[property.status].className`. Its map was keyed
`active` / `inactive` / `under_development`; `Property.Status` is `available` /
`partially_occupied` / `fully_occupied` (occupancy-derived, set by `UpdateOccupancy`). **No
overlap at all**, so the lookup was `undefined` for every property and the drawer took down the
whole page. Confirmed against live data: the tenant's properties are `available` ×1,
`partially_occupied` ×2 — `active` has never existed.

The list view survived only because it already had a `?? STATUS_FALLBACK` guard, and quietly
rendered every row as "Unknown".

**The `PropertyDto` was fictional too**, the same drift as `ContractDto`. Declared but never
returned: `propertyCode`, `type`, `vacantUnits`, `totalValue`, `annualRent`, `managedBy`,
`yearBuilt`, `facilities`. So the drawer also called `.map()` on an undefined `facilities`, and
`.toString()` on an undefined `yearBuilt`. Now mirrors the API: `propertyNumber`, `propertyType`,
`location`, `totalArea`, `totalUnits`, `occupiedUnits`, `marketValue`, `developer`, `description`,
`occupancyRate`, `units[]`. `RePropertySummaryDto` was wrong end to end and was replaced too.

**Rent is derived, not invented.** A property has no rent field — the API returns its `units`, and
rent lives on those. `annualRent` was undefined and reached `formatCurrency` as NaN. The drawer now
computes let-rent, full-occupancy rent, average per let unit and gross yield from the units, each
guarded against a zero denominator (dividing by zero let units produced `Infinity`, which rendered
as a nonsense figure rather than failing visibly). The "Facilities & Amenities" block — reading a
field no endpoint has ever sent — was replaced with the unit list, which is both real and what
someone opening a property actually wants.

**Swept the same pattern module-wide.** Four more unguarded `STATUS_CONFIG[x].className` lookups in
Units and Tenants. Their keys happen to match today's data (`vacant`/`rented`, `active`), so they do
not crash *now* — but they are one new status value away from the identical page-kill, and setting
unit status from bookings is on the table. All four now use a guarded accessor. **Zero bare indexes
remain in the module.**

This is the third instance of the same root cause in this codebase (Finance journals `voided`,
Module 4 #1; the WPS `payslips`/`slips` mismatch, Module 46c). The rule worth keeping: **never index
a config map bare, and never trust a hand-written DTO that no compiler checks against the server.**

- **`tsc`:** 277, unchanged baseline, none in a touched file · **`vite build`:** ✅ · Frontend only,
  no backend change, no migration.
- **Not confirmed in the browser** — the preview pane has no session and I did not use the user's
  credentials. Verified instead by (a) reading the real status values out of the database, and
  (b) proving no unguarded lookup remains.

### Module 50e — Property drawer actions wired, unit create/update/delete built, edit no longer wipes data

Reported: **View All Units / Generate Report / Edit / Print** all dead in the property drawer, and
the Add Unit property dropdown showing a static list.

#### The four dead buttons
None had an `onClick`. Now:
- **Edit** → opens `AddPropertyForm` with `editing` (the form already supported it; nothing had
  ever passed the prop). Parent clears `editing` on close, or the next "Add Property" would open
  in edit mode and overwrite the last-edited property.
- **Print** → `exportPdf` property profile.
- **Generate Report** → `exportPdf` unit-by-unit schedule, landscape, with occupancy and rent in
  the subtitle. Refuses on a property with no units — an empty table reads as a broken export
  rather than an empty property.
- **View All Units** → navigates to `/real-estate/units?propertyId=…`; the units list seeds its
  filter from the param and then strips it, so the filter can still be cleared.

#### 🔴 Editing a property silently wiped four fields
`AddPropertyForm`'s edit prefill set only name, emirate, city, address, totalUnits and developer.
The update is a **full replace**, so every unmissed field was overwritten on save: `marketValue` →
0, `totalArea` → 0, `description` → null, and `propertyType` reset to the default "Residential
Tower" regardless of what it was. Now every field the payload sends is prefilled, via a new
`codeToType` (lossy by nature — the backend stores three codes for eight display types, so a
"Warehouse" reopens as "Commercial Building"; that is the stored model's limit, and still far
better than resetting everything to Residential).

#### Add Unit was dead three times over
1. The property dropdown was **five hardcoded invented buildings**.
2. It submitted `propertyName` as a **string**; the API needs a `propertyId` GUID.
3. **`POST /api/real-estate/units` did not exist** — `UnitsController` was read-only.

Built `CreateUnitCommand` / `UpdateUnitCommand` / `DeleteUnitCommand` + handlers + POST/PUT/DELETE
(gated `real-estate.units.create|edit|delete`). Guards that matter:
- **Duplicate unit number within a property is rejected.** A unit number is how a lease, a tenant
  and a rent reminder all refer to the unit; two "101"s in one building makes all three ambiguous.
- **A unit with an active lease cannot be deleted** — it would orphan the lease, its rent schedule
  and its reminders, leaving a tenant chased for a unit that no longer exists.
- New `PropertyCounts.RefreshAsync` recomputes the parent's `TotalUnits` and `OccupiedUnits` from
  the real rows after add/delete. `TotalUnits` was previously a number typed on the property form,
  independent of how many units exist — so a property could claim 120 while holding 3, and the
  occupancy percentage derived from it was meaningless. Order matters: the count is set *before*
  `UpdateOccupancy`, which derives the status by comparing against it.

**Seven more silently-discarded form fields.** Add Unit collects furnishing, view, bedrooms,
bathrooms, parking, service charge and notes — none of which `PropertyUnit` could store. Added
rather than shipping inputs that vanish (same call as the tenant profile fields in 50b). Migration
`AddUnitDetailFields`.

`createUnit` was `Record<string, unknown>` — which is why the wrong field names went unnoticed.
Now `UpsertUnitRequest`, so the compiler catches the next one. Same fix as `createTenant` in 50b;
**`createBroker` is still untyped and still calls a nonexistent endpoint** — Brokers remains
read-only on the server, flagged not fixed.

- **RealEstate.API:** 0 errors, 0 warnings ✅ · **`tsc`:** 277, unchanged baseline · **`vite
  build`:** ✅
- The full-solution build reports 8 **MSB3027/MSB3021 file locks**, not compile errors — the
  running gateway (and Visual Studio) hold the RealEstate DLLs.
- Migration `AddUnitDetailFields` created; **needs a gateway restart to apply**.
