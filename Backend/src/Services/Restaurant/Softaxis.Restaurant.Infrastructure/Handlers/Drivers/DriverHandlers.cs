using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.Drivers.Commands;
using Softaxis.Restaurant.Application.Drivers.Dtos;
using Softaxis.Restaurant.Application.Drivers.Queries;
using Softaxis.Restaurant.Domain.Entities;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.Drivers;

internal static class DriverMappings
{
    public static DriverDto ToDto(Driver d) => new(d.Id, d.BranchId, d.LinkedUserId, d.Name, d.Phone, d.VehicleInfo, d.IsActive);
}

internal sealed class CreateDriverHandler(RestaurantDbContext db) : ICommandHandler<CreateDriverCommand, DriverDto>
{
    public async Task<Result<DriverDto>> Handle(CreateDriverCommand cmd, CancellationToken ct)
    {
        var driver = new Driver(cmd.Name.Trim(), cmd.Phone.Trim(), cmd.VehicleInfo, cmd.LinkedUserId, cmd.BranchId);
        db.Drivers.Add(driver);
        await db.SaveChangesAsync(ct);
        return Result.Success(DriverMappings.ToDto(driver));
    }
}

internal sealed class UpdateDriverHandler(RestaurantDbContext db) : ICommandHandler<UpdateDriverCommand, DriverDto>
{
    public async Task<Result<DriverDto>> Handle(UpdateDriverCommand cmd, CancellationToken ct)
    {
        var driver = await db.Drivers.FirstOrDefaultAsync(x => x.Id == cmd.Id && !x.IsDeleted, ct);
        if (driver is null) return Result.Failure<DriverDto>(Error.NotFoundById("Driver", cmd.Id));

        driver.Update(cmd.Name.Trim(), cmd.Phone.Trim(), cmd.VehicleInfo, cmd.IsActive);
        driver.LinkUser(cmd.LinkedUserId);
        await db.SaveChangesAsync(ct);
        return Result.Success(DriverMappings.ToDto(driver));
    }
}

internal sealed class DeleteDriverHandler(RestaurantDbContext db) : ICommandHandler<DeleteDriverCommand>
{
    public async Task<Result> Handle(DeleteDriverCommand cmd, CancellationToken ct)
    {
        var driver = await db.Drivers.FirstOrDefaultAsync(x => x.Id == cmd.Id && !x.IsDeleted, ct);
        if (driver is null) return Result.Failure(Error.NotFoundById("Driver", cmd.Id));

        driver.Delete();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class GetDriversHandler(RestaurantDbContext db, ILogger<GetDriversHandler> logger)
    : IQueryHandler<GetDriversQuery, IReadOnlyList<DriverDto>>
{
    private const string RiderRole = "Delivery Rider";
    private static readonly string[] OpenStatuses = ["assigned", "picked_up", "enroute"];

    public async Task<Result<IReadOnlyList<DriverDto>>> Handle(GetDriversQuery query, CancellationToken ct)
    {
        await EnsureRidersHaveDriversAsync(ct);

        var q = db.Drivers.AsNoTracking().Where(x => !x.IsDeleted);
        if (query.ActiveOnly) q = q.Where(x => x.IsActive);
        var drivers = await q.OrderBy(x => x.Name).ToListAsync(ct);

        var load = (await db.DeliveryOrders.AsNoTracking()
                .Where(d => !d.IsDeleted && d.DriverId != null && OpenStatuses.Contains(d.Status))
                .Select(d => d.DriverId!.Value)
                .ToListAsync(ct))
            .GroupBy(id => id).ToDictionary(g => g.Key, g => g.Count());

        var items = drivers
            .Select(d => new DriverDto(d.Id, d.BranchId, d.LinkedUserId, d.Name, d.Phone, d.VehicleInfo, d.IsActive,
                load.GetValueOrDefault(d.Id)))
            .ToList();
        return Result.Success<IReadOnlyList<DriverDto>>(items);
    }

    /// <summary>
    /// Every login holding the Delivery Rider role is a rider, so each gets a driver record linked to
    /// it the first time the list is read. Without this a rider could be given the role and still be
    /// impossible to assign until someone also typed them in again under Drivers. Done here rather
    /// than at startup: a startup pass has no tenant, and would write rows nobody can see.
    /// </summary>
    private async Task EnsureRidersHaveDriversAsync(CancellationToken ct)
    {
        if (TenantAmbient.TenantId is not { } tenantId) return;
        try
        {
            // [identity] is a reserved word in SQL Server and must stay bracketed.
            var riders = await db.Database.SqlQuery<RiderLogin>($"""
                SELECT DISTINCT u.Id AS UserId, LTRIM(RTRIM(u.FirstName + ' ' + u.LastName)) AS Name, u.PhoneNumber AS Phone
                FROM [identity].[users] u
                JOIN [identity].[user_roles] ur ON ur.UserId = u.Id
                JOIN [identity].[roles] r ON r.Id = ur.RoleId
                WHERE u.TenantId = {tenantId} AND u.IsDeleted = 0 AND u.Status = 'Active'
                  AND r.Name = {RiderRole} AND r.IsDeleted = 0
                """).ToListAsync(ct);
            if (riders.Count == 0) return;

            var linked = (await db.Drivers.Where(d => d.LinkedUserId != null && !d.IsDeleted)
                .Select(d => d.LinkedUserId!.Value).ToListAsync(ct)).ToHashSet();

            var missing = riders.Where(r => !linked.Contains(r.UserId)).ToList();
            if (missing.Count == 0) return;

            foreach (var rider in missing)
                db.Drivers.Add(new Driver(
                    string.IsNullOrWhiteSpace(rider.Name) ? "Rider" : rider.Name, rider.Phone ?? "", null, rider.UserId));
            await db.SaveChangesAsync(ct);
        }
        catch (Exception ex)
        {
            // The driver list must still load when the lookup fails; the riders are simply not added yet.
            logger.LogWarning(ex, "Could not sync Delivery Rider logins into drivers");
        }
    }

    private sealed record RiderLogin(Guid UserId, string Name, string? Phone);
}
