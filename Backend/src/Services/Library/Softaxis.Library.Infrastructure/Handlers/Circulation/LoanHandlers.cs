using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Library.Application.Catalogue;
using Softaxis.Library.Application.Circulation;
using Softaxis.Library.Domain.Entities;
using Softaxis.Library.Infrastructure.Persistence;

namespace Softaxis.Library.Infrastructure.Handlers.Circulation;

internal static class LoanReader
{
    // Init properties, not a positional record: EF can filter and sort on a member-init
    // projection, but not on one built through a constructor.
    private sealed class Row
    {
        public Loan    Loan         { get; init; } = null!;
        public string  Barcode      { get; init; } = null!;
        public string  Title        { get; init; } = null!;
        public string  Authors      { get; init; } = null!;
        public string  MemberNumber { get; init; } = null!;
        public string  MemberName   { get; init; } = null!;
        public string? MemberPhone  { get; init; }
    }

    // Copies, titles and members are joined without a soft-delete check on purpose: a loan's
    // history must still read correctly after the book or the member has been removed.
    private static IQueryable<Row> Rows(LibraryDbContext db) =>
        from l in db.Loans.AsNoTracking()
        join c in db.Copies.AsNoTracking()  on l.CopyId   equals c.Id
        join t in db.Titles.AsNoTracking()  on l.TitleId  equals t.Id
        join m in db.Members.AsNoTracking() on l.MemberId equals m.Id
        select new Row
        {
            Loan = l, Barcode = c.Barcode, Title = t.Title, Authors = t.Authors,
            MemberNumber = m.MemberNumber, MemberName = m.FullName, MemberPhone = m.Phone,
        };

    public static async Task<PagedDto<LoanDto>> PageAsync(LibraryDbContext db, GetLoansQuery q, CancellationToken ct)
    {
        var today = LibraryDates.Today(q.Today);
        var rows  = Rows(db);

        rows = q.Status switch
        {
            "active"   => rows.Where(r => r.Loan.Status == LoanStatus.Active),
            "overdue"  => rows.Where(r => r.Loan.Status == LoanStatus.Active && string.Compare(r.Loan.DueDate, today) < 0),
            "returned" => rows.Where(r => r.Loan.Status == LoanStatus.Returned),
            "lost"     => rows.Where(r => r.Loan.Status == LoanStatus.Lost),
            _          => rows,
        };

        if (q.BranchId is { } branchId) rows = rows.Where(r => r.Loan.BranchId == branchId);
        if (q.MemberId is { } memberId) rows = rows.Where(r => r.Loan.MemberId == memberId);
        if (q.TitleId  is { } titleId)  rows = rows.Where(r => r.Loan.TitleId == titleId);

        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var s = q.Search.Trim();
            rows = rows.Where(r => r.Title.Contains(s) || r.Barcode.Contains(s)
                                   || r.MemberName.Contains(s) || r.MemberNumber.Contains(s));
        }

        var total    = await rows.CountAsync(ct);
        var pageSize = Math.Clamp(q.PageSize, 1, 200);
        var page     = Math.Max(q.Page, 1);

        // What is out is read by what is due soonest; history by what happened last.
        rows = q.Status is "active" or "overdue"
            ? rows.OrderBy(r => r.Loan.DueDate)
            : rows.OrderByDescending(r => r.Loan.CreatedAt);

        var list     = await rows.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);
        var branches = await LibraryRules.BranchNamesAsync(db, ct);

        return new PagedDto<LoanDto>(list.Select(r => Map(r, branches, today)).ToList(), total);
    }

    public static async Task<LoanDto> OneAsync(LibraryDbContext db, Guid loanId, string today, CancellationToken ct)
    {
        var row      = await Rows(db).FirstAsync(r => r.Loan.Id == loanId, ct);
        var branches = await LibraryRules.BranchNamesAsync(db, ct);
        return Map(row, branches, today);
    }

    private static LoanDto Map(Row r, Dictionary<Guid, string> branches, string today)
    {
        var l = r.Loan;
        // An item that came back late was overdue until the day it was returned.
        var days = Math.Max(0, LibraryDates.DaysBetween(l.DueDate, l.ReturnedOn ?? today));
        return new LoanDto(
            l.Id, l.CopyId, r.Barcode, l.TitleId, r.Title, r.Authors,
            l.MemberId, r.MemberNumber, r.MemberName, r.MemberPhone,
            l.BranchId, branches.GetValueOrDefault(l.BranchId, "—"), l.IssuedOn, l.DueDate, l.ReturnedOn,
            l.ReturnBranchId is { } rb ? branches.GetValueOrDefault(rb, "—") : null,
            l.RenewalCount, l.Status, l.Status == LoanStatus.Active && days > 0, days, l.IssuedByName);
    }
}

internal sealed class GetLoansHandler(LibraryDbContext db) : IQueryHandler<GetLoansQuery, PagedDto<LoanDto>>
{
    public async Task<Result<PagedDto<LoanDto>>> Handle(GetLoansQuery q, CancellationToken ct) =>
        Result.Success(await LoanReader.PageAsync(db, q, ct));
}

internal sealed class IssueLoanHandler(LibraryDbContext db) : ICommandHandler<IssueLoanCommand, LoanDto>
{
    public async Task<Result<LoanDto>> Handle(IssueLoanCommand cmd, CancellationToken ct)
    {
        var today = LibraryDates.Today(cmd.Today);

        var member = await db.Members.AsNoTracking().FirstOrDefaultAsync(m => m.Id == cmd.MemberId && !m.IsDeleted, ct);
        if (member is null) return Result.Failure<LoanDto>(Error.NotFoundById("Member", cmd.MemberId));
        if (LibraryRules.Blocked(member, today) is { } blocked)
            return Result.Failure<LoanDto>(Error.Custom("Loan.Conflict", blocked));

        var type = await db.MembershipTypes.AsNoTracking().FirstOrDefaultAsync(t => t.Id == member.MembershipTypeId, ct);
        if (type is null) return Result.Failure<LoanDto>(Error.NotFoundById("MembershipType", member.MembershipTypeId));

        var copy = await db.Copies.FirstOrDefaultAsync(c => c.Id == cmd.CopyId && !c.IsDeleted, ct);
        if (copy is null) return Result.Failure<LoanDto>(Error.NotFoundById("Copy", cmd.CopyId));

        var mine = await db.Reservations
            .Where(r => r.TitleId == copy.TitleId && r.MemberId == member.Id
                        && (r.Status == ReservationStatus.Waiting || r.Status == ReservationStatus.Ready))
            .FirstOrDefaultAsync(ct);

        switch (copy.Status)
        {
            case CopyStatus.Available:
                break;

            // A held copy goes only to the member it is being held for.
            case CopyStatus.Reserved when mine is not null && mine.CopyId == copy.Id:
                break;

            case CopyStatus.Reserved:
                return Result.Failure<LoanDto>(Error.Custom("Loan.Conflict",
                    "This copy is being held for another member's reservation."));

            default:
                return Result.Failure<LoanDto>(Error.Custom("Loan.Conflict",
                    $"This copy is {copy.Status.Replace('_', ' ')} and cannot be issued."));
        }

        var onLoan = await db.Loans.CountAsync(l => l.MemberId == member.Id && l.Status == LoanStatus.Active, ct);
        if (onLoan >= type.MaxLoans)
            return Result.Failure<LoanDto>(Error.Custom("Loan.Conflict",
                $"{member.FullName} already has {onLoan} items out — the limit for {type.Name} members is {type.MaxLoans}."));

        var due = LibraryDates.Clean(cmd.DueDate);
        if (due is null || string.CompareOrdinal(due, today) < 0) due = LibraryDates.AddDays(today, type.LoanDays);

        var loan = new Loan(copy.Id, copy.TitleId, member.Id, copy.BranchId, today, due, cmd.IssuedByName);
        db.Loans.Add(loan);
        copy.Issue();

        // Borrowing the book settles the member's own reservation for it. If a different copy was
        // being held for them, that copy goes back to the shelf (or to whoever is next).
        if (mine is not null)
        {
            var otherHeldCopyId = mine.Status == ReservationStatus.Ready && mine.CopyId != copy.Id ? mine.CopyId : null;
            mine.Fulfil();
            await db.SaveChangesAsync(ct);

            if (otherHeldCopyId is { } heldId
                && await db.Copies.FirstOrDefaultAsync(c => c.Id == heldId && c.Status == CopyStatus.Reserved, ct) is { } held)
            {
                held.SetStatus(CopyStatus.Available);
                await LibraryRules.HoldForNextReservationAsync(db, held, today, ct);
            }
        }

        await db.SaveChangesAsync(ct);
        return Result.Success(await LoanReader.OneAsync(db, loan.Id, today, ct));
    }
}

internal sealed class ReturnLoanHandler(LibraryDbContext db) : ICommandHandler<ReturnLoanCommand, ReturnResultDto>
{
    public async Task<Result<ReturnResultDto>> Handle(ReturnLoanCommand cmd, CancellationToken ct)
    {
        var today = LibraryDates.Today(cmd.Today);

        var loan = await db.Loans.FirstOrDefaultAsync(l => l.Id == cmd.LoanId, ct);
        if (loan is null) return Result.Failure<ReturnResultDto>(Error.NotFoundById("Loan", cmd.LoanId));
        if (loan.Status != LoanStatus.Active)
            return Result.Failure<ReturnResultDto>(Error.Custom("Loan.Conflict", $"This loan is already {loan.Status}."));

        var branchId = cmd.ReturnBranchId ?? loan.BranchId;
        if (!await db.Branches.AnyAsync(b => b.Id == branchId && !b.IsDeleted, ct))
            return Result.Failure<ReturnResultDto>(Error.NotFoundById("Branch", branchId));

        var copy = await db.Copies.FirstAsync(c => c.Id == loan.CopyId, ct);

        var (days, fine) = await LoanCharges.ChargeOverdueAsync(db, loan, today, ct);

        loan.Return(today, branchId, cmd.Notes);

        // The copy now lives where it was handed in. Sending it back to its old branch is a
        // transfer, done from the catalogue when the library wants that.
        copy.ShelveAt(branchId, cmd.Damaged);
        var held = await LibraryRules.HoldForNextReservationAsync(db, copy, today, ct);

        await db.SaveChangesAsync(ct);

        string? heldFor = null, heldAt = null;
        if (held is not null)
        {
            heldFor = await db.Members.AsNoTracking().Where(m => m.Id == held.MemberId)
                              .Select(m => m.FullName).FirstOrDefaultAsync(ct);
            heldAt  = await db.Branches.AsNoTracking().Where(b => b.Id == held.PickupBranchId)
                              .Select(b => b.Name).FirstOrDefaultAsync(ct);
        }

        return Result.Success(new ReturnResultDto(
            await LoanReader.OneAsync(db, loan.Id, today, ct), days, fine, heldFor, heldAt));
    }
}

internal sealed class RenewLoanHandler(LibraryDbContext db) : ICommandHandler<RenewLoanCommand, LoanDto>
{
    public async Task<Result<LoanDto>> Handle(RenewLoanCommand cmd, CancellationToken ct)
    {
        var today = LibraryDates.Today(cmd.Today);

        var loan = await db.Loans.FirstOrDefaultAsync(l => l.Id == cmd.LoanId, ct);
        if (loan is null) return Result.Failure<LoanDto>(Error.NotFoundById("Loan", cmd.LoanId));
        if (loan.Status != LoanStatus.Active)
            return Result.Failure<LoanDto>(Error.Custom("Loan.Conflict", $"This loan is already {loan.Status}."));

        var member = await db.Members.AsNoTracking().FirstAsync(m => m.Id == loan.MemberId, ct);
        if (LibraryRules.Blocked(member, today) is { } blocked)
            return Result.Failure<LoanDto>(Error.Custom("Loan.Conflict", blocked));

        var type = await db.MembershipTypes.AsNoTracking().FirstOrDefaultAsync(t => t.Id == member.MembershipTypeId, ct);
        if (type is null) return Result.Failure<LoanDto>(Error.NotFoundById("MembershipType", member.MembershipTypeId));

        if (loan.RenewalCount >= type.MaxRenewals)
            return Result.Failure<LoanDto>(Error.Custom("Loan.Conflict",
                type.MaxRenewals == 0
                    ? $"{type.Name} members cannot renew."
                    : $"This loan has been renewed {loan.RenewalCount} time(s) — the limit for {type.Name} members is {type.MaxRenewals}."));

        var waiting = await db.Reservations.CountAsync(
            r => r.TitleId == loan.TitleId && r.Status == ReservationStatus.Waiting, ct);
        if (waiting > 0)
            return Result.Failure<LoanDto>(Error.Custom("Loan.Conflict",
                $"{waiting} member(s) are waiting for this title, so it cannot be renewed."));

        // Renewing late does not wipe the days already overdue.
        await LoanCharges.ChargeOverdueAsync(db, loan, today, ct);

        loan.Renew(LibraryDates.AddDays(today, type.LoanDays));
        await db.SaveChangesAsync(ct);
        return Result.Success(await LoanReader.OneAsync(db, loan.Id, today, ct));
    }
}

internal sealed class MarkLoanLostHandler(LibraryDbContext db) : ICommandHandler<MarkLoanLostCommand, LoanDto>
{
    public async Task<Result<LoanDto>> Handle(MarkLoanLostCommand cmd, CancellationToken ct)
    {
        var today = LibraryDates.Today(cmd.Today);

        var loan = await db.Loans.FirstOrDefaultAsync(l => l.Id == cmd.LoanId, ct);
        if (loan is null) return Result.Failure<LoanDto>(Error.NotFoundById("Loan", cmd.LoanId));
        if (loan.Status != LoanStatus.Active)
            return Result.Failure<LoanDto>(Error.Custom("Loan.Conflict", $"This loan is already {loan.Status}."));

        var copy  = await db.Copies.FirstAsync(c => c.Id == loan.CopyId, ct);
        var title = await db.Titles.AsNoTracking().FirstAsync(t => t.Id == loan.TitleId, ct);

        loan.MarkLost(today);
        copy.SetStatus(CopyStatus.Lost);

        // The title's replacement cost, or failing that what this copy cost. Neither set = no charge.
        var charge = title.ReplacementCost > 0 ? title.ReplacementCost : copy.Price;
        if (charge > 0)
            db.Fines.Add(new Fine(loan.MemberId, loan.Id, "lost", charge, title.Title,
                $"Lost copy {copy.Barcode}", today));

        await db.SaveChangesAsync(ct);
        return Result.Success(await LoanReader.OneAsync(db, loan.Id, today, ct));
    }
}

internal static class LoanCharges
{
    /// <summary>
    /// Adds an overdue fine for the days this loan is past its due date, at the member's current
    /// daily rate. Returns the days and the amount (both zero when nothing is owed).
    /// </summary>
    public static async Task<(int Days, decimal Fine)> ChargeOverdueAsync(
        LibraryDbContext db, Loan loan, string today, CancellationToken ct)
    {
        var days = Math.Max(0, LibraryDates.DaysBetween(loan.DueDate, today));
        if (days == 0) return (0, 0);

        var rate = await (
            from m in db.Members.AsNoTracking()
            join t in db.MembershipTypes.AsNoTracking() on m.MembershipTypeId equals t.Id
            where m.Id == loan.MemberId
            select (decimal?)t.FinePerDay).FirstOrDefaultAsync(ct) ?? 0;

        var amount = Math.Round(days * rate, 2);
        if (amount <= 0) return (days, 0);

        var title = await db.Titles.AsNoTracking().Where(t => t.Id == loan.TitleId)
                            .Select(t => t.Title).FirstOrDefaultAsync(ct);
        db.Fines.Add(new Fine(loan.MemberId, loan.Id, "overdue", amount, title,
            $"{days} day(s) overdue (due {loan.DueDate})", today));
        return (days, amount);
    }
}
