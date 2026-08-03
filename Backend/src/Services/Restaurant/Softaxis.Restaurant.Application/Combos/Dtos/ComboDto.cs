namespace Softaxis.Restaurant.Application.Combos.Dtos;

public sealed record ComboItemDto(
    Guid Id, Guid? MenuItemId, string? MenuItemName, Guid? CategoryId, string? CategoryName, int Quantity, int SortOrder);

public sealed record ComboDto(Guid Id, string Name, decimal Price, bool IsActive, IReadOnlyList<ComboItemDto> Items);
