using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Library.Application.Abstractions;
using Softaxis.Library.Application.Circulation;
using Softaxis.Library.Domain.Entities;
using Softaxis.Library.Infrastructure.Persistence;

namespace Softaxis.Library.Infrastructure.Handlers.Circulation;

// ── Reservations ────────────────────────────────────────────────────────────

internal static class ReservationReader
{
    public static async Task<List<ReservationDto>> ToDtosAsync(
        LibraryDbContext db, IQueryable<Reservation> query, string today, CancellationToken ct)
    {
        var rows = await (
            from r in query.AsNoTracking()
            join t in db.Titles.AsNoTracking()  on r.TitleId  equals t.Id
            join m in db.Members.AsNoTracking() on r.MemberId equals m.Id
            orderby r.CreatedAt
            select new { R = r, t.Title, m.MemberNumber, m.FullName, m.Phone }).ToListAsync(ct);
        if (rows.Count == 0) return [];

        var branches = await LibraryRules.BranchNamesAsync(db, ct);
        var copyIds  = rows.Where(x => x.R.CopyId != null).Select(x => x.R.CopyId!.Value).ToList();
        var barcodes = await db.Copies.AsNoTracking().Where(c => copyIds.Contains(c.Id))
                               .ToDictionaryAsync(c => c.Id, c => c.Barcode, ct);

        return rows.Select(x => new ReservationDto(
            x.R.Id, x.R.TitleId, x.Title, x.R.MemberId, x.MemberNumber, x.FullName, x.Phone,
            x.R.PickupBranchId, branches.GetValueOrDefault(x.R.PickupBranchId, "—"), x.R.Status, x.R.CopyId,
            x.R.CopyId is { } c ? barcodes.GetValueOrDefault(c) : null,
            x.R.ReservedOn, x.R.ReadyOn, x.R.HoldUntil,
            x.R.Status == ReservationStatus.Ready && x.R.HoldUntil is not null
                && string.CompareOrdinal(x.R.HoldUntil, today) < 0)).ToList();
    }
}

internal sealed class GetReservationsHandler(LibraryDbContext db, IBranchAccess branches)
    : IQueryHandler<GetReservationsQuery, IReadOnlyList<ReservationDto>>
{
    public async Task<Result<IReadOnlyList<ReservationDto>>> Handle(GetReservationsQuery q, CancellationToken ct)
    {
        IQueryable<Reservation> query = db.Reservations;

        query = q.Status switch
        {
            "open" => query.Where(r => r.Status == ReservationStatus.Waiting || r.Status == ReservationStatus.Ready),
            null or "" or "all" => query,
            var s  => query.Where(r => r.Status == s),
        };
        // Branch staff see the reservations to be collected from them (or all of one member's).
        if (q.MemberId is null && await branches.AllowedBranchIdsAsync(ct) is { } allowed)
            query = query.Where(r => allowed.Contains(r.PickupBranchId));

        if (q.BranchId is { } branchId) query = query.Where(r => r.PickupBranchId == branchId);
        if (q.MemberId is { } memberId) query = query.Where(r => r.MemberId == memberId);
        if (q.TitleId  is { } titleId)  query = query.Where(r => r.TitleId == titleId);

        // Open reservations are few; closed ones pile up, so history is capped to the latest.
        if (q.Status is not ("open" or "waiting" or "ready"))
            query = query.OrderByDescending(r => r.CreatedAt).Take(500);

        return Result.Success<IReadOnlyList<ReservationDto>>(
            await ReservationReader.ToDtosAsync(db, query, LibraryDates.Today(q.Today), ct));
    }
}

internal sealed class CreateReservationHandler(LibraryDbContext db, IBranchAccess branches)
    : ICommandHandler<CreateReservationCommand, ReservationDto>
{
    public async Task<Result<ReservationDto>> Handle(CreateReservationCommand cmd, CancellationToken ct)
    {
        var today = LibraryDates.Today(cmd.Today);

        var member = await db.Members.AsNoTracking().FirstOrDefaultAsync(m => m.Id == cmd.MemberId && !m.IsDeleted, ct);
        if (member is null) return Result.Failure<ReservationDto>(Error.NotFoundById("Member", cmd.MemberId));
        if (LibraryRules.Blocked(member, today) is { } blocked)
            return Result.Failure<ReservationDto>(Error.Custom("Reservation.Conflict", blocked));

        var title = await db.Titles.AsNoTracking().FirstOrDefaultAsync(t => t.Id == cmd.TitleId && !t.IsDeleted, ct);
        if (title is null) return Result.Failure<ReservationDto>(Error.NotFoundById("Title", cmd.TitleId));

        if (!await db.Branches.AnyAsync(b => b.Id == cmd.PickupBranchId && !b.IsDeleted && b.IsActive, ct))
            return Result.Failure<ReservationDto>(Error.NotFoundById("Branch", cmd.PickupBranchId));
        if (await branches.DeniedAsync(cmd.PickupBranchId, ct) is { } denied) return Result.Failure<ReservationDto>(denied);

        if (!await db.Copies.AnyAsync(c => c.TitleId == title.Id && !c.IsDeleted
                && c.Status != CopyStatus.Lost && c.Status != CopyStatus.Withdrawn && c.Status != CopyStatus.Damaged, ct))
            return Result.Failure<ReservationDto>(Error.Custom("Reservation.Conflict",
                $"\"{title.Title}\" has no copies in circulation to reserve."));

        var open = await db.Reservations.AsNoTracking()
            .Where(r => r.MemberId == member.Id
                        && (r.Status == ReservationStatus.Waiting || r.Status == ReservationStatus.Ready))
            .Select(r => r.TitleId).ToListAsync(ct);

        if (open.Contains(title.Id))
            return Result.Failure<ReservationDto>(Error.Custom("Reservation.Duplicate",
                $"{member.FullName} has already reserved \"{title.Title}\"."));

        var type = await db.MembershipTypes.AsNoTracking().FirstOrDefaultAsync(t => t.Id == member.MembershipTypeId, ct);

        // A member holding this title must wait a set number of days from the day it was issued
        // before reserving it again (1 by default, 0 = no wait). The latest loan decides.
        var waitDays = type?.SameTitleReserveAfterDays ?? 1;
        if (waitDays > 0)
        {
            var issuedOn = await db.Loans.AsNoTracking()
                .Where(l => l.MemberId == member.Id && l.TitleId == title.Id && l.Status == LoanStatus.Active)
                .OrderByDescending(l => l.IssuedOn).Select(l => l.IssuedOn).FirstOrDefaultAsync(ct);
            if (issuedOn is not null && LibraryDates.DaysBetween(issuedOn, today) < waitDays)
            {
                var from = LibraryDates.AddDays(issuedOn, waitDays);
                return Result.Failure<ReservationDto>(Error.Custom("Reservation.Conflict",
                    $"{member.FullName} borrowed \"{title.Title}\" on {issuedOn} and can reserve it again from {from}. This is not a stock problem."));
            }
        }
        var limit = type?.MaxReservations ?? 0;
        if (open.Count >= limit)
            return Result.Failure<ReservationDto>(Error.Custom("Reservation.Conflict",
                limit == 0
                    ? $"{type?.Name ?? "This"} members cannot place reservations."
                    : $"{member.FullName} already has {open.Count} open reservations — the limit is {limit}."));

        var reservation = new Reservation(title.Id, member.Id, cmd.PickupBranchId, today);
        db.Reservations.Add(reservation);

        // If a copy is on the shelf at the pickup branch and nobody is ahead in the queue there,
        // it is set aside straight away.
        var queueAhead = await db.Reservations.AnyAsync(r => r.TitleId == title.Id
            && r.PickupBranchId == cmd.PickupBranchId && r.Status == ReservationStatus.Waiting, ct);
        if (!queueAhead)
        {
            var shelf = await db.Copies
                .Where(c => c.TitleId == title.Id && !c.IsDeleted
                            && c.BranchId == cmd.PickupBranchId && c.Status == CopyStatus.Available)
                .OrderBy(c => c.Barcode).FirstOrDefaultAsync(ct);
            if (shelf is not null)
            {
                shelf.HoldForReservation();
                reservation.MarkReady(shelf.Id, today, LibraryDates.AddDays(today, LibraryRules.HoldDays));
            }
        }

        await db.SaveChangesAsync(ct);
        return Result.Success((await ReservationReader.ToDtosAsync(
            db, db.Reservations.Where(r => r.Id == reservation.Id), today, ct))[0]);
    }
}

internal sealed class CancelReservationHandler(LibraryDbContext db, IBranchAccess branches) : ICommandHandler<CancelReservationCommand>
{
    public async Task<Result> Handle(CancelReservationCommand cmd, CancellationToken ct)
    {
        var reservation = await db.Reservations.FirstOrDefaultAsync(r => r.Id == cmd.Id, ct);
        if (reservation is null) return Result.Failure(Error.NotFoundById("Reservation", cmd.Id));
        if (reservation.Status is not (ReservationStatus.Waiting or ReservationStatus.Ready))
            return Result.Failure(Error.Custom("Reservation.Conflict", $"This reservation is already {reservation.Status}."));
        if (await branches.DeniedAsync(reservation.PickupBranchId, ct) is { } denied) return Result.Failure(denied);

        var heldCopyId = reservation.Status == ReservationStatus.Ready ? reservation.CopyId : null;
        reservation.Cancel();
        // Saved first, so the search for who is next no longer sees this reservation.
        await db.SaveChangesAsync(ct);

        if (heldCopyId is { } copyId
            && await db.Copies.FirstOrDefaultAsync(c => c.Id == copyId && c.Status == CopyStatus.Reserved, ct) is { } copy)
        {
            copy.SetStatus(CopyStatus.Available);
            await LibraryRules.HoldForNextReservationAsync(db, copy, LibraryDates.Today(cmd.Today), ct);
            await db.SaveChangesAsync(ct);
        }

        return Result.Success();
    }
}

// ── Fines ───────────────────────────────────────────────────────────────────

internal static class FineReader
{
    public static async Task<List<FineDto>> ToDtosAsync(LibraryDbContext db, IQueryable<Fine> query, CancellationToken ct)
    {
        var rows = await (
            from f in query.AsNoTracking()
            join m in db.Members.AsNoTracking() on f.MemberId equals m.Id
            orderby f.CreatedAt descending
            select new { F = f, m.MemberNumber, m.FullName }).ToListAsync(ct);

        return rows.Select(x => new FineDto(
            x.F.Id, x.F.MemberId, x.MemberNumber, x.FullName, x.F.LoanId, x.F.Title, x.F.Type,
            x.F.Amount, x.F.AmountPaid, x.F.Balance, x.F.Status, x.F.Reason, x.F.CreatedOn, x.F.SettledOn,
            x.F.PaymentMethod)).ToList();
    }

    public static async Task<FineDto> OneAsync(LibraryDbContext db, Guid id, CancellationToken ct) =>
        (await ToDtosAsync(db, db.Fines.Where(f => f.Id == id), ct))[0];
}

internal sealed class GetFinesHandler(LibraryDbContext db) : IQueryHandler<GetFinesQuery, IReadOnlyList<FineDto>>
{
    public async Task<Result<IReadOnlyList<FineDto>>> Handle(GetFinesQuery q, CancellationToken ct)
    {
        IQueryable<Fine> query = db.Fines;

        if (!string.IsNullOrWhiteSpace(q.Status) && q.Status != "all") query = query.Where(f => f.Status == q.Status);
        if (q.MemberId is { } memberId) query = query.Where(f => f.MemberId == memberId);

        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var s = q.Search.Trim();
            query = query.Where(f =>
                (f.Title != null && f.Title.Contains(s))
                || db.Members.Any(m => m.Id == f.MemberId && (m.FullName.Contains(s) || m.MemberNumber.Contains(s))));
        }

        query = query.OrderByDescending(f => f.CreatedAt).Take(500);
        return Result.Success<IReadOnlyList<FineDto>>(await FineReader.ToDtosAsync(db, query, ct));
    }
}

internal sealed class GetFinesSummaryHandler(LibraryDbContext db) : IQueryHandler<GetFinesSummaryQuery, FinesSummaryDto>
{
    public async Task<Result<FinesSummaryDto>> Handle(GetFinesSummaryQuery q, CancellationToken ct)
    {
        var month = LibraryDates.Today(q.Today)[..7];   // "yyyy-MM"

        var unpaid = await db.Fines.AsNoTracking().Where(f => f.Status == FineStatus.Unpaid)
            .Select(f => f.Amount - f.AmountPaid).ToListAsync(ct);

        var settled = await db.Fines.AsNoTracking()
            .Where(f => f.SettledOn != null && f.SettledOn.StartsWith(month))
            .Select(f => new { f.Status, f.Amount, f.AmountPaid }).ToListAsync(ct);

        return Result.Success(new FinesSummaryDto(
            unpaid.Sum(), unpaid.Count,
            settled.Where(f => f.Status == FineStatus.Paid).Sum(f => f.AmountPaid),
            settled.Where(f => f.Status == FineStatus.Waived).Sum(f => f.Amount - f.AmountPaid)));
    }
}

internal sealed class CreateFineHandler(LibraryDbContext db) : ICommandHandler<CreateFineCommand, FineDto>
{
    private static readonly string[] Types = ["overdue", "lost", "damage", "membership", "other"];

    public async Task<Result<FineDto>> Handle(CreateFineCommand cmd, CancellationToken ct)
    {
        if (!await db.Members.AnyAsync(m => m.Id == cmd.MemberId && !m.IsDeleted, ct))
            return Result.Failure<FineDto>(Error.NotFoundById("Member", cmd.MemberId));

        var type = cmd.Type.Trim().ToLowerInvariant();
        if (!Types.Contains(type)) type = "other";

        var fine = new Fine(cmd.MemberId, null, type, Math.Round(cmd.Amount, 2), null, cmd.Reason,
            LibraryDates.Today(cmd.Today));
        db.Fines.Add(fine);
        await db.SaveChangesAsync(ct);
        return Result.Success(await FineReader.OneAsync(db, fine.Id, ct));
    }
}

internal sealed class PayFineHandler(LibraryDbContext db) : ICommandHandler<PayFineCommand, FineDto>
{
    public async Task<Result<FineDto>> Handle(PayFineCommand cmd, CancellationToken ct)
    {
        var fine = await db.Fines.FirstOrDefaultAsync(f => f.Id == cmd.Id, ct);
        if (fine is null) return Result.Failure<FineDto>(Error.NotFoundById("Fine", cmd.Id));
        if (fine.Status != FineStatus.Unpaid)
            return Result.Failure<FineDto>(Error.Custom("Fine.Conflict", $"This fine is already {fine.Status}."));

        // Taking more than is owed is nearly always a payment entered against the wrong fine.
        if (cmd.Amount > fine.Balance)
            return Result.Failure<FineDto>(Error.Custom("Fine.Conflict",
                $"Only {fine.Balance:0.##} is owed on this fine."));

        var paidOn = LibraryDates.Today(cmd.Today);
        fine.Pay(cmd.Amount, cmd.Method, paidOn);
        // Each amount taken is its own row: the fine only carries the running total.
        db.FinePayments.Add(new FinePayment(fine.Id, fine.MemberId, cmd.Amount, cmd.Method, paidOn));
        await db.SaveChangesAsync(ct);
        return Result.Success(await FineReader.OneAsync(db, fine.Id, ct));
    }
}

internal sealed class WaiveFineHandler(LibraryDbContext db) : ICommandHandler<WaiveFineCommand, FineDto>
{
    public async Task<Result<FineDto>> Handle(WaiveFineCommand cmd, CancellationToken ct)
    {
        var fine = await db.Fines.FirstOrDefaultAsync(f => f.Id == cmd.Id, ct);
        if (fine is null) return Result.Failure<FineDto>(Error.NotFoundById("Fine", cmd.Id));
        if (fine.Status != FineStatus.Unpaid)
            return Result.Failure<FineDto>(Error.Custom("Fine.Conflict", $"This fine is already {fine.Status}."));

        fine.Waive(cmd.Reason, LibraryDates.Today(cmd.Today));
        await db.SaveChangesAsync(ct);
        return Result.Success(await FineReader.OneAsync(db, fine.Id, ct));
    }
}

// ── Dashboard ───────────────────────────────────────────────────────────────

internal sealed class GetLibraryDashboardHandler(LibraryDbContext db, IBranchAccess access)
    : IQueryHandler<GetLibraryDashboardQuery, LibraryDashboardDto>
{
    public async Task<Result<LibraryDashboardDto>> Handle(GetLibraryDashboardQuery q, CancellationToken ct)
    {
        var today = LibraryDates.Today(q.Today);
        var since = LibraryDates.AddDays(today, -30);

        // Staff limited to a branch get that branch's desk: copies, loans and reservations are
        // narrowed. Titles, members and fines belong to the whole library and are not.
        var allowed = await access.AllowedBranchIdsAsync(ct);
        var copyRows        = db.Copies.AsNoTracking().Where(c => !c.IsDeleted);
        var loanRows        = db.Loans.AsNoTracking();
        var reservationRows = db.Reservations.AsNoTracking();
        var branchRows      = db.Branches.AsNoTracking().Where(b => !b.IsDeleted);
        if (allowed is not null)
        {
            copyRows        = copyRows.Where(c => allowed.Contains(c.BranchId));
            loanRows        = loanRows.Where(l => allowed.Contains(l.BranchId));
            reservationRows = reservationRows.Where(r => allowed.Contains(r.PickupBranchId));
            branchRows      = branchRows.Where(b => allowed.Contains(b.Id));
        }

        var titles = await db.Titles.CountAsync(t => !t.IsDeleted, ct);

        var copies = await copyRows
            .GroupBy(c => new { c.BranchId, c.Status })
            .Select(g => new { g.Key.BranchId, g.Key.Status, Count = g.Count() }).ToListAsync(ct);

        var active = await loanRows.Where(l => l.Status == LoanStatus.Active)
            .Select(l => new { l.BranchId, l.DueDate }).ToListAsync(ct);
        var overdue = active.Where(l => string.CompareOrdinal(l.DueDate, today) < 0).ToList();

        var members = await db.Members.CountAsync(m => !m.IsDeleted && m.Status == MemberStatus.Active
            && (m.ExpiresOn == null || string.Compare(m.ExpiresOn, today) >= 0), ct);

        var waiting = await reservationRows.CountAsync(r => r.Status == ReservationStatus.Waiting, ct);
        var ready   = await reservationRows.CountAsync(r => r.Status == ReservationStatus.Ready, ct);

        var unpaid = await db.Fines.Where(f => f.Status == FineStatus.Unpaid)
                             .SumAsync(f => (decimal?)(f.Amount - f.AmountPaid), ct) ?? 0;

        var issued   = await loanRows.CountAsync(l => string.Compare(l.IssuedOn, since) >= 0, ct);
        var returned = await loanRows.CountAsync(l => l.Status == LoanStatus.Returned && l.ReturnedOn != null
                                                      && string.Compare(l.ReturnedOn, since) >= 0, ct);

        var top = await loanRows.Where(l => string.Compare(l.IssuedOn, since) >= 0)
            .GroupBy(l => l.TitleId)
            .Select(g => new { TitleId = g.Key, Loans = g.Count() })
            .OrderByDescending(x => x.Loans).Take(5).ToListAsync(ct);
        var topIds    = top.Select(t => t.TitleId).ToList();
        var topTitles = await db.Titles.AsNoTracking().Where(t => topIds.Contains(t.Id))
                                .ToDictionaryAsync(t => t.Id, ct);

        var branches = await branchRows.OrderBy(b => b.Name).ToListAsync(ct);

        int Copies(Guid? branchId = null, string? status = null) =>
            copies.Where(c => (branchId is null || c.BranchId == branchId) && (status is null || c.Status == status))
                  .Sum(c => c.Count);

        return Result.Success(new LibraryDashboardDto(
            titles, Copies(), Copies(status: CopyStatus.Available), active.Count, overdue.Count,
            active.Count(l => l.DueDate == today), Copies(status: CopyStatus.InTransit),
            members, waiting, ready, unpaid, issued, returned,
            branches.Select(b => new BranchStatDto(
                b.Id, b.Name, Copies(b.Id), Copies(b.Id, CopyStatus.Available),
                active.Count(l => l.BranchId == b.Id), overdue.Count(l => l.BranchId == b.Id))).ToList(),
            top.Where(t => topTitles.ContainsKey(t.TitleId))
               .Select(t => new TopTitleDto(t.TitleId, topTitles[t.TitleId].Title, topTitles[t.TitleId].Authors, t.Loans))
               .ToList()));
    }
}
