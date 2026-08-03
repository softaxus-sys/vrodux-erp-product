using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.Delivery.Abstractions;
using Softaxis.Restaurant.Application.DeliveryOrders.Commands;
using Softaxis.Restaurant.Application.DeliveryOrders.Dtos;
using Softaxis.Restaurant.Application.DeliveryOrders.Queries;
using Softaxis.Restaurant.Domain.Entities;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.DeliveryOrders;

internal sealed class CreateDeliveryOrderHandler(RestaurantDbContext db, IDeliveryProviderRegistry providers)
    : ICommandHandler<CreateDeliveryOrderCommand, DeliveryOrderDto>
{
    public async Task<Result<DeliveryOrderDto>> Handle(CreateDeliveryOrderCommand cmd, CancellationToken ct)
    {
        var order = await db.Orders.FirstOrDefaultAsync(x => x.Id == cmd.OrderId && !x.IsDeleted, ct);
        if (order is null) return Result.Failure<DeliveryOrderDto>(Error.NotFoundById("Order", cmd.OrderId));

        var alreadyExists = await db.DeliveryOrders.AnyAsync(x => x.OrderId == cmd.OrderId && !x.IsDeleted, ct);
        if (alreadyExists)
            return Result.Failure<DeliveryOrderDto>(Error.Custom("Delivery.Duplicate", "This order already has a delivery leg."));

        var provider = providers.Find(cmd.ProviderKey);
        if (provider is null || !provider.IsAvailable)
            return Result.Failure<DeliveryOrderDto>(Error.Custom("Delivery.NotConfigured",
                provider is null ? $"Unknown delivery provider '{cmd.ProviderKey}'." : $"{provider.DisplayName} isn't configured for this tenant yet."));

        DeliveryZone? zone = null;
        if (cmd.DeliveryZoneId.HasValue)
        {
            zone = await db.DeliveryZones.FirstOrDefaultAsync(x => x.Id == cmd.DeliveryZoneId.Value && !x.IsDeleted, ct);
            if (zone is null) return Result.Failure<DeliveryOrderDto>(Error.NotFoundById("DeliveryZone", cmd.DeliveryZoneId.Value));
        }

        var delivery = new DeliveryOrder(order.Id, cmd.Address.Trim(), cmd.Phone.Trim(),
            zone?.DeliveryFee ?? 0, zone?.Id, zone?.EstimatedMinutes,
            provider.Key == "manual" ? null : provider.Key, null);

        var dispatch = await provider.DispatchAsync(
            new DeliveryDispatchRequest(delivery.Id, delivery.Address, delivery.Phone, order.Total), ct);
        if (dispatch.IsFailure) return Result.Failure<DeliveryOrderDto>(dispatch.Error);

        db.DeliveryOrders.Add(delivery);
        await db.SaveChangesAsync(ct);

        return Result.Success(DeliveryOrderMappings.ToDto(delivery, order, zone?.Name, null));
    }
}

internal sealed class AssignDriverToDeliveryHandler(RestaurantDbContext db)
    : ICommandHandler<AssignDriverToDeliveryCommand, DeliveryOrderDto>
{
    public async Task<Result<DeliveryOrderDto>> Handle(AssignDriverToDeliveryCommand cmd, CancellationToken ct)
    {
        var delivery = await db.DeliveryOrders.FirstOrDefaultAsync(x => x.Id == cmd.DeliveryOrderId && !x.IsDeleted, ct);
        if (delivery is null) return Result.Failure<DeliveryOrderDto>(Error.NotFoundById("DeliveryOrder", cmd.DeliveryOrderId));

        var driver = await db.Drivers.FirstOrDefaultAsync(x => x.Id == cmd.DriverId && !x.IsDeleted, ct);
        if (driver is null) return Result.Failure<DeliveryOrderDto>(Error.NotFoundById("Driver", cmd.DriverId));

        delivery.AssignDriver(driver.Id);
        await db.SaveChangesAsync(ct);

        return await DeliveryOrderMappings.ToDtoWithLookupsAsync(db, delivery, ct);
    }
}

internal sealed class ChangeDeliveryStatusHandler(RestaurantDbContext db)
    : ICommandHandler<ChangeDeliveryStatusCommand, DeliveryOrderDto>
{
    public async Task<Result<DeliveryOrderDto>> Handle(ChangeDeliveryStatusCommand cmd, CancellationToken ct)
    {
        var delivery = await db.DeliveryOrders.FirstOrDefaultAsync(x => x.Id == cmd.DeliveryOrderId && !x.IsDeleted, ct);
        if (delivery is null) return Result.Failure<DeliveryOrderDto>(Error.NotFoundById("DeliveryOrder", cmd.DeliveryOrderId));

        if (!delivery.ChangeStatus(cmd.Status))
            return Result.Failure<DeliveryOrderDto>(Error.Custom("Delivery.InvalidTransition",
                $"Cannot move a '{delivery.Status}' delivery to '{cmd.Status}'."));

        await db.SaveChangesAsync(ct);
        return await DeliveryOrderMappings.ToDtoWithLookupsAsync(db, delivery, ct);
    }
}

internal sealed class GetDeliveryOrdersHandler(RestaurantDbContext db)
    : IQueryHandler<GetDeliveryOrdersQuery, IReadOnlyList<DeliveryOrderDto>>
{
    public async Task<Result<IReadOnlyList<DeliveryOrderDto>>> Handle(GetDeliveryOrdersQuery query, CancellationToken ct)
    {
        var q = db.DeliveryOrders.AsNoTracking().Where(x => !x.IsDeleted);
        if (!string.IsNullOrEmpty(query.Status)) q = q.Where(x => x.Status == query.Status);

        var deliveries = await q.OrderByDescending(x => x.CreatedAt).ToListAsync(ct);
        var dtos = await DeliveryOrderMappings.ToDtosAsync(db, deliveries, ct);
        return Result.Success<IReadOnlyList<DeliveryOrderDto>>(dtos);
    }
}

internal sealed class GetDeliveryOrderByIdHandler(RestaurantDbContext db)
    : IQueryHandler<GetDeliveryOrderByIdQuery, DeliveryOrderDto>
{
    public async Task<Result<DeliveryOrderDto>> Handle(GetDeliveryOrderByIdQuery query, CancellationToken ct)
    {
        var delivery = await db.DeliveryOrders.AsNoTracking().FirstOrDefaultAsync(x => x.Id == query.Id && !x.IsDeleted, ct);
        if (delivery is null) return Result.Failure<DeliveryOrderDto>(Error.NotFoundById("DeliveryOrder", query.Id));
        return await DeliveryOrderMappings.ToDtoWithLookupsAsync(db, delivery, ct);
    }
}

internal sealed class GetDeliverySummaryHandler(RestaurantDbContext db) : IQueryHandler<GetDeliverySummaryQuery, DeliverySummaryDto>
{
    public async Task<Result<DeliverySummaryDto>> Handle(GetDeliverySummaryQuery query, CancellationToken ct)
    {
        var all = await db.DeliveryOrders.AsNoTracking().Where(x => !x.IsDeleted).Select(x => x.Status).ToListAsync(ct);
        return Result.Success(new DeliverySummaryDto(
            all.Count,
            all.Count(s => s == "assigned"),
            all.Count(s => s == "picked_up"),
            all.Count(s => s == "enroute"),
            all.Count(s => s == "delivered"),
            all.Count(s => s == "failed")));
    }
}

internal sealed class GetDeliveryProvidersHandler(IDeliveryProviderRegistry providers)
    : IQueryHandler<GetDeliveryProvidersQuery, IReadOnlyList<DeliveryProviderDto>>
{
    public Task<Result<IReadOnlyList<DeliveryProviderDto>>> Handle(GetDeliveryProvidersQuery query, CancellationToken ct) =>
        Task.FromResult(Result.Success<IReadOnlyList<DeliveryProviderDto>>(
            providers.All.Select(p => new DeliveryProviderDto(p.Key, p.DisplayName, p.IsAvailable)).ToList()));
}

/// <summary>Anonymous — no [Authorize], resolved purely from the unguessable TrackingToken
/// (IgnoreQueryFilters since there's no ambient tenant on a public request).</summary>
internal sealed class GetDeliveryTrackingHandler(RestaurantDbContext db)
    : IQueryHandler<GetDeliveryTrackingQuery, DeliveryTrackingDto>
{
    public async Task<Result<DeliveryTrackingDto>> Handle(GetDeliveryTrackingQuery query, CancellationToken ct)
    {
        var delivery = await db.DeliveryOrders.IgnoreQueryFilters().AsNoTracking()
            .FirstOrDefaultAsync(x => x.TrackingToken == query.Token && !x.IsDeleted, ct);
        if (delivery is null) return Result.Failure<DeliveryTrackingDto>(Error.Custom("Delivery.NotFound", "Tracking link not found."));

        var order = await db.Orders.IgnoreQueryFilters().AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == delivery.OrderId, ct);
        var driverName = delivery.DriverId.HasValue
            ? (await db.Drivers.IgnoreQueryFilters().AsNoTracking().FirstOrDefaultAsync(x => x.Id == delivery.DriverId.Value, ct))?.Name
            : null;

        return Result.Success(new DeliveryTrackingDto(
            order?.OrderNumber ?? "—", delivery.Status, driverName, delivery.EstimatedDeliveryAt, delivery.DeliveredAt, delivery.Address));
    }
}

internal static class DeliveryOrderMappings
{
    public static DeliveryOrderDto ToDto(DeliveryOrder d, Order order, string? zoneName, string? driverName) => new(
        d.Id, d.OrderId, order.OrderNumber, order.Total, d.DeliveryZoneId, zoneName, d.DriverId, driverName,
        d.Status, d.Address, d.Phone, d.EstimatedDeliveryAt, d.DeliveredAt, d.DeliveryFee,
        d.ThirdPartyProvider, d.ThirdPartyOrderRef, d.TrackingToken, d.CreatedAt);

    public static async Task<Result<DeliveryOrderDto>> ToDtoWithLookupsAsync(RestaurantDbContext db, DeliveryOrder d, CancellationToken ct)
    {
        var order = await db.Orders.AsNoTracking().FirstOrDefaultAsync(x => x.Id == d.OrderId, ct);
        if (order is null) return Result.Failure<DeliveryOrderDto>(Error.NotFoundById("Order", d.OrderId));

        var zoneName = d.DeliveryZoneId.HasValue
            ? (await db.DeliveryZones.AsNoTracking().FirstOrDefaultAsync(x => x.Id == d.DeliveryZoneId.Value, ct))?.Name
            : null;
        var driverName = d.DriverId.HasValue
            ? (await db.Drivers.AsNoTracking().FirstOrDefaultAsync(x => x.Id == d.DriverId.Value, ct))?.Name
            : null;

        return Result.Success(ToDto(d, order, zoneName, driverName));
    }

    public static async Task<List<DeliveryOrderDto>> ToDtosAsync(RestaurantDbContext db, List<DeliveryOrder> deliveries, CancellationToken ct)
    {
        var orderIds = deliveries.Select(d => d.OrderId).ToList();
        var orders = await db.Orders.AsNoTracking().Where(o => orderIds.Contains(o.Id)).ToDictionaryAsync(o => o.Id, ct);

        var zoneIds = deliveries.Where(d => d.DeliveryZoneId.HasValue).Select(d => d.DeliveryZoneId!.Value).Distinct().ToList();
        var zones = await db.DeliveryZones.AsNoTracking().Where(z => zoneIds.Contains(z.Id)).ToDictionaryAsync(z => z.Id, z => z.Name, ct);

        var driverIds = deliveries.Where(d => d.DriverId.HasValue).Select(d => d.DriverId!.Value).Distinct().ToList();
        var drivers = await db.Drivers.AsNoTracking().Where(dr => driverIds.Contains(dr.Id)).ToDictionaryAsync(dr => dr.Id, dr => dr.Name, ct);

        return deliveries.Where(d => orders.ContainsKey(d.OrderId)).Select(d => ToDto(
            d, orders[d.OrderId],
            d.DeliveryZoneId.HasValue && zones.TryGetValue(d.DeliveryZoneId.Value, out var zn) ? zn : null,
            d.DriverId.HasValue && drivers.TryGetValue(d.DriverId.Value, out var dn) ? dn : null)).ToList();
    }
}
