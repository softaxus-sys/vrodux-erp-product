using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Restaurant.Application.Devices.Dtos;

namespace Softaxis.Restaurant.Application.Devices.Commands;

/// <summary>POST /api/restaurant/devices/register — self-service, any authenticated user's browser can
/// announce its own device. Upsert-by-fingerprint: re-registering the same fingerprint just updates the
/// name/branch/heartbeat rather than erroring (a page reload legitimately re-sends the same fingerprint).</summary>
public sealed record RegisterDeviceCommand(Guid? BranchId, string DeviceFingerprint, string DeviceName) : ICommand<DeviceRegistrationDto>;

public sealed class RegisterDeviceValidator : AbstractValidator<RegisterDeviceCommand>
{
    public RegisterDeviceValidator()
    {
        RuleFor(x => x.DeviceFingerprint).NotEmpty().MaximumLength(100);
        RuleFor(x => x.DeviceName).NotEmpty().MaximumLength(150);
    }
}

/// <summary>POST /api/restaurant/devices/heartbeat — self-service. No-op (not an error) if the
/// fingerprint isn't registered — a heartbeat from an unregistered/since-deleted device is benign.</summary>
public sealed record HeartbeatDeviceCommand(string DeviceFingerprint) : ICommand;

public sealed class HeartbeatDeviceValidator : AbstractValidator<HeartbeatDeviceCommand>
{
    public HeartbeatDeviceValidator()
    {
        RuleFor(x => x.DeviceFingerprint).NotEmpty();
    }
}

/// <summary>PUT /api/restaurant/devices/{id} — admin rename/reassign-branch/activate-deactivate.</summary>
public sealed record UpdateDeviceRegistrationCommand(Guid Id, string DeviceName, Guid? BranchId, bool IsActive) : ICommand<DeviceRegistrationDto>;

public sealed class UpdateDeviceRegistrationValidator : AbstractValidator<UpdateDeviceRegistrationCommand>
{
    public UpdateDeviceRegistrationValidator()
    {
        RuleFor(x => x.DeviceName).NotEmpty().MaximumLength(150);
    }
}

/// <summary>DELETE /api/restaurant/devices/{id} — admin, permanently decommissioned device.</summary>
public sealed record DeleteDeviceRegistrationCommand(Guid Id) : ICommand;
