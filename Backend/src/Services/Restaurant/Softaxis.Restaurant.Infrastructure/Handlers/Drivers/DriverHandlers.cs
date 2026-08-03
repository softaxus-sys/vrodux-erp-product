using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
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

internal sealed class GetDriversHandler(RestaurantDbContext db) : IQueryHandler<GetDriversQuery, IReadOnlyList<DriverDto>>
{
    public async Task<Result<IReadOnlyList<DriverDto>>> Handle(GetDriversQuery query, CancellationToken ct)
    {
        var q = db.Drivers.AsNoTracking().Where(x => !x.IsDeleted);
        if (query.ActiveOnly) q = q.Where(x => x.IsActive);

        var items = await q.OrderBy(x => x.Name)
            .Select(d => new DriverDto(d.Id, d.BranchId, d.LinkedUserId, d.Name, d.Phone, d.VehicleInfo, d.IsActive))
            .ToListAsync(ct);
        return Result.Success<IReadOnlyList<DriverDto>>(items);
    }
}
