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
    bool IsOnlineOrderable,
    /// <summary>Photo metadata only, cover first — the bytes come from the image endpoint.</summary>
    IReadOnlyList<MenuItemImageDto>? Images = null,
    /// <summary>Set only when the menu was read for one branch that sells the item at a different
    /// price: the shared menu price (Price is then the branch price).</summary>
    decimal? BasePrice = null,
    /// <summary>False when the branch the menu was read for does not sell this item.</summary>
    bool SoldHere = true);

/// <summary>One branch's exception to the shared menu for one item.</summary>
public sealed record MenuItemBranchSettingDto(Guid MenuItemId, Guid BranchId, decimal? PriceOverride, bool IsAvailable);

public sealed record MenuItemImageDto(Guid Id, bool IsPrimary, int SortOrder, string? FileName);

/// <summary>The bytes themselves. Only ever produced by the single-image endpoint.</summary>
public sealed record MenuItemImageFileDto(byte[] Data, string ContentType);

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
