namespace Softaxis.Restaurant.Application.Devices.Dtos;

public sealed record DeviceRegistrationDto(
    Guid Id, Guid? BranchId, string DeviceName, string DeviceFingerprint,
    Guid RegisteredByUserId, DateTime LastSeenAt, bool IsActive, DateTime CreatedAt);
