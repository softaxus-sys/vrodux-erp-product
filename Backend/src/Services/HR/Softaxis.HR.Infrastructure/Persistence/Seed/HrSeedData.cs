using Microsoft.EntityFrameworkCore;
using Softaxis.HR.Domain.Entities;

namespace Softaxis.HR.Infrastructure.Persistence.Seed;

/// <summary>
/// Idempotent seed data for the HR module.
/// Safe to re-run — checks by fixed GUID before inserting.
/// </summary>
public static class HrSeedData
{
    public static async Task SeedAsync(HrDbContext db)
    {
        await SeedDepartmentsAsync(db);
        await db.SaveChangesAsync();
        await SeedEmployeesAsync(db);
        await db.SaveChangesAsync();
        await SeedLeavesAsync(db);
        await SeedAttendanceAsync(db);
        await SeedPayrollAsync(db);
        await db.SaveChangesAsync();
    }

    // ── Fixed IDs ─────────────────────────────────────────────────────────────

    // Departments
    private static readonly Guid DeptHR       = new("a1000001-0000-0000-0000-000000000001");
    private static readonly Guid DeptIT       = new("a1000001-0000-0000-0000-000000000002");
    private static readonly Guid DeptFinance  = new("a1000001-0000-0000-0000-000000000003");
    private static readonly Guid DeptSales    = new("a1000001-0000-0000-0000-000000000004");
    private static readonly Guid DeptOps      = new("a1000001-0000-0000-0000-000000000005");
    private static readonly Guid DeptMarketing= new("a1000001-0000-0000-0000-000000000006");
    private static readonly Guid DeptLegal    = new("a1000001-0000-0000-0000-000000000007");

    // Employees
    private static readonly Guid EmpAhmed     = new("a2000002-0000-0000-0000-000000000001");
    private static readonly Guid EmpFatima    = new("a2000002-0000-0000-0000-000000000002");
    private static readonly Guid EmpKhalid    = new("a2000002-0000-0000-0000-000000000003");
    private static readonly Guid EmpSarah     = new("a2000002-0000-0000-0000-000000000004");
    private static readonly Guid EmpOmar      = new("a2000002-0000-0000-0000-000000000005");
    private static readonly Guid EmpLaila     = new("a2000002-0000-0000-0000-000000000006");
    private static readonly Guid EmpYusuf     = new("a2000002-0000-0000-0000-000000000007");
    private static readonly Guid EmpNour      = new("a2000002-0000-0000-0000-000000000008");
    private static readonly Guid EmpRashid    = new("a2000002-0000-0000-0000-000000000009");
    private static readonly Guid EmpMaya      = new("a2000002-0000-0000-0000-000000000010");
    private static readonly Guid EmpTariq     = new("a2000002-0000-0000-0000-000000000011");
    private static readonly Guid EmpSamira    = new("a2000002-0000-0000-0000-000000000012");
    private static readonly Guid EmpHassan    = new("a2000002-0000-0000-0000-000000000013");
    private static readonly Guid EmpZara      = new("a2000002-0000-0000-0000-000000000014");
    private static readonly Guid EmpKarim     = new("a2000002-0000-0000-0000-000000000015");

    // ── Departments ───────────────────────────────────────────────────────────

    private static async Task SeedDepartmentsAsync(HrDbContext db)
    {
        var existing = await db.Departments.IgnoreQueryFilters()
            .Select(d => d.Id).ToHashSetAsync();

        var depts = new[]
        {
            (DeptHR,        "Human Resources",       "HR",  "People, culture, and talent management"),
            (DeptIT,        "Information Technology", "IT",  "Technology infrastructure and software"),
            (DeptFinance,   "Finance & Accounting",  "FIN", "Financial planning and control"),
            (DeptSales,     "Sales",                 "SLS", "Revenue generation and customer relations"),
            (DeptOps,       "Operations",            "OPS", "Day-to-day business operations"),
            (DeptMarketing, "Marketing",             "MKT", "Brand, campaigns, and lead generation"),
            (DeptLegal,     "Legal & Compliance",    "LGL", "Legal affairs and regulatory compliance"),
        };

        foreach (var (id, name, code, desc) in depts)
        {
            if (existing.Contains(id)) continue;
            var dept = new Department(name, code, desc);
            SetId(dept, id);
            db.Departments.Add(dept);
        }
    }

    // ── Employees ─────────────────────────────────────────────────────────────

    private static async Task SeedEmployeesAsync(HrDbContext db)
    {
        var existing = await db.Employees.IgnoreQueryFilters()
            .Select(e => e.Id).ToHashSetAsync();

        var emps = new[]
        {
            (EmpAhmed,   "Ahmed",   "Al-Rashidi",  "ahmed.alrashidi@softaxis.com",  "+971-50-123-4567", "Chief Executive Officer",          DeptOps,       "full-time",  45000m, "2022-01-10", (Guid?)null,     "active"),
            (EmpFatima,  "Fatima",  "Hassan",      "fatima.hassan@softaxis.com",    "+971-50-234-5678", "HR Manager",                        DeptHR,        "full-time",  18000m, "2022-03-01", (Guid?)EmpAhmed, "active"),
            (EmpKhalid,  "Khalid",  "Al-Mansoori", "khalid.almansoori@softaxis.com","+971-55-345-6789", "IT Director",                       DeptIT,        "full-time",  22000m, "2022-02-15", (Guid?)EmpAhmed, "active"),
            (EmpSarah,   "Sarah",   "Mitchell",    "sarah.mitchell@softaxis.com",   "+971-52-456-7890", "Finance Manager",                   DeptFinance,   "full-time",  20000m, "2022-04-01", (Guid?)EmpAhmed, "active"),
            (EmpOmar,    "Omar",    "Abdullah",    "omar.abdullah@softaxis.com",    "+971-56-567-8901", "Sales Manager",                     DeptSales,     "full-time",  19000m, "2022-05-15", (Guid?)EmpAhmed, "active"),
            (EmpLaila,   "Laila",   "Nasser",      "laila.nasser@softaxis.com",     "+971-54-678-9012", "Senior Software Engineer",          DeptIT,        "full-time",  16000m, "2022-06-01", (Guid?)EmpKhalid,"active"),
            (EmpYusuf,   "Yusuf",   "Ibrahim",     "yusuf.ibrahim@softaxis.com",    "+971-58-789-0123", "Software Engineer",                 DeptIT,        "full-time",  13000m, "2023-01-15", (Guid?)EmpKhalid,"active"),
            (EmpNour,    "Nour",    "Saeed",       "nour.saeed@softaxis.com",       "+971-50-890-1234", "HR Specialist",                     DeptHR,        "full-time",  10000m, "2023-03-01", (Guid?)EmpFatima,"active"),
            (EmpRashid,  "Rashid",  "Al-Farsi",    "rashid.alfarsi@softaxis.com",   "+971-55-901-2345", "Senior Accountant",                 DeptFinance,   "full-time",  13500m, "2022-09-01", (Guid?)EmpSarah, "active"),
            (EmpMaya,    "Maya",    "Patel",       "maya.patel@softaxis.com",       "+971-52-012-3456", "Marketing Manager",                 DeptMarketing, "full-time",  17000m, "2022-07-01", (Guid?)EmpAhmed, "active"),
            (EmpTariq,   "Tariq",   "Al-Qasimi",   "tariq.alqasimi@softaxis.com",   "+971-56-123-4568", "Sales Executive",                   DeptSales,     "full-time",  10000m, "2023-02-01", (Guid?)EmpOmar,  "active"),
            (EmpSamira,  "Samira",  "Hamed",       "samira.hamed@softaxis.com",     "+971-54-234-5679", "Operations Coordinator",            DeptOps,       "full-time",  11000m, "2023-04-15", (Guid?)EmpAhmed, "active"),
            (EmpHassan,  "Hassan",  "Younis",      "hassan.younis@softaxis.com",    "+971-58-345-6790", "Legal Counsel",                     DeptLegal,     "full-time",  18500m, "2022-08-01", (Guid?)EmpAhmed, "active"),
            (EmpZara,    "Zara",    "Al-Nuaimi",   "zara.alnuaimi@softaxis.com",    "+971-50-456-7891", "QA Engineer",                       DeptIT,        "contract",   9000m,  "2023-06-01", (Guid?)EmpKhalid,"active"),
            (EmpKarim,   "Karim",   "Benali",      "karim.benali@softaxis.com",     "+971-55-567-8902", "Digital Marketing Specialist",      DeptMarketing, "full-time",  11500m, "2023-05-01", (Guid?)EmpMaya,  "active"),
        };

        foreach (var (id, first, last, email, phone, title, dept, empType, salary, joinDate, managerId, status) in emps)
        {
            if (existing.Contains(id)) continue;
            var emp = new Employee(first, last, email, phone, title, dept, GetDeptName(dept), empType, salary, joinDate, managerId, null);
            SetId(emp, id);
            db.Employees.Add(emp);
        }
    }

    private static string GetDeptName(Guid deptId) => deptId switch
    {
        var d when d == DeptHR        => "Human Resources",
        var d when d == DeptIT        => "Information Technology",
        var d when d == DeptFinance   => "Finance & Accounting",
        var d when d == DeptSales     => "Sales",
        var d when d == DeptOps       => "Operations",
        var d when d == DeptMarketing => "Marketing",
        var d when d == DeptLegal     => "Legal & Compliance",
        _ => "General"
    };

    // ── Leaves ────────────────────────────────────────────────────────────────

    private static async Task SeedLeavesAsync(HrDbContext db)
    {
        var existing = await db.Leaves.IgnoreQueryFilters()
            .Select(l => l.Id).ToHashSetAsync();

        var leaves = new[]
        {
            (new Guid("a3000003-0000-0000-0000-000000000001"), EmpTariq,  "Tariq Al-Qasimi",  "annual",    "2026-06-01", "2026-06-05", 5m,   "Annual vacation",          "approved"),
            (new Guid("a3000003-0000-0000-0000-000000000002"), EmpNour,   "Nour Saeed",       "sick",      "2026-05-20", "2026-05-22", 3m,   "Fever and flu",            "approved"),
            (new Guid("a3000003-0000-0000-0000-000000000003"), EmpYusuf,  "Yusuf Ibrahim",    "annual",    "2026-07-10", "2026-07-17", 8m,   "Family trip",              "pending"),
            (new Guid("a3000003-0000-0000-0000-000000000004"), EmpZara,   "Zara Al-Nuaimi",   "emergency", "2026-05-15", "2026-05-15", 1m,   "Family emergency",         "approved"),
            (new Guid("a3000003-0000-0000-0000-000000000005"), EmpSamira, "Samira Hamed",     "annual",    "2026-08-01", "2026-08-10", 10m,  "Summer holiday",           "pending"),
            (new Guid("a3000003-0000-0000-0000-000000000006"), EmpKarim,  "Karim Benali",     "sick",      "2026-05-10", "2026-05-11", 2m,   "Medical appointment",      "approved"),
            (new Guid("a3000003-0000-0000-0000-000000000007"), EmpLaila,  "Laila Nasser",     "annual",    "2026-06-15", "2026-06-19", 5m,   "Personal leave",           "approved"),
            (new Guid("a3000003-0000-0000-0000-000000000008"), EmpRashid, "Rashid Al-Farsi",  "annual",    "2026-09-01", "2026-09-05", 5m,   "Year-end vacation",        "pending"),
            (new Guid("a3000003-0000-0000-0000-000000000009"), EmpMaya,   "Maya Patel",       "maternity", "2026-07-01", "2026-09-30", 65m,  "Maternity leave",          "approved"),
            (new Guid("a3000003-0000-0000-0000-000000000010"), EmpHassan, "Hassan Younis",    "unpaid",    "2026-05-25", "2026-05-26", 2m,   "Personal matter",          "rejected"),
            (new Guid("a3000003-0000-0000-0000-000000000011"), EmpNour,   "Nour Saeed",       "annual",    "2026-08-15", "2026-08-22", 8m,   "Eid holiday trip",         "pending"),
            (new Guid("a3000003-0000-0000-0000-000000000012"), EmpTariq,  "Tariq Al-Qasimi",  "sick",      "2026-04-08", "2026-04-09", 2m,   "Stomach ache",             "approved"),
        };

        foreach (var (id, empId, empName, leaveType, start, end, days, reason, status) in leaves)
        {
            if (existing.Contains(id)) continue;
            var leave = new Leave(empId, empName, leaveType, start, end, days, reason);
            SetId(leave, id);
            if (status == "approved") leave.Approve(EmpFatima, "Approved");
            else if (status == "rejected") leave.Reject(EmpFatima, "Insufficient leave balance");
            db.Leaves.Add(leave);
        }
    }

    // ── Attendance ────────────────────────────────────────────────────────────

    private static async Task SeedAttendanceAsync(HrDbContext db)
    {
        // Check by (EmployeeId, Date) — NOT by GUID — so re-seeding after date
        // window shifts never tries to insert a row that already exists.
        var existingPairs = (await db.AttendanceLogs.IgnoreQueryFilters()
            .Select(a => new { a.EmployeeId, a.Date })
            .ToListAsync())
            .ToHashSet();

        var today  = DateTime.UtcNow.Date;
        var epoch  = new DateTime(2020, 1, 1); // fixed epoch for deterministic dateNum

        var coreEmps = new[] {
            (EmpAhmed,  "Ahmed Al-Rashidi"),
            (EmpFatima, "Fatima Hassan"),
            (EmpKhalid, "Khalid Al-Mansoori"),
            (EmpSarah,  "Sarah Mitchell"),
            (EmpOmar,   "Omar Abdullah"),
            (EmpLaila,  "Laila Nasser"),
            (EmpYusuf,  "Yusuf Ibrahim"),
            (EmpRashid, "Rashid Al-Farsi"),
            (EmpMaya,   "Maya Patel"),
            (EmpTariq,  "Tariq Al-Qasimi"),
        };

        var workDays = new List<DateTime>();
        var d = today.AddDays(-30);
        while (d <= today)
        {
            if (d.DayOfWeek != DayOfWeek.Friday && d.DayOfWeek != DayOfWeek.Saturday)
                workDays.Add(d);
            d = d.AddDays(1);
        }

        foreach (var (empId, empName) in coreEmps)
        {
            // Last 12 hex chars of employee GUID — unique across all seed employees
            var empSuffix = empId.ToString("N")[20..];

            foreach (var day in workDays)
            {
                var dateStr = day.ToString("yyyy-MM-dd");
                if (existingPairs.Contains(new { EmployeeId = empId, Date = dateStr })) continue;

                // Deterministic GUID: stable for a given (employee, date) across restarts
                var dateNum = (day - epoch).Days;
                var attId = new Guid($"a4{dateNum:000000}-0000-0000-0000-{empSuffix}");

                // Per-record random seeded from (employee, date) — stable status values
                var rng  = new Random(empId.GetHashCode() ^ day.GetHashCode());
                var roll = rng.Next(100);

                string  status;
                string? checkIn = null, checkOut = null;
                decimal? hours  = null;

                if (roll < 85)
                {
                    status   = "present";
                    checkIn  = $"0{7 + rng.Next(2)}:{rng.Next(60):00}";
                    checkOut = $"{16 + rng.Next(3)}:{rng.Next(60):00}";
                    hours    = Math.Round(8m + (decimal)(rng.NextDouble() * 2 - 1), 1);
                }
                else if (roll < 92) { status = "remote";   checkIn = "09:00"; checkOut = "17:30"; hours = 8.5m; }
                else if (roll < 96) { status = "half-day"; checkIn = "09:00"; checkOut = "13:00"; hours = 4m;   }
                else                { status = "absent"; }

                var att = new AttendanceLog(empId, empName, dateStr, checkIn, checkOut, hours, status, null);
                SetId(att, attId);
                db.AttendanceLogs.Add(att);
            }
        }
    }

    // ── Payroll ───────────────────────────────────────────────────────────────

    private static async Task SeedPayrollAsync(HrDbContext db)
    {
        var existingRuns = await db.PayrollRuns.IgnoreQueryFilters()
            .Select(p => p.Id).ToHashSetAsync();

        var periods = new[]
        {
            (new Guid("a5000005-0000-0000-0000-000000000001"), "2026-02", "paid"),
            (new Guid("a5000005-0000-0000-0000-000000000002"), "2026-03", "paid"),
            (new Guid("a5000005-0000-0000-0000-000000000003"), "2026-04", "processed"),
            (new Guid("a5000005-0000-0000-0000-000000000004"), "2026-05", "draft"),
        };

        // Employees for payroll (salary data)
        var payrollEmps = new[]
        {
            (EmpAhmed,   "Ahmed Al-Rashidi",   "Chief Executive Officer",  "Operations",            45000m),
            (EmpFatima,  "Fatima Hassan",       "HR Manager",               "Human Resources",       18000m),
            (EmpKhalid,  "Khalid Al-Mansoori",  "IT Director",              "Information Technology", 22000m),
            (EmpSarah,   "Sarah Mitchell",      "Finance Manager",          "Finance & Accounting",  20000m),
            (EmpOmar,    "Omar Abdullah",       "Sales Manager",            "Sales",                 19000m),
            (EmpLaila,   "Laila Nasser",        "Senior Software Engineer", "Information Technology", 16000m),
            (EmpYusuf,   "Yusuf Ibrahim",       "Software Engineer",        "Information Technology", 13000m),
            (EmpNour,    "Nour Saeed",          "HR Specialist",            "Human Resources",       10000m),
            (EmpRashid,  "Rashid Al-Farsi",     "Senior Accountant",        "Finance & Accounting",  13500m),
            (EmpMaya,    "Maya Patel",          "Marketing Manager",        "Marketing",             17000m),
            (EmpTariq,   "Tariq Al-Qasimi",     "Sales Executive",          "Sales",                 10000m),
            (EmpSamira,  "Samira Hamed",        "Operations Coordinator",   "Operations",            11000m),
            (EmpHassan,  "Hassan Younis",       "Legal Counsel",            "Legal & Compliance",    18500m),
            (EmpZara,    "Zara Al-Nuaimi",      "QA Engineer",              "Information Technology",  9000m),
            (EmpKarim,   "Karim Benali",        "Digital Marketing Specialist","Marketing",           11500m),
        };

        var slipCounter = 1;
        foreach (var (runId, period, status) in periods)
        {
            if (existingRuns.Contains(runId)) continue;

            var run = new PayrollRun(period, $"Payroll for {period}");
            SetId(run, runId);
            db.PayrollRuns.Add(run);
            await db.SaveChangesAsync();

            // Create slips for each employee
            foreach (var (empId, empName, jobTitle, deptName, basicSalary) in payrollEmps)
            {
                var slipId = new Guid($"a6{slipCounter++:000000}-0000-0000-0000-000000000001");
                var allowances = basicSalary * 0.25m;    // 25% housing + transport
                var deductions = basicSalary * 0.05m;    // 5% social insurance
                var slip = new PayrollSlip(runId, empId, empName, jobTitle, deptName, basicSalary, allowances, deductions, null);
                SetId(slip, slipId);
                db.PayrollSlips.Add(slip);
            }

            await db.SaveChangesAsync();

            // Reload and recalculate totals
            var reloaded = await db.PayrollRuns.Include(r => r.Slips).FirstAsync(r => r.Id == runId);
            reloaded.Recalculate();

            if (status == "processed" || status == "paid") reloaded.MarkProcessed();
            if (status == "paid") reloaded.MarkPaid();
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static void SetId(object entity, Guid id)
    {
        var prop = entity.GetType().GetProperty("Id")!;
        prop.SetValue(entity, id);
    }
}
