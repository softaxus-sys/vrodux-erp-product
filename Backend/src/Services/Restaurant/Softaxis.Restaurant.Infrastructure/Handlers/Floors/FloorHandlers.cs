using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.Floors.Commands;
using Softaxis.Restaurant.Application.Floors.Dtos;
using Softaxis.Restaurant.Application.Floors.Queries;
using Softaxis.Restaurant.Application.Tables.Dtos;
using Softaxis.Restaurant.Domain.Entities;
using Softaxis.Restaurant.Infrastructure.Handlers.Tables;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.Floors;

internal static class FloorMappings
{
    public static FloorDto ToDto(Floor f) => new(f.Id, f.BranchId, f.Name, f.SortOrder);
    public static DiningAreaDto ToDto(DiningArea a) => new(a.Id, a.FloorId, a.Name, a.Type, a.SortOrder);
}

internal sealed class CreateFloorHandler(RestaurantDbContext db) : ICommandHandler<CreateFloorCommand, FloorDto>
{
    public async Task<Result<FloorDto>> Handle(CreateFloorCommand cmd, CancellationToken ct)
    {
        var floor = new Floor(cmd.Name.Trim(), cmd.SortOrder, cmd.BranchId);
        db.Floors.Add(floor);
        await db.SaveChangesAsync(ct);
        return Result.Success(FloorMappings.ToDto(floor));
    }
}

internal sealed class UpdateFloorHandler(RestaurantDbContext db) : ICommandHandler<UpdateFloorCommand, FloorDto>
{
    public async Task<Result<FloorDto>> Handle(UpdateFloorCommand cmd, CancellationToken ct)
    {
        var floor = await db.Floors.FirstOrDefaultAsync(x => x.Id == cmd.Id && !x.IsDeleted, ct);
        if (floor is null) return Result.Failure<FloorDto>(Error.NotFoundById("Floor", cmd.Id));

        floor.Update(cmd.Name.Trim(), cmd.SortOrder);
        await db.SaveChangesAsync(ct);
        return Result.Success(FloorMappings.ToDto(floor));
    }
}

internal sealed class DeleteFloorHandler(RestaurantDbContext db) : ICommandHandler<DeleteFloorCommand>
{
    public async Task<Result> Handle(DeleteFloorCommand cmd, CancellationToken ct)
    {
        var floor = await db.Floors.FirstOrDefaultAsync(x => x.Id == cmd.Id && !x.IsDeleted, ct);
        if (floor is null) return Result.Failure(Error.NotFoundById("Floor", cmd.Id));

        var hasAreas = await db.DiningAreas.AnyAsync(x => x.FloorId == cmd.Id && !x.IsDeleted, ct);
        if (hasAreas)
            return Result.Failure(Error.Custom("Floor.Conflict", "Delete or move this floor's dining areas first."));

        floor.Delete();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class CreateDiningAreaHandler(RestaurantDbContext db) : ICommandHandler<CreateDiningAreaCommand, DiningAreaDto>
{
    public async Task<Result<DiningAreaDto>> Handle(CreateDiningAreaCommand cmd, CancellationToken ct)
    {
        var floorExists = await db.Floors.AnyAsync(x => x.Id == cmd.FloorId && !x.IsDeleted, ct);
        if (!floorExists) return Result.Failure<DiningAreaDto>(Error.NotFoundById("Floor", cmd.FloorId));

        var area = new DiningArea(cmd.FloorId, cmd.Name.Trim(), cmd.Type, cmd.SortOrder);
        db.DiningAreas.Add(area);
        await db.SaveChangesAsync(ct);
        return Result.Success(FloorMappings.ToDto(area));
    }
}

internal sealed class UpdateDiningAreaHandler(RestaurantDbContext db) : ICommandHandler<UpdateDiningAreaCommand, DiningAreaDto>
{
    public async Task<Result<DiningAreaDto>> Handle(UpdateDiningAreaCommand cmd, CancellationToken ct)
    {
        var area = await db.DiningAreas.FirstOrDefaultAsync(x => x.Id == cmd.Id && !x.IsDeleted, ct);
        if (area is null) return Result.Failure<DiningAreaDto>(Error.NotFoundById("DiningArea", cmd.Id));

        area.Update(cmd.Name.Trim(), cmd.Type, cmd.SortOrder);
        await db.SaveChangesAsync(ct);
        return Result.Success(FloorMappings.ToDto(area));
    }
}

internal sealed class DeleteDiningAreaHandler(RestaurantDbContext db) : ICommandHandler<DeleteDiningAreaCommand>
{
    public async Task<Result> Handle(DeleteDiningAreaCommand cmd, CancellationToken ct)
    {
        var area = await db.DiningAreas.FirstOrDefaultAsync(x => x.Id == cmd.Id && !x.IsDeleted, ct);
        if (area is null) return Result.Failure(Error.NotFoundById("DiningArea", cmd.Id));

        var hasTables = await db.Tables.AnyAsync(x => x.DiningAreaId == cmd.Id && !x.IsDeleted, ct);
        if (hasTables)
            return Result.Failure(Error.Custom("DiningArea.Conflict", "Move or delete this area's tables first."));

        area.Delete();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class GetFloorsHandler(RestaurantDbContext db) : IQueryHandler<GetFloorsQuery, IReadOnlyList<FloorDto>>
{
    public async Task<Result<IReadOnlyList<FloorDto>>> Handle(GetFloorsQuery query, CancellationToken ct)
    {
        var items = await db.Floors.AsNoTracking().Where(x => !x.IsDeleted)
            .OrderBy(x => x.SortOrder).ThenBy(x => x.Name)
            .Select(f => new FloorDto(f.Id, f.BranchId, f.Name, f.SortOrder))
            .ToListAsync(ct);
        return Result.Success<IReadOnlyList<FloorDto>>(items);
    }
}

internal sealed class GetDiningAreasHandler(RestaurantDbContext db) : IQueryHandler<GetDiningAreasQuery, IReadOnlyList<DiningAreaDto>>
{
    public async Task<Result<IReadOnlyList<DiningAreaDto>>> Handle(GetDiningAreasQuery query, CancellationToken ct)
    {
        var q = db.DiningAreas.AsNoTracking().Where(x => !x.IsDeleted);
        if (query.FloorId.HasValue) q = q.Where(x => x.FloorId == query.FloorId.Value);

        var items = await q.OrderBy(x => x.SortOrder).ThenBy(x => x.Name)
            .Select(a => new DiningAreaDto(a.Id, a.FloorId, a.Name, a.Type, a.SortOrder))
            .ToListAsync(ct);
        return Result.Success<IReadOnlyList<DiningAreaDto>>(items);
    }
}

internal sealed class GetFloorLayoutHandler(RestaurantDbContext db) : IQueryHandler<GetFloorLayoutQuery, IReadOnlyList<FloorLayoutDto>>
{
    public async Task<Result<IReadOnlyList<FloorLayoutDto>>> Handle(GetFloorLayoutQuery query, CancellationToken ct)
    {
        var floors = await db.Floors.AsNoTracking().Where(x => !x.IsDeleted)
            .OrderBy(x => x.SortOrder).ThenBy(x => x.Name).ToListAsync(ct);
        var areas = await db.DiningAreas.AsNoTracking().Where(x => !x.IsDeleted)
            .OrderBy(x => x.SortOrder).ThenBy(x => x.Name).ToListAsync(ct);
        var tables = await db.Tables.AsNoTracking().Where(x => !x.IsDeleted).ToListAsync(ct);

        var tablesByArea = tables.Where(t => t.DiningAreaId.HasValue)
            .GroupBy(t => t.DiningAreaId!.Value)
            .ToDictionary(g => g.Key, g => (IReadOnlyList<TableDto>)g.Select(TableMappings.ToDto).ToList());

        var areasByFloor = areas.GroupBy(a => a.FloorId).ToDictionary(
            g => g.Key,
            g => (IReadOnlyList<DiningAreaLayoutDto>)g.Select(a => new DiningAreaLayoutDto(
                a.Id, a.FloorId, a.Name, a.Type, a.SortOrder,
                tablesByArea.TryGetValue(a.Id, out var t) ? t : [])).ToList());

        var result = floors.Select(f => new FloorLayoutDto(
            f.Id, f.BranchId, f.Name, f.SortOrder,
            areasByFloor.TryGetValue(f.Id, out var a) ? a : [])).ToList();

        return Result.Success<IReadOnlyList<FloorLayoutDto>>(result);
    }
}
