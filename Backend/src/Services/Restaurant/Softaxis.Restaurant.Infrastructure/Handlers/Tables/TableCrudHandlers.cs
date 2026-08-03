using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.Abstractions;
using Softaxis.Restaurant.Application.Tables.Commands;
using Softaxis.Restaurant.Application.Tables.Dtos;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.Tables;

internal sealed class UpdateTableHandler(RestaurantDbContext db) : ICommandHandler<UpdateTableCommand, TableDto>
{
    public async Task<Result<TableDto>> Handle(UpdateTableCommand cmd, CancellationToken ct)
    {
        var t = await db.Tables.FirstOrDefaultAsync(x => x.Id == cmd.Id && !x.IsDeleted, ct);
        if (t is null) return Result.Failure<TableDto>(Error.NotFoundById("Table", cmd.Id));

        var tableNumber = cmd.TableNumber.Trim();
        var duplicate = await db.Tables.AnyAsync(
            x => !x.IsDeleted && x.Id != cmd.Id && x.TableNumber == tableNumber, ct);
        if (duplicate)
            return Result.Failure<TableDto>(Error.Custom("Table.Duplicate", $"Table '{tableNumber}' already exists."));

        t.UpdateDetails(tableNumber, cmd.Section, cmd.Capacity, cmd.DiningAreaId);
        await db.SaveChangesAsync(ct);
        return Result.Success(TableMappings.ToDto(t));
    }
}

internal sealed class DeleteTableHandler(RestaurantDbContext db) : ICommandHandler<DeleteTableCommand>
{
    public async Task<Result> Handle(DeleteTableCommand cmd, CancellationToken ct)
    {
        var t = await db.Tables.FirstOrDefaultAsync(x => x.Id == cmd.Id && !x.IsDeleted, ct);
        if (t is null) return Result.Failure(Error.NotFoundById("Table", cmd.Id));
        if (t.Status == "occupied")
            return Result.Failure(Error.Custom("Table.Conflict", "Cannot delete a table with an active order."));

        t.Delete();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class RepositionTableHandler(RestaurantDbContext db) : ICommandHandler<RepositionTableCommand, TableDto>
{
    public async Task<Result<TableDto>> Handle(RepositionTableCommand cmd, CancellationToken ct)
    {
        var t = await db.Tables.FirstOrDefaultAsync(x => x.Id == cmd.Id && !x.IsDeleted, ct);
        if (t is null) return Result.Failure<TableDto>(Error.NotFoundById("Table", cmd.Id));

        t.Reposition(cmd.PosX, cmd.PosY, cmd.Shape, cmd.Rotation);
        await db.SaveChangesAsync(ct);
        return Result.Success(TableMappings.ToDto(t));
    }
}

internal sealed class UpdateTableLayoutHandler(RestaurantDbContext db) : ICommandHandler<UpdateTableLayoutCommand>
{
    public async Task<Result> Handle(UpdateTableLayoutCommand cmd, CancellationToken ct)
    {
        var ids = cmd.Tables.Select(x => x.Id).ToList();
        var tables = await db.Tables.Where(x => ids.Contains(x.Id) && !x.IsDeleted).ToListAsync(ct);
        var byId = tables.ToDictionary(x => x.Id);

        foreach (var input in cmd.Tables)
            if (byId.TryGetValue(input.Id, out var t))
                t.Reposition(input.PosX, input.PosY, input.Shape, input.Rotation);

        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class MergeTableHandler(RestaurantDbContext db, IRestaurantRealtimeNotifier realtime)
    : ICommandHandler<MergeTableCommand, TableDto>
{
    public async Task<Result<TableDto>> Handle(MergeTableCommand cmd, CancellationToken ct)
    {
        if (cmd.Id == cmd.TargetTableId)
            return Result.Failure<TableDto>(Error.Custom("Table.Conflict", "A table can't be merged into itself."));

        var t = await db.Tables.FirstOrDefaultAsync(x => x.Id == cmd.Id && !x.IsDeleted, ct);
        if (t is null) return Result.Failure<TableDto>(Error.NotFoundById("Table", cmd.Id));

        var target = await db.Tables.FirstOrDefaultAsync(x => x.Id == cmd.TargetTableId && !x.IsDeleted, ct);
        if (target is null) return Result.Failure<TableDto>(Error.NotFoundById("Table", cmd.TargetTableId));
        if (target.IsMerged)
            return Result.Failure<TableDto>(Error.Custom("Table.Conflict", "Cannot merge into a table that is itself merged into another."));
        if (t.Status == "occupied")
            return Result.Failure<TableDto>(Error.Custom("Table.Conflict", "Cannot merge a table with an active order — transfer the order first."));

        t.MergeInto(target.Id);
        await db.SaveChangesAsync(ct);
        await realtime.NotifyTablesChangedAsync(ct);
        return Result.Success(TableMappings.ToDto(t));
    }
}

internal sealed class UnmergeTableHandler(RestaurantDbContext db, IRestaurantRealtimeNotifier realtime)
    : ICommandHandler<UnmergeTableCommand, TableDto>
{
    public async Task<Result<TableDto>> Handle(UnmergeTableCommand cmd, CancellationToken ct)
    {
        var t = await db.Tables.FirstOrDefaultAsync(x => x.Id == cmd.Id && !x.IsDeleted, ct);
        if (t is null) return Result.Failure<TableDto>(Error.NotFoundById("Table", cmd.Id));

        t.Unmerge();
        await db.SaveChangesAsync(ct);
        await realtime.NotifyTablesChangedAsync(ct);
        return Result.Success(TableMappings.ToDto(t));
    }
}
