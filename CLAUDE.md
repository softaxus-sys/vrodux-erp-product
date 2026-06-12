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

## Build Status
- **TypeScript (frontend):** 0 errors ✅
- **Backend Finance service:** 0 errors ✅
- **Backend HR service:** 0 errors ✅ (2 migrations applied)
- **Backend Identity service:** 0 errors ✅
- **Backend Inventory service:** 0 errors ✅
