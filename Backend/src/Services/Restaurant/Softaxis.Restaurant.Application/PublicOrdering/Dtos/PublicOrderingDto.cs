namespace Softaxis.Restaurant.Application.PublicOrdering.Dtos;

public sealed record PublicMenuItemDto(Guid Id, string Name, string? Description, decimal Price, string? Allergens);

public sealed record PublicMenuCategoryDto(Guid Id, string Name, string? Description, IReadOnlyList<PublicMenuItemDto> Items);

public sealed record PublicMenuDto(Guid TableId, string TableNumber, IReadOnlyList<PublicMenuCategoryDto> Categories);

public sealed record PublicOrderLineInput(Guid MenuItemId, int Quantity, string? Modifiers);

public sealed record PublicOrderPlacedDto(Guid OrderId, string OrderNumber, decimal Total);
