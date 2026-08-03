namespace Softaxis.Restaurant.Application.ModifierGroups.Dtos;

public sealed record ModifierDto(Guid Id, string Name, decimal PriceDelta, int SortOrder, bool IsActive);

public sealed record ModifierGroupDto(
    Guid Id,
    string Name,
    int MinSelect,
    int MaxSelect,
    IReadOnlyList<ModifierDto> Modifiers);

/// <summary>Id null = a new modifier being added; Id set = updating an existing one. Any existing
/// modifier NOT present in an update's list is soft-deleted (diff-and-replace).</summary>
public sealed record ModifierInput(Guid? Id, string Name, decimal PriceDelta, int SortOrder, bool IsActive = true);
