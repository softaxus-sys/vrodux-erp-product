namespace Softaxis.Restaurant.Application.Drivers.Dtos;

public sealed record DriverDto(
    Guid Id, Guid? BranchId, Guid? LinkedUserId, string Name, string Phone, string? VehicleInfo, bool IsActive);
