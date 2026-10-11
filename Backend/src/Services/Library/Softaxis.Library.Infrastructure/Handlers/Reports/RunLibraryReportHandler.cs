using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Library.Application.Abstractions;
using Softaxis.Library.Application.Reports;
using Softaxis.Library.Domain.Entities;
using Softaxis.Library.Infrastructure.Persistence;

namespace Softaxis.Library.Infrastructure.Handlers.Reports;

/// <summary>
/// Runs one library report by id for the central Reports hub, in the tabular shape the hub's
/// runner expects (columns + rows keyed by column name).
///
/// There is no separate "library reports" permission: each report needs the permission of the
/// area it reads, so someone who may not open Fines cannot read the fines reports either. Staff
/// limited to a branch get loan and copy figures for their branches only; members and fines
/// belong to the whole library and are not narrowed — the same line the screens draw.
/// </summary>
internal sealed class RunLibraryReportHandler(LibraryDbContext db, ICurrentUser user, IBranchAccess access)
    : IQueryHandler<RunLibraryReportQuery, TabularReportDto>
{
    private const int MaxRows = 5000;

    private sealed record Ctx(string From, string To, string Today, IReadOnlyCollection<Guid>? Branches);

    private static readonly Dictionary<string, string[]> Needs = new()
    {
        ["library-overdue-loans"]        = ["library.circulation.view"],
        ["library-loans-register"]       = ["library.circulation.view"],
        ["library-daily-circulation"]    = ["library.circulation.view"],
        ["library-popular-titles"]       = ["library.circulation.view", "library.catalog.view"],
        ["library-branch-activity"]      = ["library.circulation.view"],
        ["library-stock-by-category"]    = ["library.catalog.view"],
        ["library-not-borrowed"]         = ["library.catalog.view"],
        ["library-lost-damaged"]         = ["library.catalog.view"],
        ["library-member-activity"]      = ["library.members.view"],
        ["library-expiring-memberships"] = ["library.members.view"],
        ["library-fines-collected"]      = ["library.fines.view"],
        ["library-fines-outstanding"]    = ["library.fines.view"],
    };

    public async Task<Result<TabularReportDto>> Handle(RunLibraryReportQuery q, CancellationToken ct)
    {
        if (!Needs.TryGetValue(q.ReportId, out var needs))
            return Result.Failure<TabularReportDto>(Error.Custom("Report.NotFound", $"Unknown library report '{q.ReportId}'."));

        if (!user.IsSuperAdmin && !needs.Any(user.HasPermission))
            return Result.Failure<TabularReportDto>(Error.Custom("Report.Forbidden",
                "You do not have permission to run this report."));

        var today = LibraryDates.Today(q.Today);
        var to    = LibraryDates.Clean(q.To) ?? today;
        var from  = LibraryDates.Clean(q.From) ?? LibraryDates.AddDays(to, -30);
        if (string.CompareOrdinal(from, to) > 0) (from, to) = (to, from);
        var c = new Ctx(from, to, today, await access.AllowedBranchIdsAsync(ct));

        return Result.Success(q.ReportId switch
        {
            "library-overdue-loans"        => await OverdueLoansAsync(c, ct),
            "library-loans-register"       => await LoansRegisterAsync(c, ct),
            "library-daily-circulation"    => await DailyCirculationAsync(c, ct),
            "library-popular-titles"       => await PopularTitlesAsync(c, ct),
            "library-branch-activity"      => await BranchActivityAsync(c, ct),
            "library-stock-by-category"    => await StockByCategoryAsync(c, ct),
            "library-not-borrowed"         => await NotBorrowedAsync(c, ct),
            "library-lost-damaged"         => await LostDamagedAsync(c, ct),
            "library-member-activity"      => await MemberActivityAsync(c, ct),
            "library-expiring-memberships" => await ExpiringMembershipsAsync(c, ct),
            "library-fines-collected"      => await FinesCollectedAsync(c, ct),
            _                              => await FinesOutstandingAsync(ct),
        });
    }

    // ── Shared ──────────────────────────────────────────────────────────────

    private static TabularReportDto Build(string[] cols, IEnumerable<object?[]> rows)
    {
        var list = rows.Select(r =>
        {
            var d = new Dictionary<string, object?>(cols.Length);
            for (var i = 0; i < cols.Length; i++) d[cols[i]] = r[i];
            return d;
        }).ToList();
        return new TabularReportDto(cols, list, list.Count);
    }

    private static decimal R(decimal v) => Math.Round(v, 2);
    private static string Label(string s) => s.Length == 0 ? s : char.ToUpperInvariant(s[0]) + s[1..].Replace('_', ' ');

    private IQueryable<Loan> Loans(Ctx c)
    {
        var q = db.Loans.AsNoTracking();
        return c.Branches is null ? q : q.Where(l => c.Branches.Contains(l.BranchId));
    }

    private IQueryable<BookCopy> Copies(Ctx c)
    {
        var q = db.Copies.AsNoTracking().Where(x => !x.IsDeleted);
        return c.Branches is null ? q : q.Where(x => c.Branches.Contains(x.BranchId));
    }

    private Task<Dictionary<Guid, string>> BranchNamesAsync(CancellationToken ct) => LibraryRules.BranchNamesAsync(db, ct);

    // ── Circulation ─────────────────────────────────────────────────────────

    private async Task<TabularReportDto> OverdueLoansAsync(Ctx c, CancellationToken ct)
    {
        var rows = await (
            from l in Loans(c)
            where l.Status == LoanStatus.Active && string.Compare(l.DueDate, c.Today) < 0
            join m in db.Members.AsNoTracking() on l.MemberId equals m.Id
            join t in db.Titles.AsNoTracking() on l.TitleId equals t.Id
            join cp in db.Copies.AsNoTracking() on l.CopyId equals cp.Id
            orderby l.DueDate
            select new { m.FullName, m.MemberNumber, m.Phone, m.MembershipTypeId, t.Title, cp.Barcode, l.BranchId, l.IssuedOn, l.DueDate }
        ).Take(MaxRows).ToListAsync(ct);

        var branches = await BranchNamesAsync(ct);
        var rates = await db.MembershipTypes.AsNoTracking().ToDictionaryAsync(t => t.Id, t => t.FinePerDay, ct);

        return Build(
            ["Member", "Card No.", "Phone", "Title", "Barcode", "Branch", "Issued", "Due", "Days Overdue", "Fine So Far"],
            rows.Select(r =>
            {
                var days = LibraryDates.DaysBetween(r.DueDate, c.Today);
                return new object?[]
                {
                    r.FullName, r.MemberNumber, r.Phone, r.Title, r.Barcode, branches.GetValueOrDefault(r.BranchId),
                    r.IssuedOn, r.DueDate, days, R(days * rates.GetValueOrDefault(r.MembershipTypeId)),
                };
            }));
    }

    private async Task<TabularReportDto> LoansRegisterAsync(Ctx c, CancellationToken ct)
    {
        var rows = await (
            from l in Loans(c)
            where string.Compare(l.IssuedOn, c.From) >= 0 && string.Compare(l.IssuedOn, c.To) <= 0
            join m in db.Members.AsNoTracking() on l.MemberId equals m.Id
            join t in db.Titles.AsNoTracking() on l.TitleId equals t.Id
            join cp in db.Copies.AsNoTracking() on l.CopyId equals cp.Id
            orderby l.IssuedOn descending, l.CreatedAt descending
            select new { l.IssuedOn, t.Title, cp.Barcode, m.FullName, m.MemberNumber, l.BranchId, l.DueDate, l.ReturnedOn, l.RenewalCount, l.Status, l.IssuedByName }
        ).Take(MaxRows).ToListAsync(ct);

        var branches = await BranchNamesAsync(ct);
        return Build(
            ["Issued", "Title", "Barcode", "Member", "Card No.", "Branch", "Due", "Returned", "Renewals", "Status", "Issued By"],
            rows.Select(r => new object?[]
            {
                r.IssuedOn, r.Title, r.Barcode, r.FullName, r.MemberNumber, branches.GetValueOrDefault(r.BranchId), r.DueDate,
                r.ReturnedOn, r.RenewalCount,
                r.Status == LoanStatus.Active && string.CompareOrdinal(r.DueDate, c.Today) < 0 ? "Overdue" : Label(r.Status),
                r.IssuedByName,
            }));
    }

    private async Task<TabularReportDto> DailyCirculationAsync(Ctx c, CancellationToken ct)
    {
        var issued = await Loans(c)
            .Where(l => string.Compare(l.IssuedOn, c.From) >= 0 && string.Compare(l.IssuedOn, c.To) <= 0)
            .GroupBy(l => l.IssuedOn).Select(g => new { Day = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Day, x => x.Count, ct);

        var returned = await Loans(c)
            .Where(l => l.ReturnedOn != null && string.Compare(l.ReturnedOn, c.From) >= 0 && string.Compare(l.ReturnedOn, c.To) <= 0)
            .GroupBy(l => l.ReturnedOn!).Select(g => new { Day = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Day, x => x.Count, ct);

        var days = issued.Keys.Union(returned.Keys).OrderBy(d => d, StringComparer.Ordinal).ToList();
        return Build(["Date", "Issued", "Returned", "Net Out"],
            days.Select(d =>
            {
                int i = issued.GetValueOrDefault(d), r = returned.GetValueOrDefault(d);
                return new object?[] { d, i, r, i - r };
            }));
    }

    private async Task<TabularReportDto> PopularTitlesAsync(Ctx c, CancellationToken ct)
    {
        var counts = await Loans(c)
            .Where(l => string.Compare(l.IssuedOn, c.From) >= 0 && string.Compare(l.IssuedOn, c.To) <= 0)
            .GroupBy(l => l.TitleId).Select(g => new { TitleId = g.Key, Loans = g.Count() })
            .OrderByDescending(x => x.Loans).Take(200).ToListAsync(ct);

        var ids = counts.Select(x => x.TitleId).ToList();
        var titles = await db.Titles.AsNoTracking().Where(t => ids.Contains(t.Id)).ToDictionaryAsync(t => t.Id, ct);
        var copies = await Copies(c).Where(x => ids.Contains(x.TitleId))
            .GroupBy(x => x.TitleId).Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count, ct);

        return Build(["Title", "Authors", "Category", "Loans", "Copies", "Loans per Copy"],
            counts.Where(x => titles.ContainsKey(x.TitleId)).Select(x =>
            {
                var t = titles[x.TitleId];
                var n = copies.GetValueOrDefault(x.TitleId);
                return new object?[] { t.Title, t.Authors, t.Category, x.Loans, n, n == 0 ? 0 : Math.Round((decimal)x.Loans / n, 1) };
            }));
    }

    private async Task<TabularReportDto> BranchActivityAsync(Ctx c, CancellationToken ct)
    {
        var branches = await db.Branches.AsNoTracking().Where(b => !b.IsDeleted).OrderBy(b => b.Name)
            .Select(b => new { b.Id, b.Name }).ToListAsync(ct);
        if (c.Branches is not null) branches = branches.Where(b => c.Branches.Contains(b.Id)).ToList();

        var stock = await Copies(c).GroupBy(x => new { x.BranchId, x.Status })
            .Select(g => new { g.Key.BranchId, g.Key.Status, Count = g.Count() }).ToListAsync(ct);

        var issued = await Loans(c)
            .Where(l => string.Compare(l.IssuedOn, c.From) >= 0 && string.Compare(l.IssuedOn, c.To) <= 0)
            .GroupBy(l => l.BranchId).Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count, ct);

        // Returns are counted where the book was handed in, which is not always where it was issued.
        var returned = await db.Loans.AsNoTracking()
            .Where(l => l.ReturnBranchId != null && l.ReturnedOn != null
                        && string.Compare(l.ReturnedOn, c.From) >= 0 && string.Compare(l.ReturnedOn, c.To) <= 0)
            .GroupBy(l => l.ReturnBranchId!.Value).Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count, ct);

        var overdue = await Loans(c)
            .Where(l => l.Status == LoanStatus.Active && string.Compare(l.DueDate, c.Today) < 0)
            .GroupBy(l => l.BranchId).Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count, ct);

        return Build(["Branch", "Copies", "Available", "On Loan", "Issued in Period", "Returned in Period", "Overdue Now"],
            branches.Select(b =>
            {
                var mine = stock.Where(s => s.BranchId == b.Id).ToList();
                return new object?[]
                {
                    b.Name, mine.Sum(s => s.Count),
                    mine.Where(s => s.Status == CopyStatus.Available).Sum(s => s.Count),
                    mine.Where(s => s.Status == CopyStatus.OnLoan).Sum(s => s.Count),
                    issued.GetValueOrDefault(b.Id), returned.GetValueOrDefault(b.Id), overdue.GetValueOrDefault(b.Id),
                };
            }));
    }

    // ── Catalogue ───────────────────────────────────────────────────────────

    private async Task<TabularReportDto> StockByCategoryAsync(Ctx c, CancellationToken ct)
    {
        var rows = await (
            from cp in Copies(c)
            join t in db.Titles.AsNoTracking() on cp.TitleId equals t.Id
            where !t.IsDeleted
            group cp by new { t.Category, cp.Status } into g
            select new { g.Key.Category, g.Key.Status, Count = g.Count(), Value = g.Sum(x => x.Price) }
        ).ToListAsync(ct);

        // Titles are counted once per category, not once per status they happen to have a copy in.
        var titleCounts = await (
            from t in db.Titles.AsNoTracking()
            where !t.IsDeleted && Copies(c).Any(cp => cp.TitleId == t.Id)
            group t by t.Category into g
            select new { Category = g.Key, Count = g.Count() }
        ).ToListAsync(ct);

        string[] gone = [CopyStatus.Lost, CopyStatus.Damaged, CopyStatus.Withdrawn];
        return Build(["Category", "Titles", "Copies", "Available", "On Loan", "Lost / Damaged / Withdrawn", "Value of Copies"],
            rows.GroupBy(r => r.Category ?? "").OrderBy(g => g.Key == "" ? "~" : g.Key, StringComparer.OrdinalIgnoreCase)
                .Select(g => new object?[]
                {
                    g.Key == "" ? "(No category)" : g.Key,
                    titleCounts.FirstOrDefault(t => (t.Category ?? "") == g.Key)?.Count ?? 0,
                    g.Sum(r => r.Count),
                    g.Where(r => r.Status == CopyStatus.Available).Sum(r => r.Count),
                    g.Where(r => r.Status == CopyStatus.OnLoan).Sum(r => r.Count),
                    g.Where(r => gone.Contains(r.Status)).Sum(r => r.Count),
                    R(g.Where(r => !gone.Contains(r.Status)).Sum(r => r.Value)),
                }));
    }

    private async Task<TabularReportDto> NotBorrowedAsync(Ctx c, CancellationToken ct)
    {
        var copies = Copies(c);
        var rows = await db.Titles.AsNoTracking()
            .Where(t => !t.IsDeleted
                        && copies.Any(cp => cp.TitleId == t.Id)
                        && !db.Loans.Any(l => l.TitleId == t.Id
                                              && string.Compare(l.IssuedOn, c.From) >= 0 && string.Compare(l.IssuedOn, c.To) <= 0))
            .OrderBy(t => t.Title)
            .Select(t => new
            {
                t.Title, t.Authors, t.Category,
                Copies = copies.Count(cp => cp.TitleId == t.Id),
                Last   = db.Loans.Where(l => l.TitleId == t.Id).Max(l => (string?)l.IssuedOn),
                t.CreatedAt,
            })
            .Take(MaxRows).ToListAsync(ct);

        return Build(["Title", "Authors", "Category", "Copies", "Last Borrowed", "Added"],
            rows.Select(r => new object?[] { r.Title, r.Authors, r.Category, r.Copies, r.Last ?? "Never", r.CreatedAt.ToString("yyyy-MM-dd") }));
    }

    private async Task<TabularReportDto> LostDamagedAsync(Ctx c, CancellationToken ct)
    {
        string[] gone = [CopyStatus.Lost, CopyStatus.Damaged, CopyStatus.Withdrawn];
        var rows = await (
            from cp in Copies(c)
            where gone.Contains(cp.Status)
            join t in db.Titles.AsNoTracking() on cp.TitleId equals t.Id
            orderby cp.Status, t.Title
            select new { t.Title, t.Authors, cp.Barcode, cp.BranchId, cp.Status, cp.Price, t.ReplacementCost, cp.UpdatedAt, cp.Notes }
        ).Take(MaxRows).ToListAsync(ct);

        var branches = await BranchNamesAsync(ct);
        return Build(["Title", "Authors", "Barcode", "Branch", "Status", "Price", "Replacement Cost", "Last Changed", "Notes"],
            rows.Select(r => new object?[]
            {
                r.Title, r.Authors, r.Barcode, branches.GetValueOrDefault(r.BranchId), Label(r.Status), R(r.Price),
                R(r.ReplacementCost), r.UpdatedAt?.ToString("yyyy-MM-dd"), r.Notes,
            }));
    }

    // ── Members ─────────────────────────────────────────────────────────────

    private async Task<TabularReportDto> MemberActivityAsync(Ctx c, CancellationToken ct)
    {
        var borrowed = await Loans(c)
            .Where(l => string.Compare(l.IssuedOn, c.From) >= 0 && string.Compare(l.IssuedOn, c.To) <= 0)
            .GroupBy(l => l.MemberId).Select(g => new { MemberId = g.Key, Loans = g.Count() })
            .OrderByDescending(x => x.Loans).Take(1000).ToListAsync(ct);

        var ids = borrowed.Select(x => x.MemberId).ToList();
        var members = await db.Members.AsNoTracking().Where(m => ids.Contains(m.Id)).ToDictionaryAsync(m => m.Id, ct);
        var types = await db.MembershipTypes.AsNoTracking().ToDictionaryAsync(t => t.Id, t => t.Name, ct);

        var open = await db.Loans.AsNoTracking()
            .Where(l => l.Status == LoanStatus.Active && ids.Contains(l.MemberId))
            .Select(l => new { l.MemberId, l.DueDate }).ToListAsync(ct);

        var fines = await db.Fines.AsNoTracking()
            .Where(f => f.Status == FineStatus.Unpaid && ids.Contains(f.MemberId))
            .GroupBy(f => f.MemberId).Select(g => new { g.Key, Balance = g.Sum(f => f.Amount - f.AmountPaid) })
            .ToDictionaryAsync(x => x.Key, x => x.Balance, ct);

        return Build(["Member", "Card No.", "Membership", "Borrowed in Period", "Out Now", "Overdue Now", "Unpaid Fines"],
            borrowed.Where(x => members.ContainsKey(x.MemberId)).Select(x =>
            {
                var m = members[x.MemberId];
                var mine = open.Where(o => o.MemberId == m.Id).ToList();
                return new object?[]
                {
                    m.FullName, m.MemberNumber, types.GetValueOrDefault(m.MembershipTypeId), x.Loans, mine.Count,
                    mine.Count(o => string.CompareOrdinal(o.DueDate, c.Today) < 0), R(fines.GetValueOrDefault(m.Id)),
                };
            }));
    }

    private async Task<TabularReportDto> ExpiringMembershipsAsync(Ctx c, CancellationToken ct)
    {
        var until = LibraryDates.AddDays(c.Today, 60);
        var rows = await db.Members.AsNoTracking()
            .Where(m => !m.IsDeleted && m.ExpiresOn != null && string.Compare(m.ExpiresOn, until) <= 0)
            .OrderBy(m => m.ExpiresOn).Take(MaxRows).ToListAsync(ct);

        var types = await db.MembershipTypes.AsNoTracking().ToDictionaryAsync(t => t.Id, t => t.Name, ct);
        return Build(["Member", "Card No.", "Membership", "Phone", "Email", "Expires", "Days Left", "State"],
            rows.Select(m =>
            {
                var days = LibraryDates.DaysBetween(c.Today, m.ExpiresOn!);
                return new object?[]
                {
                    m.FullName, m.MemberNumber, types.GetValueOrDefault(m.MembershipTypeId), m.Phone, m.Email, m.ExpiresOn,
                    days, days < 0 ? "Expired" : "Expiring",
                };
            }));
    }

    // ── Fines ───────────────────────────────────────────────────────────────

    private async Task<TabularReportDto> FinesCollectedAsync(Ctx c, CancellationToken ct)
    {
        var rows = await (
            from p in db.FinePayments.AsNoTracking()
            where string.Compare(p.PaidOn, c.From) >= 0 && string.Compare(p.PaidOn, c.To) <= 0
            join f in db.Fines.AsNoTracking() on p.FineId equals f.Id
            join m in db.Members.AsNoTracking() on p.MemberId equals m.Id into members
            from m in members.DefaultIfEmpty()
            orderby p.PaidOn descending, p.CreatedAt descending
            select new { p.PaidOn, Name = m != null ? m.FullName : null, Number = m != null ? m.MemberNumber : null, f.Type, f.Title, p.Method, p.Amount, p.JournalEntryNumber, p.JournalEntryId }
        ).Take(MaxRows).ToListAsync(ct);

        return Build(["Date", "Member", "Card No.", "Fine Type", "Title", "Method", "Amount", "In Accounts"],
            rows.Select(r => new object?[]
            {
                r.PaidOn, r.Name, r.Number, Label(r.Type), r.Title, Label(r.Method), R(r.Amount),
                r.JournalEntryId is null ? "No" : r.JournalEntryNumber ?? "Yes",
            }));
    }

    private async Task<TabularReportDto> FinesOutstandingAsync(CancellationToken ct)
    {
        var rows = await (
            from f in db.Fines.AsNoTracking()
            where f.Status == FineStatus.Unpaid
            join m in db.Members.AsNoTracking() on f.MemberId equals m.Id
            orderby m.FullName, f.CreatedOn
            select new { m.FullName, m.MemberNumber, m.Phone, f.Type, f.Title, f.CreatedOn, f.Amount, f.AmountPaid }
        ).Take(MaxRows).ToListAsync(ct);

        return Build(["Member", "Card No.", "Phone", "Fine Type", "Title", "Raised", "Amount", "Paid", "Balance"],
            rows.Select(r => new object?[]
            {
                r.FullName, r.MemberNumber, r.Phone, Label(r.Type), r.Title, r.CreatedOn, R(r.Amount), R(r.AmountPaid),
                R(r.Amount - r.AmountPaid),
            }));
    }
}
