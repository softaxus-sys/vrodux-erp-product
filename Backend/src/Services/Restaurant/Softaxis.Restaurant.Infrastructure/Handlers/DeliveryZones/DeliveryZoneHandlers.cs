using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.DeliveryZones.Commands;
using Softaxis.Restaurant.Application.DeliveryZones.Dtos;
using Softaxis.Restaurant.Application.DeliveryZones.Queries;
using Softaxis.Restaurant.Domain.Entities;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.DeliveryZones;

internal static class DeliveryZoneMappings
{
    public static DeliveryZoneDto ToDto(DeliveryZone z) => new(
        z.Id, z.BranchId, z.Name, z.PostalCodesJson, z.DeliveryFee, z.MinOrderAmount, z.EstimatedMinutes, z.IsActive);
}

internal sealed class CreateDeliveryZoneHandler(RestaurantDbContext db)
    : ICommandHandler<CreateDeliveryZoneCommand, DeliveryZoneDto>
{
    public async Task<Result<DeliveryZoneDto>> Handle(CreateDeliveryZoneCommand cmd, CancellationToken ct)
    {
        var zone = new DeliveryZone(cmd.Name.Trim(), cmd.PostalCodesJson, cmd.DeliveryFee, cmd.MinOrderAmount, cmd.EstimatedMinutes, cmd.BranchId);
        db.DeliveryZones.Add(zone);
        await db.SaveChangesAsync(ct);
        return Result.Success(DeliveryZoneMappings.ToDto(zone));
    }
}

internal sealed class UpdateDeliveryZoneHandler(RestaurantDbContext db)
    : ICommandHandler<UpdateDeliveryZoneCommand, DeliveryZoneDto>
{
    public async Task<Result<DeliveryZoneDto>> Handle(UpdateDeliveryZoneCommand cmd, CancellationToken ct)
    {
        var zone = await db.DeliveryZones.FirstOrDefaultAsync(x => x.Id == cmd.Id && !x.IsDeleted, ct);
        if (zone is null) return Result.Failure<DeliveryZoneDto>(Error.NotFoundById("DeliveryZone", cmd.Id));

        zone.Update(cmd.Name.Trim(), cmd.PostalCodesJson, cmd.DeliveryFee, cmd.MinOrderAmount, cmd.EstimatedMinutes, cmd.IsActive);
        await db.SaveChangesAsync(ct);
        return Result.Success(DeliveryZoneMappings.ToDto(zone));
    }
}

internal sealed class DeleteDeliveryZoneHandler(RestaurantDbContext db) : ICommandHandler<DeleteDeliveryZoneCommand>
{
    public async Task<Result> Handle(DeleteDeliveryZoneCommand cmd, CancellationToken ct)
    {
        var zone = await db.DeliveryZones.FirstOrDefaultAsync(x => x.Id == cmd.Id && !x.IsDeleted, ct);
        if (zone is null) return Result.Failure(Error.NotFoundById("DeliveryZone", cmd.Id));

        zone.Delete();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class GetDeliveryZonesHandler(RestaurantDbContext db)
    : IQueryHandler<GetDeliveryZonesQuery, IReadOnlyList<DeliveryZoneDto>>
{
    public async Task<Result<IReadOnlyList<DeliveryZoneDto>>> Handle(GetDeliveryZonesQuery query, CancellationToken ct)
    {
        var items = await db.DeliveryZones.AsNoTracking().Where(x => !x.IsDeleted)
            .OrderBy(x => x.Name)
            .Select(z => new DeliveryZoneDto(z.Id, z.BranchId, z.Name, z.PostalCodesJson, z.DeliveryFee, z.MinOrderAmount, z.EstimatedMinutes, z.IsActive))
            .ToListAsync(ct);
        return Result.Success<IReadOnlyList<DeliveryZoneDto>>(items);
    }
}
