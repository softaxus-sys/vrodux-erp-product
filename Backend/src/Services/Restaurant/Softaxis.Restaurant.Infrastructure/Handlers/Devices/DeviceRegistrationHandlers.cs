using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.Abstractions;
using Softaxis.Restaurant.Application.Devices.Commands;
using Softaxis.Restaurant.Application.Devices.Dtos;
using Softaxis.Restaurant.Application.Devices.Queries;
using Softaxis.Restaurant.Domain.Entities;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.Devices;

internal static class DeviceRegistrationMappings
{
    public static DeviceRegistrationDto ToDto(DeviceRegistration d) => new(
        d.Id, d.BranchId, d.DeviceName, d.DeviceFingerprint, d.RegisteredByUserId, d.LastSeenAt, d.IsActive, d.CreatedAt);
}

internal sealed class GetDeviceRegistrationsHandler(RestaurantDbContext db)
    : IQueryHandler<GetDeviceRegistrationsQuery, IReadOnlyList<DeviceRegistrationDto>>
{
    public async Task<Result<IReadOnlyList<DeviceRegistrationDto>>> Handle(GetDeviceRegistrationsQuery query, CancellationToken ct)
    {
        var items = await db.DeviceRegistrations.AsNoTracking()
            .Where(x => query.BranchId == null || x.BranchId == query.BranchId)
            .OrderByDescending(x => x.LastSeenAt)
            .ToListAsync(ct);

        return Result.Success<IReadOnlyList<DeviceRegistrationDto>>(items.Select(DeviceRegistrationMappings.ToDto).ToList());
    }
}

internal sealed class RegisterDeviceHandler(RestaurantDbContext db, ICurrentUser currentUser)
    : ICommandHandler<RegisterDeviceCommand, DeviceRegistrationDto>
{
    public async Task<Result<DeviceRegistrationDto>> Handle(RegisterDeviceCommand cmd, CancellationToken ct)
    {
        if (currentUser.Id is null)
            return Result.Failure<DeviceRegistrationDto>(Error.Custom("Auth.Unresolved", "Could not resolve the current user."));

        var existing = await db.DeviceRegistrations.FirstOrDefaultAsync(x => x.DeviceFingerprint == cmd.DeviceFingerprint, ct);
        if (existing is not null)
        {
            existing.Rename(cmd.DeviceName);
            existing.SetBranch(cmd.BranchId);
            existing.Heartbeat();
            await db.SaveChangesAsync(ct);
            return Result.Success(DeviceRegistrationMappings.ToDto(existing));
        }

        var device = new DeviceRegistration(cmd.BranchId, cmd.DeviceFingerprint, cmd.DeviceName, currentUser.Id.Value);
        db.DeviceRegistrations.Add(device);
        await db.SaveChangesAsync(ct);

        return Result.Success(DeviceRegistrationMappings.ToDto(device));
    }
}

internal sealed class HeartbeatDeviceHandler(RestaurantDbContext db) : ICommandHandler<HeartbeatDeviceCommand>
{
    public async Task<Result> Handle(HeartbeatDeviceCommand cmd, CancellationToken ct)
    {
        var device = await db.DeviceRegistrations.FirstOrDefaultAsync(x => x.DeviceFingerprint == cmd.DeviceFingerprint, ct);
        if (device is null) return Result.Success(); // benign — see the command's own doc comment

        device.Heartbeat();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class UpdateDeviceRegistrationHandler(RestaurantDbContext db)
    : ICommandHandler<UpdateDeviceRegistrationCommand, DeviceRegistrationDto>
{
    public async Task<Result<DeviceRegistrationDto>> Handle(UpdateDeviceRegistrationCommand cmd, CancellationToken ct)
    {
        var device = await db.DeviceRegistrations.FindAsync([cmd.Id], ct);
        if (device is null) return Result.Failure<DeviceRegistrationDto>(Error.NotFoundById("DeviceRegistration", cmd.Id));

        device.Rename(cmd.DeviceName);
        device.SetBranch(cmd.BranchId);
        device.SetActive(cmd.IsActive);
        await db.SaveChangesAsync(ct);

        return Result.Success(DeviceRegistrationMappings.ToDto(device));
    }
}

internal sealed class DeleteDeviceRegistrationHandler(RestaurantDbContext db) : ICommandHandler<DeleteDeviceRegistrationCommand>
{
    public async Task<Result> Handle(DeleteDeviceRegistrationCommand cmd, CancellationToken ct)
    {
        var device = await db.DeviceRegistrations.FindAsync([cmd.Id], ct);
        if (device is null) return Result.Failure(Error.NotFoundById("DeviceRegistration", cmd.Id));

        db.DeviceRegistrations.Remove(device);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
