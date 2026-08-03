namespace Softaxis.Restaurant.Application.KitchenStations.Dtos;

public sealed record KitchenStationDto(
    Guid Id, Guid? BranchId, string Name, string? DisplayName, string? ColorTag, int SortOrder, Guid? PrinterProfileId);
