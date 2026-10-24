using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.Abstractions;
using Softaxis.Restaurant.Application.BranchInstructions;
using Softaxis.Restaurant.Domain.Entities;
using Softaxis.Restaurant.Infrastructure.Common;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.BranchInstructions;

/// <summary>
/// Head office asks a Local branch to void or refund a bill. Only meaningful on the cloud, and only for a
/// branch that runs on its own server - for a cloud-run branch the bill is simply changed directly.
/// </summary>
internal sealed class CreateBranchInstructionHandler(
    RestaurantDbContext db, ICurrentUser user, LocalBranchGuard localBranch)
    : ICommandHandler<CreateBranchInstructionCommand, BranchInstructionDto>
{
    public async Task<Result<BranchInstructionDto>> Handle(CreateBranchInstructionCommand cmd, CancellationToken ct)
    {
        if (user.Id is not { } who)
            return Result.Failure<BranchInstructionDto>(Error.Custom("Auth.Unresolved", "Could not tell who is asking."));

        // The permission is the same one the action needs at the till: void or refund.
        var needed = cmd.Kind == BranchInstruction.VoidOrder ? "restaurant.orders.void" : "restaurant.orders.refund";
        if (!user.IsSuperAdmin && !user.HasPermission(needed))
            return Result.Failure<BranchInstructionDto>(Error.Custom("Permission.Denied", $"Missing permission: {needed}"));

        if (!await localBranch.IsLocalAsync(cmd.BranchId, ct))
            return Result.Failure<BranchInstructionDto>(Error.Custom("Branch.Conflict",
                "This branch does not run on its own server, so its bills can be changed directly."));

        var order = await db.Orders.AsNoTracking()
            .Where(o => o.Id == cmd.OrderId && !o.IsDeleted)
            .Select(o => new { o.Id, o.BranchId, o.OrderNumber, o.Status })
            .FirstOrDefaultAsync(ct);
        // The order must already have reached head office from that branch. NotFound for both cases so a
        // wrong branch id does not confirm that an order exists elsewhere.
        if (order is null || order.BranchId != cmd.BranchId)
            return Result.Failure<BranchInstructionDto>(Error.NotFoundById("Order", cmd.OrderId));

        var duplicate = await db.BranchInstructions.AnyAsync(i =>
            i.OrderId == cmd.OrderId && i.Kind == cmd.Kind &&
            !db.BranchInstructionResults.Any(r => r.Id == i.Id), ct);
        if (duplicate)
            return Result.Failure<BranchInstructionDto>(Error.Custom("BranchInstruction.Conflict",
                "The same request for this order is already waiting for the branch."));

        var instruction = new BranchInstruction(cmd.BranchId, cmd.Kind, cmd.OrderId, cmd.Reason,
            cmd.Amount, cmd.Method, who, user.Username ?? user.Email ?? who.ToString());
        db.BranchInstructions.Add(instruction);
        await db.SaveChangesAsync(ct);

        return Result.Success(new BranchInstructionDto(
            instruction.Id, instruction.BranchId, instruction.Kind, instruction.OrderId, order.OrderNumber,
            instruction.Reason, instruction.Amount, instruction.Method, instruction.RequestedByName,
            instruction.RequestedAt, "pending", null, null));
    }
}

internal sealed class GetBranchInstructionsHandler(RestaurantDbContext db, IBranchAccessGuard branchAccess)
    : IQueryHandler<GetBranchInstructionsQuery, IReadOnlyList<BranchInstructionDto>>
{
    public async Task<Result<IReadOnlyList<BranchInstructionDto>>> Handle(GetBranchInstructionsQuery q, CancellationToken ct)
    {
        var scope = await branchAccess.ResolveReadScopeAsync(q.BranchId, ct);

        var rows = db.BranchInstructions.AsNoTracking().AsQueryable();
        if (scope is not null) rows = rows.Where(i => scope.Contains(i.BranchId));
        if (q.OrderId is { } order) rows = rows.Where(i => i.OrderId == order);

        var list = await (
            from i in rows
            join r in db.BranchInstructionResults.AsNoTracking() on i.Id equals r.Id into rj
            from r in rj.DefaultIfEmpty()
            join o in db.Orders.AsNoTracking() on i.OrderId equals o.Id into oj
            from o in oj.DefaultIfEmpty()
            orderby i.RequestedAt descending
            select new BranchInstructionDto(
                i.Id, i.BranchId, i.Kind, i.OrderId, o.OrderNumber, i.Reason, i.Amount, i.Method,
                i.RequestedByName, i.RequestedAt,
                r == null ? "pending" : r.Status, r == null ? null : r.Message, r == null ? null : r.UpdatedAt))
            .Take(200).ToListAsync(ct);

        return Result.Success<IReadOnlyList<BranchInstructionDto>>(list);
    }
}
