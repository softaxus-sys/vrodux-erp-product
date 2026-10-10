using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.Library.Application.Catalogue;
using Softaxis.Library.Domain.Entities;
using Softaxis.Library.Infrastructure.Persistence;

namespace Softaxis.Library.Infrastructure.Handlers;

/// <summary>
/// Library dates are calendar days ("yyyy-MM-dd"), which sort and compare correctly as text.
/// </summary>
internal static class LibraryDates
{
    private const string Format = "yyyy-MM-dd";

    /// <summary>
    /// "Today" as the desk sees it. The server clock is UTC, so a branch east of Greenwich is
    /// already on tomorrow for a few hours each night — the client's date is used when it is
    /// within a day of the server's, and ignored otherwise.
    /// </summary>
    public static string Today(string? clientToday)
    {
        var utc = DateOnly.FromDateTime(DateTime.UtcNow);
        return TryParse(clientToday, out var d) && Math.Abs(d.DayNumber - utc.DayNumber) <= 1
            ? Text(d)
            : Text(utc);
    }

    public static bool IsValid(string? date) => TryParse(date, out _);

    public static string? Clean(string? date) => TryParse(date, out var d) ? Text(d) : null;

    public static string AddDays(string date, int days) =>
        Text(DateOnly.ParseExact(date, Format, CultureInfo.InvariantCulture).AddDays(days));

    /// <summary>Whole days from <paramref name="from"/> to <paramref name="to"/>; negative if earlier.</summary>
    public static int DaysBetween(string from, string to) =>
        DateOnly.ParseExact(to, Format, CultureInfo.InvariantCulture).DayNumber
        - DateOnly.ParseExact(from, Format, CultureInfo.InvariantCulture).DayNumber;

    private static bool TryParse(string? date, out DateOnly value) =>
        DateOnly.TryParseExact(date, Format, CultureInfo.InvariantCulture, DateTimeStyles.None, out value);

    private static string Text(DateOnly d) => d.ToString(Format, CultureInfo.InvariantCulture);
}

internal static class LibraryRules
{
    /// <summary>Days a copy is kept aside once a reservation comes up.</summary>
    public const int HoldDays = 3;

    public static bool IsExpired(Member m, string today) =>
        m.ExpiresOn is not null && string.CompareOrdinal(m.ExpiresOn, today) < 0;

    /// <summary>Why this member cannot borrow or reserve right now, or null when they can.</summary>
    public static string? Blocked(Member m, string today) =>
        m.Status == MemberStatus.Suspended ? $"{m.FullName}'s membership is suspended."
        : IsExpired(m, today)              ? $"{m.FullName}'s membership expired on {m.ExpiresOn}."
        : null;

    /// <summary>
    /// If someone is waiting for this title at the branch the copy is now at, keep the copy aside
    /// for the member who has waited longest. Call after a copy becomes available, before saving.
    /// </summary>
    public static async Task<Reservation?> HoldForNextReservationAsync(
        LibraryDbContext db, BookCopy copy, string today, CancellationToken ct)
    {
        if (copy.Status != CopyStatus.Available) return null;

        var next = await db.Reservations
            .Where(r => r.TitleId == copy.TitleId
                        && r.Status == ReservationStatus.Waiting
                        && r.PickupBranchId == copy.BranchId)
            .OrderBy(r => r.CreatedAt)
            .FirstOrDefaultAsync(ct);
        if (next is null) return null;

        copy.HoldForReservation();
        next.MarkReady(copy.Id, today, LibraryDates.AddDays(today, HoldDays));
        return next;
    }

    /// <summary>Unused barcodes, continuing from how many copies the library has ever had.</summary>
    public static async Task<List<string>> NextBarcodesAsync(LibraryDbContext db, int count, CancellationToken ct)
    {
        var start  = await db.Copies.CountAsync(ct) + 1;
        var result = new List<string>(count);

        while (result.Count < count)
        {
            var batch = Enumerable.Range(start, count - result.Count).Select(i => $"BK{i:D6}").ToList();
            var taken = await db.Copies.Where(c => !c.IsDeleted && batch.Contains(c.Barcode))
                                       .Select(c => c.Barcode).ToListAsync(ct);
            result.AddRange(batch.Except(taken, StringComparer.OrdinalIgnoreCase));
            start += batch.Count;
        }
        return result;
    }

    public static async Task<string> NextMemberNumberAsync(LibraryDbContext db, CancellationToken ct)
    {
        var n = await db.Members.CountAsync(ct) + 1;
        while (true)
        {
            var candidate = $"LM{n:D5}";
            if (!await db.Members.AnyAsync(m => !m.IsDeleted && m.MemberNumber == candidate, ct)) return candidate;
            n++;
        }
    }

    public static Task<Dictionary<Guid, string>> BranchNamesAsync(LibraryDbContext db, CancellationToken ct) =>
        db.Branches.AsNoTracking().ToDictionaryAsync(b => b.Id, b => b.Name, ct);
}

/// <summary>
/// A new workspace starts with one branch and three membership types, created the first time
/// they are read. Not seeded at startup: a startup pass has no tenant, so its rows would belong
/// to nobody. Rows the tenant later deletes still count, so the defaults never come back.
/// </summary>
internal static class LibraryDefaults
{
    private static bool HasTenant => !TenantAmbient.BypassFilter && TenantAmbient.TenantId is not null;

    public static async Task EnsureBranchAsync(LibraryDbContext db, CancellationToken ct)
    {
        if (!HasTenant || await db.Branches.AnyAsync(ct)) return;
        db.Branches.Add(new LibraryBranch("Main Library", "MAIN", null, null, null));
        await db.SaveChangesAsync(ct);
    }

    public static async Task EnsureMembershipTypesAsync(LibraryDbContext db, CancellationToken ct)
    {
        if (!HasTenant || await db.MembershipTypes.AnyAsync(ct)) return;
        db.MembershipTypes.AddRange(
            new MembershipType("Standard", maxLoans: 5,  loanDays: 14, maxRenewals: 2, finePerDay: 1,    maxReservations: 3, annualFee: 0),
            new MembershipType("Student",  maxLoans: 3,  loanDays: 14, maxRenewals: 1, finePerDay: 0.5m, maxReservations: 2, annualFee: 0),
            new MembershipType("Staff",    maxLoans: 10, loanDays: 30, maxRenewals: 3, finePerDay: 0,    maxReservations: 5, annualFee: 0));
        await db.SaveChangesAsync(ct);
    }
}

/// <summary>Builds <see cref="CopyDto"/>s, filling in the title, branch names and current borrower.</summary>
internal static class CopyReader
{
    public static async Task<List<CopyDto>> ToDtosAsync(LibraryDbContext db, List<BookCopy> copies, CancellationToken ct)
    {
        if (copies.Count == 0) return [];

        var titleIds = copies.Select(c => c.TitleId).Distinct().ToList();
        var copyIds  = copies.Select(c => c.Id).ToList();

        var titles   = await db.Titles.AsNoTracking().Where(t => titleIds.Contains(t.Id))
                               .ToDictionaryAsync(t => t.Id, ct);
        var branches = await LibraryRules.BranchNamesAsync(db, ct);

        var loans = await (
            from l in db.Loans.AsNoTracking()
            join m in db.Members.AsNoTracking() on l.MemberId equals m.Id
            where l.Status == LoanStatus.Active && copyIds.Contains(l.CopyId)
            select new { l.Id, l.CopyId, l.MemberId, m.FullName, l.DueDate }).ToListAsync(ct);
        var loanByCopy = loans.GroupBy(l => l.CopyId).ToDictionary(g => g.Key, g => g.First());

        return copies.Select(c =>
        {
            titles.TryGetValue(c.TitleId, out var title);
            loanByCopy.TryGetValue(c.Id, out var loan);
            return new CopyDto(
                c.Id, c.TitleId, title?.Title ?? "—", title?.Authors ?? string.Empty, c.Barcode,
                c.BranchId, branches.GetValueOrDefault(c.BranchId, "—"), c.Status, c.ShelfLocation, c.Condition,
                c.AcquiredOn, c.Price, c.Notes,
                c.TransitToBranchId,
                c.TransitToBranchId is { } to ? branches.GetValueOrDefault(to, "—") : null,
                loan?.Id, loan?.MemberId, loan?.FullName, loan?.DueDate);
        }).ToList();
    }

    public static async Task<CopyDto> ToDtoAsync(LibraryDbContext db, BookCopy copy, CancellationToken ct) =>
        (await ToDtosAsync(db, [copy], ct))[0];
}
