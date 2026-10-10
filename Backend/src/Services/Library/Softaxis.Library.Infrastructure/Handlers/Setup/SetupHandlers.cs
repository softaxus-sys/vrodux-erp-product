using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Library.Application.Setup;
using Softaxis.Library.Domain.Entities;
using Softaxis.Library.Infrastructure.Persistence;

namespace Softaxis.Library.Infrastructure.Handlers.Setup;

// ── Branches ────────────────────────────────────────────────────────────────

internal sealed class GetBranchesHandler(LibraryDbContext db) : IQueryHandler<GetBranchesQuery, IReadOnlyList<BranchDto>>
{
    public async Task<Result<IReadOnlyList<BranchDto>>> Handle(GetBranchesQuery q, CancellationToken ct)
    {
        await LibraryDefaults.EnsureBranchAsync(db, ct);

        var query = db.Branches.AsNoTracking().Where(b => !b.IsDeleted);
        if (q.ActiveOnly) query = query.Where(b => b.IsActive);
        var branches = await query.OrderBy(b => b.Name).ToListAsync(ct);

        var counts = await db.Copies.AsNoTracking().Where(c => !c.IsDeleted)
            .GroupBy(c => new { c.BranchId, c.Status })
            .Select(g => new { g.Key.BranchId, g.Key.Status, Count = g.Count() })
            .ToListAsync(ct);

        int Count(Guid branchId, string? status = null) =>
            counts.Where(c => c.BranchId == branchId && (status is null || c.Status == status)).Sum(c => c.Count);

        return Result.Success<IReadOnlyList<BranchDto>>(branches.Select(b => new BranchDto(
            b.Id, b.Name, b.Code, b.Address, b.Phone, b.Email, b.IsActive,
            Count(b.Id), Count(b.Id, CopyStatus.Available), Count(b.Id, CopyStatus.OnLoan))).ToList());
    }
}

internal sealed class CreateBranchHandler(LibraryDbContext db) : ICommandHandler<CreateBranchCommand, BranchDto>
{
    public async Task<Result<BranchDto>> Handle(CreateBranchCommand cmd, CancellationToken ct)
    {
        var name = cmd.Name.Trim();
        if (await db.Branches.AnyAsync(b => !b.IsDeleted && b.Name == name, ct))
            return Result.Failure<BranchDto>(Error.Custom("Branch.Duplicate", $"A branch named \"{name}\" already exists."));

        var branch = new LibraryBranch(name, cmd.Code, cmd.Address, cmd.Phone, cmd.Email);
        db.Branches.Add(branch);
        await db.SaveChangesAsync(ct);
        return Result.Success(new BranchDto(branch.Id, branch.Name, branch.Code, branch.Address, branch.Phone,
            branch.Email, branch.IsActive, 0, 0, 0));
    }
}

internal sealed class UpdateBranchHandler(LibraryDbContext db) : ICommandHandler<UpdateBranchCommand, BranchDto>
{
    public async Task<Result<BranchDto>> Handle(UpdateBranchCommand cmd, CancellationToken ct)
    {
        var branch = await db.Branches.FirstOrDefaultAsync(b => b.Id == cmd.Id && !b.IsDeleted, ct);
        if (branch is null) return Result.Failure<BranchDto>(Error.NotFoundById("Branch", cmd.Id));

        var name = cmd.Name.Trim();
        if (await db.Branches.AnyAsync(b => !b.IsDeleted && b.Id != cmd.Id && b.Name == name, ct))
            return Result.Failure<BranchDto>(Error.Custom("Branch.Duplicate", $"A branch named \"{name}\" already exists."));

        branch.Update(name, cmd.Code, cmd.Address, cmd.Phone, cmd.Email, cmd.IsActive);
        await db.SaveChangesAsync(ct);

        var copies = await db.Copies.CountAsync(c => !c.IsDeleted && c.BranchId == branch.Id, ct);
        return Result.Success(new BranchDto(branch.Id, branch.Name, branch.Code, branch.Address, branch.Phone,
            branch.Email, branch.IsActive, copies, 0, 0));
    }
}

internal sealed class DeleteBranchHandler(LibraryDbContext db) : ICommandHandler<DeleteBranchCommand>
{
    public async Task<Result> Handle(DeleteBranchCommand cmd, CancellationToken ct)
    {
        var branch = await db.Branches.FirstOrDefaultAsync(b => b.Id == cmd.Id && !b.IsDeleted, ct);
        if (branch is null) return Result.Failure(Error.NotFoundById("Branch", cmd.Id));

        // A branch still holding (or expecting) copies cannot go: they would have nowhere to be.
        var copies = await db.Copies.CountAsync(
            c => !c.IsDeleted && (c.BranchId == cmd.Id || c.TransitToBranchId == cmd.Id), ct);
        if (copies > 0)
            return Result.Failure(Error.Custom("Branch.Conflict",
                $"{copies} copies belong to this branch. Transfer them to another branch first, or mark the branch inactive."));

        var holds = await db.Reservations.CountAsync(r => r.PickupBranchId == cmd.Id
            && (r.Status == ReservationStatus.Waiting || r.Status == ReservationStatus.Ready), ct);
        if (holds > 0)
            return Result.Failure(Error.Custom("Branch.Conflict",
                $"{holds} open reservations are to be collected at this branch. Cancel them first."));

        branch.Delete();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

// ── Membership types ────────────────────────────────────────────────────────

internal static class MembershipTypeMappings
{
    public static MembershipTypeDto ToDto(MembershipType t, int members) => new(
        t.Id, t.Name, t.MaxLoans, t.LoanDays, t.MaxRenewals, t.FinePerDay, t.MaxReservations, t.AnnualFee,
        t.IsActive, members);
}

internal sealed class GetMembershipTypesHandler(LibraryDbContext db)
    : IQueryHandler<GetMembershipTypesQuery, IReadOnlyList<MembershipTypeDto>>
{
    public async Task<Result<IReadOnlyList<MembershipTypeDto>>> Handle(GetMembershipTypesQuery q, CancellationToken ct)
    {
        await LibraryDefaults.EnsureMembershipTypesAsync(db, ct);

        var query = db.MembershipTypes.AsNoTracking().Where(t => !t.IsDeleted);
        if (q.ActiveOnly) query = query.Where(t => t.IsActive);
        var types = await query.OrderBy(t => t.Name).ToListAsync(ct);

        var members = await db.Members.AsNoTracking().Where(m => !m.IsDeleted)
            .GroupBy(m => m.MembershipTypeId)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count, ct);

        return Result.Success<IReadOnlyList<MembershipTypeDto>>(
            types.Select(t => MembershipTypeMappings.ToDto(t, members.GetValueOrDefault(t.Id))).ToList());
    }
}

internal sealed class CreateMembershipTypeHandler(LibraryDbContext db)
    : ICommandHandler<CreateMembershipTypeCommand, MembershipTypeDto>
{
    public async Task<Result<MembershipTypeDto>> Handle(CreateMembershipTypeCommand cmd, CancellationToken ct)
    {
        var name = cmd.Name.Trim();
        if (await db.MembershipTypes.AnyAsync(t => !t.IsDeleted && t.Name == name, ct))
            return Result.Failure<MembershipTypeDto>(Error.Custom("MembershipType.Duplicate",
                $"A membership type named \"{name}\" already exists."));

        var type = new MembershipType(name, cmd.MaxLoans, cmd.LoanDays, cmd.MaxRenewals, cmd.FinePerDay,
            cmd.MaxReservations, cmd.AnnualFee);
        db.MembershipTypes.Add(type);
        await db.SaveChangesAsync(ct);
        return Result.Success(MembershipTypeMappings.ToDto(type, 0));
    }
}

internal sealed class UpdateMembershipTypeHandler(LibraryDbContext db)
    : ICommandHandler<UpdateMembershipTypeCommand, MembershipTypeDto>
{
    public async Task<Result<MembershipTypeDto>> Handle(UpdateMembershipTypeCommand cmd, CancellationToken ct)
    {
        var type = await db.MembershipTypes.FirstOrDefaultAsync(t => t.Id == cmd.Id && !t.IsDeleted, ct);
        if (type is null) return Result.Failure<MembershipTypeDto>(Error.NotFoundById("MembershipType", cmd.Id));

        var name = cmd.Name.Trim();
        if (await db.MembershipTypes.AnyAsync(t => !t.IsDeleted && t.Id != cmd.Id && t.Name == name, ct))
            return Result.Failure<MembershipTypeDto>(Error.Custom("MembershipType.Duplicate",
                $"A membership type named \"{name}\" already exists."));

        // New rules apply from the next issue, renewal and return. Due dates already given stand.
        type.Update(name, cmd.MaxLoans, cmd.LoanDays, cmd.MaxRenewals, cmd.FinePerDay, cmd.MaxReservations,
            cmd.AnnualFee, cmd.IsActive);
        await db.SaveChangesAsync(ct);

        var members = await db.Members.CountAsync(m => !m.IsDeleted && m.MembershipTypeId == type.Id, ct);
        return Result.Success(MembershipTypeMappings.ToDto(type, members));
    }
}

internal sealed class DeleteMembershipTypeHandler(LibraryDbContext db) : ICommandHandler<DeleteMembershipTypeCommand>
{
    public async Task<Result> Handle(DeleteMembershipTypeCommand cmd, CancellationToken ct)
    {
        var type = await db.MembershipTypes.FirstOrDefaultAsync(t => t.Id == cmd.Id && !t.IsDeleted, ct);
        if (type is null) return Result.Failure(Error.NotFoundById("MembershipType", cmd.Id));

        var members = await db.Members.CountAsync(m => !m.IsDeleted && m.MembershipTypeId == cmd.Id, ct);
        if (members > 0)
            return Result.Failure(Error.Custom("MembershipType.Conflict",
                $"{members} members have this membership type. Move them to another type first, or mark it inactive."));

        type.Delete();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
