using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.Menu.Commands;
using Softaxis.Restaurant.Application.Menu.Dtos;
using Softaxis.Restaurant.Domain.Entities;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.Menu;

internal sealed class ImportMenuHandler(RestaurantDbContext db)
    : ICommandHandler<ImportMenuCommand, ImportMenuResultDto>
{
    private const int MaxErrorsReturned = 100;
    private const int DefaultPrepMinutes = 10;

    public async Task<Result<ImportMenuResultDto>> Handle(ImportMenuCommand cmd, CancellationToken ct)
    {
        var categories = await db.MenuCategories.Where(c => !c.IsDeleted).ToListAsync(ct);
        var byName = categories
            .GroupBy(c => Key(c.Name))
            .ToDictionary(g => g.Key, g => g.First());
        var nextSort = categories.Count == 0 ? 0 : categories.Max(c => c.SortOrder) + 1;

        // Re-running the same file must not double the menu: a dish already under its category is skipped.
        var existing = (await db.MenuItems.AsNoTracking()
                .Where(i => !i.IsDeleted)
                .Select(i => new { i.CategoryId, i.Name })
                .ToListAsync(ct))
            .Select(i => (i.CategoryId, Key(i.Name)))
            .ToHashSet();

        var errors = new List<ImportMenuRowError>();
        var created = new List<ImportedMenuItemDto>();
        int categoriesCreated = 0, skipped = 0, failed = 0;

        void Fail(int row, string message)
        {
            failed++;
            if (errors.Count < MaxErrorsReturned) errors.Add(new ImportMenuRowError(row, message));
        }

        for (var row = 0; row < cmd.Rows.Count; row++)
        {
            var r = cmd.Rows[row];
            var categoryName = r.Category?.Trim() ?? "";
            var name = r.Name?.Trim() ?? "";

            if (name.Length == 0) { Fail(row, "Dish name is missing."); continue; }
            if (categoryName.Length == 0) { Fail(row, $"'{name}' has no category."); continue; }
            if (name.Length > 200) { Fail(row, "Dish name is longer than 200 characters."); continue; }
            if (categoryName.Length > 100) { Fail(row, "Category name is longer than 100 characters."); continue; }
            if (r.Price < 0) { Fail(row, $"'{name}' has a negative price."); continue; }

            if (!byName.TryGetValue(Key(categoryName), out var category))
            {
                category = new MenuCategory(categoryName, Clip(r.CategoryDescription, 500), nextSort++);
                db.MenuCategories.Add(category);
                byName[Key(categoryName)] = category;
                categoriesCreated++;
            }

            if (!existing.Add((category.Id, Key(name)))) { skipped++; continue; }

            var item = new MenuItem(
                category.Id, name, Clip(r.Description, 1000), r.Price,
                r.PrepTimeMinutes is > 0 ? r.PrepTimeMinutes.Value : DefaultPrepMinutes,
                Clip(r.Allergens, 500));
            db.MenuItems.Add(item);
            created.Add(new ImportedMenuItemDto(row, item.Id));
        }

        await db.SaveChangesAsync(ct);

        return Result.Success(new ImportMenuResultDto(
            categoriesCreated, created.Count, skipped, failed, errors, created));
    }

    private static string Key(string value) => value.Trim().ToLowerInvariant();

    private static string? Clip(string? value, int max)
    {
        var v = value?.Trim();
        if (string.IsNullOrEmpty(v)) return null;
        return v.Length <= max ? v : v[..max];
    }
}
