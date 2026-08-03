using Softaxis.Restaurant.Application.ModifierGroups.Dtos;

namespace Softaxis.Restaurant.Application.Menu.Dtos;

public sealed record MenuItemDto(
    Guid Id,
    Guid CategoryId,
    string Name,
    string? Description,
    decimal Price,
    int PrepTimeMinutes,
    string? Allergens,
    bool IsAvailable,
    IReadOnlyList<ModifierGroupDto> ModifierGroups,
    Guid? KitchenStationId,
    bool IsOnlineOrderable);

public sealed record MenuCategoryDto(
    Guid Id,
    string Name,
    string? Description,
    int SortOrder,
    bool IsActive,
    IReadOnlyList<MenuItemDto> Items,
    Guid? KitchenStationId);

public sealed record MenuSummaryDto(
    int TotalCategories,
    int TotalItems,
    int AvailableItems,
    int UnavailableItems,
    double AvgPrice,
    decimal MinPrice,
    decimal MaxPrice);

public sealed record ItemAvailabilityDto(Guid Id, bool IsAvailable);
