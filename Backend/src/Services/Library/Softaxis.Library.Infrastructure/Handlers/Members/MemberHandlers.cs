using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Library.Application.Catalogue;
using Softaxis.Library.Application.Members;
using Softaxis.Library.Domain.Entities;
using Softaxis.Library.Infrastructure.Persistence;

namespace Softaxis.Library.Infrastructure.Handlers.Members;

internal static class MemberReader
{
    public static async Task<List<MemberDto>> ToDtosAsync(
        LibraryDbContext db, List<Member> members, string today, CancellationToken ct)
    {
        if (members.Count == 0) return [];
        var ids = members.Select(m => m.Id).ToList();

        var types    = await db.MembershipTypes.AsNoTracking().ToDictionaryAsync(t => t.Id, ct);
        var branches = await LibraryRules.BranchNamesAsync(db, ct);

        var loans = await db.Loans.AsNoTracking()
            .Where(l => l.Status == LoanStatus.Active && ids.Contains(l.MemberId))
            .Select(l => new { l.MemberId, l.DueDate }).ToListAsync(ct);

        var fines = await db.Fines.AsNoTracking()
            .Where(f => f.Status == FineStatus.Unpaid && ids.Contains(f.MemberId))
            .GroupBy(f => f.MemberId)
            .Select(g => new { g.Key, Balance = g.Sum(f => f.Amount - f.AmountPaid) })
            .ToDictionaryAsync(x => x.Key, x => x.Balance, ct);

        return members.Select(m =>
        {
            types.TryGetValue(m.MembershipTypeId, out var type);
            var mine = loans.Where(l => l.MemberId == m.Id).ToList();
            return new MemberDto(
                m.Id, m.MemberNumber, m.FullName, m.Email, m.Phone, m.Address, m.IdNumber,
                m.MembershipTypeId, type?.Name ?? "—", m.HomeBranchId,
                m.HomeBranchId is { } b ? branches.GetValueOrDefault(b) : null,
                m.JoinedOn, m.ExpiresOn, m.Status, m.Notes,
                mine.Count, mine.Count(l => string.CompareOrdinal(l.DueDate, today) < 0),
                type?.MaxLoans ?? 0, fines.GetValueOrDefault(m.Id), LibraryRules.IsExpired(m, today),
                m.PortalPinHash is not null);
        }).ToList();
    }

    public static async Task<MemberDto> ToDtoAsync(LibraryDbContext db, Member m, string today, CancellationToken ct) =>
        (await ToDtosAsync(db, [m], today, ct))[0];

    /// <summary>Checks the things a member record points at. Null when all is well.</summary>
    public static async Task<Error?> ValidateLinksAsync(
        LibraryDbContext db, Guid membershipTypeId, Guid? homeBranchId, string? expiresOn, CancellationToken ct)
    {
        if (!await db.MembershipTypes.AnyAsync(t => t.Id == membershipTypeId && !t.IsDeleted, ct))
            return Error.NotFoundById("MembershipType", membershipTypeId);
        if (homeBranchId is { } b && !await db.Branches.AnyAsync(x => x.Id == b && !x.IsDeleted, ct))
            return Error.NotFoundById("Branch", b);
        if (!string.IsNullOrWhiteSpace(expiresOn) && !LibraryDates.IsValid(expiresOn))
            return Error.Custom("Member.InvalidStatus", "Expiry date is not a valid date.");
        return null;
    }
}

internal sealed class GetMembersHandler(LibraryDbContext db) : IQueryHandler<GetMembersQuery, PagedDto<MemberDto>>
{
    public async Task<Result<PagedDto<MemberDto>>> Handle(GetMembersQuery q, CancellationToken ct)
    {
        var today = LibraryDates.Today(q.Today);
        var query = db.Members.AsNoTracking().Where(m => !m.IsDeleted);

        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var s = q.Search.Trim();
            query = query.Where(m =>
                m.FullName.Contains(s) || m.MemberNumber.Contains(s)
                || (m.Phone != null && m.Phone.Contains(s))
                || (m.Email != null && m.Email.Contains(s))
                || (m.IdNumber != null && m.IdNumber.Contains(s)));
        }

        // "Expired" is the expiry date against today, never a stored status.
        query = q.Status switch
        {
            "suspended" => query.Where(m => m.Status == MemberStatus.Suspended),
            "expired"   => query.Where(m => m.ExpiresOn != null && string.Compare(m.ExpiresOn, today) < 0),
            "active"    => query.Where(m => m.Status == MemberStatus.Active
                                            && (m.ExpiresOn == null || string.Compare(m.ExpiresOn, today) >= 0)),
            _           => query,
        };

        var total    = await query.CountAsync(ct);
        var pageSize = Math.Clamp(q.PageSize, 1, 200);
        var page     = Math.Max(q.Page, 1);

        var members = await query.OrderBy(m => m.FullName)
            .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);

        return Result.Success(new PagedDto<MemberDto>(await MemberReader.ToDtosAsync(db, members, today, ct), total));
    }
}

internal sealed class GetMemberByIdHandler(LibraryDbContext db) : IQueryHandler<GetMemberByIdQuery, MemberDto>
{
    public async Task<Result<MemberDto>> Handle(GetMemberByIdQuery q, CancellationToken ct)
    {
        var member = await db.Members.AsNoTracking().FirstOrDefaultAsync(m => m.Id == q.Id && !m.IsDeleted, ct);
        return member is null
            ? Result.Failure<MemberDto>(Error.NotFoundById("Member", q.Id))
            : Result.Success(await MemberReader.ToDtoAsync(db, member, LibraryDates.Today(q.Today), ct));
    }
}

internal sealed class CreateMemberHandler(LibraryDbContext db) : ICommandHandler<CreateMemberCommand, MemberDto>
{
    public async Task<Result<MemberDto>> Handle(CreateMemberCommand cmd, CancellationToken ct)
    {
        var today = LibraryDates.Today(cmd.Today);

        if (await MemberReader.ValidateLinksAsync(db, cmd.MembershipTypeId, cmd.HomeBranchId, cmd.ExpiresOn, ct) is { } error)
            return Result.Failure<MemberDto>(error);

        string number;
        if (string.IsNullOrWhiteSpace(cmd.MemberNumber))
        {
            number = await LibraryRules.NextMemberNumberAsync(db, ct);
        }
        else
        {
            number = cmd.MemberNumber.Trim();
            if (await db.Members.AnyAsync(m => !m.IsDeleted && m.MemberNumber == number, ct))
                return Result.Failure<MemberDto>(Error.Custom("Member.Duplicate",
                    $"Member number \"{number}\" is already in use."));
        }

        var member = new Member(number, cmd.FullName, cmd.MembershipTypeId, LibraryDates.Clean(cmd.JoinedOn) ?? today);
        member.SetDetails(number, cmd.FullName, cmd.Email, cmd.Phone, cmd.Address, cmd.IdNumber,
            cmd.MembershipTypeId, cmd.HomeBranchId, LibraryDates.Clean(cmd.ExpiresOn), MemberStatus.Active, cmd.Notes);

        db.Members.Add(member);
        await db.SaveChangesAsync(ct);
        return Result.Success(await MemberReader.ToDtoAsync(db, member, today, ct));
    }
}

internal sealed class UpdateMemberHandler(LibraryDbContext db) : ICommandHandler<UpdateMemberCommand, MemberDto>
{
    public async Task<Result<MemberDto>> Handle(UpdateMemberCommand cmd, CancellationToken ct)
    {
        var member = await db.Members.FirstOrDefaultAsync(m => m.Id == cmd.Id && !m.IsDeleted, ct);
        if (member is null) return Result.Failure<MemberDto>(Error.NotFoundById("Member", cmd.Id));

        if (await MemberReader.ValidateLinksAsync(db, cmd.MembershipTypeId, cmd.HomeBranchId, cmd.ExpiresOn, ct) is { } error)
            return Result.Failure<MemberDto>(error);

        var number = cmd.MemberNumber.Trim();
        if (await db.Members.AnyAsync(m => !m.IsDeleted && m.Id != cmd.Id && m.MemberNumber == number, ct))
            return Result.Failure<MemberDto>(Error.Custom("Member.Duplicate",
                $"Member number \"{number}\" is already in use."));

        member.SetDetails(number, cmd.FullName, cmd.Email, cmd.Phone, cmd.Address, cmd.IdNumber,
            cmd.MembershipTypeId, cmd.HomeBranchId, LibraryDates.Clean(cmd.ExpiresOn), cmd.Status, cmd.Notes);

        await db.SaveChangesAsync(ct);
        return Result.Success(await MemberReader.ToDtoAsync(db, member, LibraryDates.Today(cmd.Today), ct));
    }
}

internal sealed class DeleteMemberHandler(LibraryDbContext db) : ICommandHandler<DeleteMemberCommand>
{
    public async Task<Result> Handle(DeleteMemberCommand cmd, CancellationToken ct)
    {
        var member = await db.Members.FirstOrDefaultAsync(m => m.Id == cmd.Id && !m.IsDeleted, ct);
        if (member is null) return Result.Failure(Error.NotFoundById("Member", cmd.Id));

        var loans = await db.Loans.CountAsync(l => l.MemberId == cmd.Id && l.Status == LoanStatus.Active, ct);
        if (loans > 0)
            return Result.Failure(Error.Custom("Member.Conflict",
                $"{member.FullName} still has {loans} items on loan. They must be returned first."));

        var owed = await db.Fines.Where(f => f.MemberId == cmd.Id && f.Status == FineStatus.Unpaid)
                                 .SumAsync(f => (decimal?)(f.Amount - f.AmountPaid), ct) ?? 0;
        if (owed > 0)
            return Result.Failure(Error.Custom("Member.Conflict",
                $"{member.FullName} has unpaid fines of {owed:0.##}. Collect or waive them first."));

        // Their place in any queue goes with them; a held copy returns to the shelf.
        var open = await db.Reservations
            .Where(r => r.MemberId == cmd.Id
                        && (r.Status == ReservationStatus.Waiting || r.Status == ReservationStatus.Ready))
            .ToListAsync(ct);
        var today = LibraryDates.Today(null);
        foreach (var r in open)
        {
            var heldCopyId = r.Status == ReservationStatus.Ready ? r.CopyId : null;
            r.Cancel();
            await db.SaveChangesAsync(ct);

            if (heldCopyId is { } copyId
                && await db.Copies.FirstOrDefaultAsync(c => c.Id == copyId && c.Status == CopyStatus.Reserved, ct) is { } copy)
            {
                copy.SetStatus(CopyStatus.Available);
                await LibraryRules.HoldForNextReservationAsync(db, copy, today, ct);
            }
        }

        member.Delete();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
