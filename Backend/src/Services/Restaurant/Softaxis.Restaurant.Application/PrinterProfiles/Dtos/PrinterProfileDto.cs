namespace Softaxis.Restaurant.Application.PrinterProfiles.Dtos;

public sealed record PrinterProfileDto(
    Guid Id, Guid? BranchId, string Name, string Type, string ConnectionType,
    string? IpAddress, int? Port, bool IsDefault);
