namespace Softaxis.Restaurant.Application.Menu.Dtos;

/// <param name="Skipped">Dishes already on the menu under the same category — left untouched.</param>
/// <param name="Items">The dishes this import created, by zero-based row, so the client can attach photos.</param>
public sealed record ImportMenuResultDto(
    int CategoriesCreated,
    int ItemsCreated,
    int Skipped,
    int Failed,
    IReadOnlyList<ImportMenuRowError> Errors,
    IReadOnlyList<ImportedMenuItemDto> Items);

public sealed record ImportMenuRowError(int Row, string Message);

public sealed record ImportedMenuItemDto(int Row, Guid ItemId);
