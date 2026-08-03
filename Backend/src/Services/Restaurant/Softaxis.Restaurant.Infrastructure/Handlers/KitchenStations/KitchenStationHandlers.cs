using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.KitchenStations.Commands;
using Softaxis.Restaurant.Application.KitchenStations.Dtos;
using Softaxis.Restaurant.Application.KitchenStations.Queries;
using Softaxis.Restaurant.Domain.Entities;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.KitchenStations;

internal static class KitchenStationMappings
{
    public static KitchenStationDto ToDto(KitchenStation s) => new(
        s.Id, s.BranchId, s.Name, s.DisplayName, s.ColorTag, s.SortOrder, s.PrinterProfileId);
}

internal sealed class CreateKitchenStationHandler(RestaurantDbContext db)
    : ICommandHandler<CreateKitchenStationCommand, KitchenStationDto>
{
    public async Task<Result<KitchenStationDto>> Handle(CreateKitchenStationCommand cmd, CancellationToken ct)
    {
        var station = new KitchenStation(cmd.Name.Trim(), cmd.DisplayName, cmd.ColorTag, cmd.SortOrder, cmd.PrinterProfileId, cmd.BranchId);
        db.KitchenStations.Add(station);
        await db.SaveChangesAsync(ct);
        return Result.Success(KitchenStationMappings.ToDto(station));
    }
}

internal sealed class UpdateKitchenStationHandler(RestaurantDbContext db)
    : ICommandHandler<UpdateKitchenStationCommand, KitchenStationDto>
{
    public async Task<Result<KitchenStationDto>> Handle(UpdateKitchenStationCommand cmd, CancellationToken ct)
    {
        var station = await db.KitchenStations.FirstOrDefaultAsync(x => x.Id == cmd.Id && !x.IsDeleted, ct);
        if (station is null) return Result.Failure<KitchenStationDto>(Error.NotFoundById("KitchenStation", cmd.Id));

        station.Update(cmd.Name.Trim(), cmd.DisplayName, cmd.ColorTag, cmd.SortOrder, cmd.PrinterProfileId);
        await db.SaveChangesAsync(ct);
        return Result.Success(KitchenStationMappings.ToDto(station));
    }
}

internal sealed class DeleteKitchenStationHandler(RestaurantDbContext db) : ICommandHandler<DeleteKitchenStationCommand>
{
    public async Task<Result> Handle(DeleteKitchenStationCommand cmd, CancellationToken ct)
    {
        var station = await db.KitchenStations.FirstOrDefaultAsync(x => x.Id == cmd.Id && !x.IsDeleted, ct);
        if (station is null) return Result.Failure(Error.NotFoundById("KitchenStation", cmd.Id));

        station.Delete();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class GetKitchenStationsHandler(RestaurantDbContext db)
    : IQueryHandler<GetKitchenStationsQuery, IReadOnlyList<KitchenStationDto>>
{
    public async Task<Result<IReadOnlyList<KitchenStationDto>>> Handle(GetKitchenStationsQuery query, CancellationToken ct)
    {
        var items = await db.KitchenStations.AsNoTracking().Where(x => !x.IsDeleted)
            .OrderBy(x => x.SortOrder).ThenBy(x => x.Name)
            .Select(s => new KitchenStationDto(s.Id, s.BranchId, s.Name, s.DisplayName, s.ColorTag, s.SortOrder, s.PrinterProfileId))
            .ToListAsync(ct);
        return Result.Success<IReadOnlyList<KitchenStationDto>>(items);
    }
}
