using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.UserBranches.Commands;
using Softaxis.Restaurant.Application.UserBranches.Dtos;
using Softaxis.Restaurant.Application.UserBranches.Queries;
using Softaxis.Restaurant.Domain.Entities;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.UserBranches;

internal sealed class GetUserBranchesHandler(RestaurantDbContext db)
    : IQueryHandler<GetUserBranchesQuery, IReadOnlyList<UserBranchDto>>
{
    public async Task<Result<IReadOnlyList<UserBranchDto>>> Handle(GetUserBranchesQuery query, CancellationToken ct)
    {
        var items = await db.UserBranches.AsNoTracking()
            .Where(x => query.UserId == null || x.UserId == query.UserId)
            .OrderBy(x => x.UserName)
            .Select(x => new UserBranchDto(x.Id, x.UserId, x.UserName, x.BranchId, x.Role, x.CreatedAt))
            .ToListAsync(ct);

        return Result.Success<IReadOnlyList<UserBranchDto>>(items);
    }
}

internal sealed class AddUserBranchHandler(RestaurantDbContext db)
    : ICommandHandler<AddUserBranchCommand, UserBranchDto>
{
    public async Task<Result<UserBranchDto>> Handle(AddUserBranchCommand cmd, CancellationToken ct)
    {
        var exists = await db.UserBranches.AsNoTracking()
            .AnyAsync(x => x.UserId == cmd.UserId && x.BranchId == cmd.BranchId, ct);
        if (exists)
            return Result.Failure<UserBranchDto>(Error.Custom("UserBranch.Duplicate", "This user is already assigned to that branch."));

        var ub = new UserBranch(cmd.UserId, cmd.UserName, cmd.BranchId, cmd.Role);
        db.UserBranches.Add(ub);
        await db.SaveChangesAsync(ct);

        return Result.Success(new UserBranchDto(ub.Id, ub.UserId, ub.UserName, ub.BranchId, ub.Role, ub.CreatedAt));
    }
}

internal sealed class UpdateUserBranchRoleHandler(RestaurantDbContext db)
    : ICommandHandler<UpdateUserBranchRoleCommand, UserBranchDto>
{
    public async Task<Result<UserBranchDto>> Handle(UpdateUserBranchRoleCommand cmd, CancellationToken ct)
    {
        var ub = await db.UserBranches.FindAsync([cmd.Id], ct);
        if (ub is null) return Result.Failure<UserBranchDto>(Error.NotFoundById("UserBranch", cmd.Id));

        ub.SetRole(cmd.Role);
        await db.SaveChangesAsync(ct);

        return Result.Success(new UserBranchDto(ub.Id, ub.UserId, ub.UserName, ub.BranchId, ub.Role, ub.CreatedAt));
    }
}

internal sealed class RemoveUserBranchHandler(RestaurantDbContext db)
    : ICommandHandler<RemoveUserBranchCommand>
{
    public async Task<Result> Handle(RemoveUserBranchCommand cmd, CancellationToken ct)
    {
        var ub = await db.UserBranches.FindAsync([cmd.Id], ct);
        if (ub is null) return Result.Failure(Error.NotFoundById("UserBranch", cmd.Id));

        db.UserBranches.Remove(ub);
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
