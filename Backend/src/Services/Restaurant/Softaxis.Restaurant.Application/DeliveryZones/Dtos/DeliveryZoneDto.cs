namespace Softaxis.Restaurant.Application.DeliveryZones.Dtos;

public sealed record DeliveryZoneDto(
    Guid Id, Guid? BranchId, string Name, string? PostalCodesJson,
    decimal DeliveryFee, decimal MinOrderAmount, int EstimatedMinutes, bool IsActive);
