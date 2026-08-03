using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.Combos.Commands;
using Softaxis.Restaurant.Application.Combos.Dtos;
using Softaxis.Restaurant.Application.Combos.Queries;
using Softaxis.Restaurant.Domain.Entities;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.Combos;

internal sealed class CreateComboHandler(RestaurantDbContext db) : ICommandHandler<CreateComboCommand, ComboDto>
{
    public async Task<Result<ComboDto>> Handle(CreateComboCommand cmd, CancellationToken ct)
    {
        var check = await ComboValidation.ValidateSlotsAsync(db, cmd.Items, ct);
        if (check.IsFailure) return Result.Failure<ComboDto>(check.Error);

        var combo = new Combo(cmd.Name.Trim(), cmd.Price);
        foreach (var i in cmd.Items.OrderBy(x => x.SortOrder))
            combo.Items.Add(new ComboItem(combo.Id, i.MenuItemId, i.CategoryId, i.Quantity, i.SortOrder));

        db.Combos.Add(combo);
        await db.SaveChangesAsync(ct);
        return Result.Success(await ComboMappings.ToDtoAsync(db, combo, ct));
    }
}

internal sealed class UpdateComboHandler(RestaurantDbContext db) : ICommandHandler<UpdateComboCommand, ComboDto>
{
    public async Task<Result<ComboDto>> Handle(UpdateComboCommand cmd, CancellationToken ct)
    {
        var combo = await db.Combos.Include(x => x.Items).FirstOrDefaultAsync(x => x.Id == cmd.Id && !x.IsDeleted, ct);
        if (combo is null) return Result.Failure<ComboDto>(Error.NotFoundById("Combo", cmd.Id));

        var check = await ComboValidation.ValidateSlotsAsync(db, cmd.Items, ct);
        if (check.IsFailure) return Result.Failure<ComboDto>(check.Error);

        combo.Update(cmd.Name.Trim(), cmd.Price, cmd.IsActive);
        db.ComboItems.RemoveRange(combo.Items);
        combo.Items.Clear();
        foreach (var i in cmd.Items.OrderBy(x => x.SortOrder))
            combo.Items.Add(new ComboItem(combo.Id, i.MenuItemId, i.CategoryId, i.Quantity, i.SortOrder));

        await db.SaveChangesAsync(ct);
        return Result.Success(await ComboMappings.ToDtoAsync(db, combo, ct));
    }
}

internal sealed class DeleteComboHandler(RestaurantDbContext db) : ICommandHandler<DeleteComboCommand>
{
    public async Task<Result> Handle(DeleteComboCommand cmd, CancellationToken ct)
    {
        var combo = await db.Combos.FirstOrDefaultAsync(x => x.Id == cmd.Id && !x.IsDeleted, ct);
        if (combo is null) return Result.Failure(Error.NotFoundById("Combo", cmd.Id));

        combo.Delete();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class GetCombosHandler(RestaurantDbContext db) : IQueryHandler<GetCombosQuery, IReadOnlyList<ComboDto>>
{
    public async Task<Result<IReadOnlyList<ComboDto>>> Handle(GetCombosQuery query, CancellationToken ct)
    {
        var q = db.Combos.AsNoTracking().Include(x => x.Items).Where(x => !x.IsDeleted);
        if (query.ActiveOnly) q = q.Where(x => x.IsActive);

        var combos = await q.OrderBy(x => x.Name).ToListAsync(ct);
        var dtos = new List<ComboDto>();
        foreach (var c in combos)
            dtos.Add(await ComboMappings.ToDtoAsync(db, c, ct));

        return Result.Success<IReadOnlyList<ComboDto>>(dtos);
    }
}

internal static class ComboValidation
{
    /// <summary>Confirms every fixed slot's MenuItemId and every choice slot's CategoryId actually exist.</summary>
    public static async Task<Result> ValidateSlotsAsync(RestaurantDbContext db, IReadOnlyList<ComboItemInput> items, CancellationToken ct)
    {
        var menuItemIds = items.Where(i => i.MenuItemId.HasValue).Select(i => i.MenuItemId!.Value).Distinct().ToList();
        var categoryIds = items.Where(i => i.CategoryId.HasValue).Select(i => i.CategoryId!.Value).Distinct().ToList();

        if (menuItemIds.Count > 0)
        {
            var found = await db.MenuItems.Where(m => menuItemIds.Contains(m.Id) && !m.IsDeleted).CountAsync(ct);
            if (found != menuItemIds.Count)
                return Result.Failure(Error.Custom("Combo.Conflict", "One or more fixed menu items don't exist."));
        }
        if (categoryIds.Count > 0)
        {
            var found = await db.MenuCategories.Where(c => categoryIds.Contains(c.Id) && !c.IsDeleted).CountAsync(ct);
            if (found != categoryIds.Count)
                return Result.Failure(Error.Custom("Combo.Conflict", "One or more choice categories don't exist."));
        }
        return Result.Success();
    }
}

internal static class ComboMappings
{
    public static async Task<ComboDto> ToDtoAsync(RestaurantDbContext db, Combo combo, CancellationToken ct)
    {
        var menuItemIds = combo.Items.Where(i => i.MenuItemId.HasValue).Select(i => i.MenuItemId!.Value).ToList();
        var categoryIds = combo.Items.Where(i => i.CategoryId.HasValue).Select(i => i.CategoryId!.Value).ToList();

        var menuItemNames = await db.MenuItems.AsNoTracking()
            .Where(m => menuItemIds.Contains(m.Id)).Select(m => new { m.Id, m.Name }).ToDictionaryAsync(m => m.Id, m => m.Name, ct);
        var categoryNames = await db.MenuCategories.AsNoTracking()
            .Where(c => categoryIds.Contains(c.Id)).Select(c => new { c.Id, c.Name }).ToDictionaryAsync(c => c.Id, c => c.Name, ct);

        var items = combo.Items.OrderBy(i => i.SortOrder).Select(i => new ComboItemDto(
            i.Id, i.MenuItemId,
            i.MenuItemId.HasValue && menuItemNames.TryGetValue(i.MenuItemId.Value, out var mn) ? mn : null,
            i.CategoryId,
            i.CategoryId.HasValue && categoryNames.TryGetValue(i.CategoryId.Value, out var cn) ? cn : null,
            i.Quantity, i.SortOrder)).ToList();

        return new ComboDto(combo.Id, combo.Name, combo.Price, combo.IsActive, items);
    }
}
