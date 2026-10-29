using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Inventory.Application.ProductTemplates;
using Softaxis.Inventory.Application.Storefront;
using Softaxis.Inventory.Infrastructure.Persistence;

namespace Softaxis.Inventory.Infrastructure.Handlers.Storefront;

/// <summary>
/// The read side an online store uses. A listing is on sale only when it is published, active, not deleted, and has a
/// variant that is active and switched on for online sale — the same test everywhere, so a card, a product page and
/// the checkout can never disagree about whether something may be bought.
/// </summary>
internal static class StorefrontScope
{
    public static IQueryable<Softaxis.Inventory.Domain.Entities.ProductTemplate> OnSale(InventoryDbContext db) =>
        db.ProductTemplates.AsNoTracking()
            .Where(t => !t.IsDeleted && t.PublishedOnline && t.IsActive
                && db.Products.Any(p => p.TemplateId == t.Id && !p.IsDeleted && p.IsActive && p.SellOnline));

    public static bool CanBuy(decimal stock, bool track) => !track || stock > 0;
}

internal sealed class GetStorefrontProductsHandler(InventoryDbContext db)
    : IQueryHandler<GetStorefrontProductsQuery, PagedResult<StorefrontCardDto>>
{
    public async Task<Result<PagedResult<StorefrontCardDto>>> Handle(GetStorefrontProductsQuery q, CancellationToken ct)
    {
        var page = Math.Max(1, q.Page);
        var size = Math.Clamp(q.PageSize, 1, 60);

        var query = StorefrontScope.OnSale(db);

        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var s = q.Search.Trim();
            query = query.Where(t => t.Name.Contains(s) || (t.Tags != null && t.Tags.Contains(s))
                || (t.ShortDescription != null && t.ShortDescription.Contains(s)));
        }
        if (!string.IsNullOrWhiteSpace(q.CategoryName))
        {
            var cat = q.CategoryName.Trim();
            query = query.Where(t => db.ProductCategories.Any(c => c.Id == t.CategoryId && c.Name == cat));
        }
        if (q.TemplateIds is { Count: > 0 } ids)
            query = query.Where(t => ids.Contains(t.Id));

        var total = await query.CountAsync(ct);

        query = q.Sort switch
        {
            "name"       => query.OrderBy(t => t.Name),
            "price_asc"  => query.OrderBy(t => db.Products.Where(p => p.TemplateId == t.Id && !p.IsDeleted && p.IsActive && p.SellOnline).Min(p => (decimal?)p.SalePrice)).ThenBy(t => t.Name),
            "price_desc" => query.OrderByDescending(t => db.Products.Where(p => p.TemplateId == t.Id && !p.IsDeleted && p.IsActive && p.SellOnline).Min(p => (decimal?)p.SalePrice)).ThenBy(t => t.Name),
            _            => query.OrderByDescending(t => t.PublishedAt ?? t.CreatedAt).ThenBy(t => t.Name),
        };

        var rows = await query.Skip((page - 1) * size).Take(size).ToListAsync(ct);
        return Result.Success(PagedResult<StorefrontCardDto>.Create(await ToCardsAsync(db, rows, ct), total, page, size));
    }

    internal static async Task<List<StorefrontCardDto>> ToCardsAsync(
        InventoryDbContext db, List<Softaxis.Inventory.Domain.Entities.ProductTemplate> rows, CancellationToken ct)
    {
        var ids = rows.Select(r => r.Id).ToList();
        var catIds = rows.Select(r => r.CategoryId).Distinct().ToList();
        var cats = await db.ProductCategories.AsNoTracking().Where(c => catIds.Contains(c.Id)).ToDictionaryAsync(c => c.Id, c => c.Name, ct);
        var brandIds = rows.Where(r => r.BrandId != null).Select(r => r.BrandId!.Value).Distinct().ToList();
        var brands = await db.Brands.AsNoTracking().Where(b => brandIds.Contains(b.Id)).ToDictionaryAsync(b => b.Id, b => b.Name, ct);

        var variants = (await db.Products.AsNoTracking()
                .Where(p => p.TemplateId != null && ids.Contains(p.TemplateId!.Value) && !p.IsDeleted && p.IsActive && p.SellOnline)
                .Select(p => new { TemplateId = p.TemplateId!.Value, p.SalePrice, p.StockQuantity, p.TrackInventory })
                .ToListAsync(ct))
            .GroupBy(v => v.TemplateId).ToDictionary(g => g.Key, g => g.ToList());

        var covers = (await db.ProductImages.AsNoTracking()
                .Where(i => ids.Contains(i.TemplateId))
                .Select(i => new { i.TemplateId, i.Id, i.IsPrimary, i.SortOrder })
                .ToListAsync(ct))
            .GroupBy(i => i.TemplateId)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(i => i.IsPrimary).ThenBy(i => i.SortOrder).First().Id);

        return rows.Select(r =>
        {
            var vs = variants.GetValueOrDefault(r.Id) ?? [];
            return new StorefrontCardDto(
                r.Id, r.Name, r.Slug, r.ShortDescription, cats.GetValueOrDefault(r.CategoryId, ""),
                r.BrandId is Guid b ? brands.GetValueOrDefault(b) : null,
                vs.Count == 0 ? 0 : vs.Min(v => v.SalePrice), vs.Count == 0 ? 0 : vs.Max(v => v.SalePrice),
                covers.TryGetValue(r.Id, out var c) ? c : null,
                vs.Any(v => StorefrontScope.CanBuy(v.StockQuantity, v.TrackInventory)), r.PublishedAt);
        }).ToList();
    }
}

internal sealed class GetStorefrontProductHandler(InventoryDbContext db)
    : IQueryHandler<GetStorefrontProductQuery, StorefrontProductDto>
{
    public async Task<Result<StorefrontProductDto>> Handle(GetStorefrontProductQuery q, CancellationToken ct)
    {
        var slug = (q.Slug ?? "").Trim().ToLowerInvariant();
        var t = await StorefrontScope.OnSale(db).FirstOrDefaultAsync(x => x.Slug == slug, ct);
        if (t is null) return Result.Failure<StorefrontProductDto>(Error.Custom("Product.NotFound", "That product is not available."));

        var category = await db.ProductCategories.AsNoTracking().Where(c => c.Id == t.CategoryId).Select(c => c.Name).FirstOrDefaultAsync(ct) ?? "";
        var brand = t.BrandId is Guid b ? await db.Brands.AsNoTracking().Where(x => x.Id == b).Select(x => x.Name).FirstOrDefaultAsync(ct) : null;

        var products = await db.Products.AsNoTracking()
            .Where(p => p.TemplateId == t.Id && !p.IsDeleted && p.IsActive && p.SellOnline)
            .OrderBy(p => p.Name).ToListAsync(ct);
        var images = await db.ProductImages.AsNoTracking().Where(i => i.TemplateId == t.Id)
            .OrderByDescending(i => i.IsPrimary).ThenBy(i => i.SortOrder)
            .Select(i => new StorefrontImageDto(i.Id, i.ProductId, i.AltText)).ToListAsync(ct);

        return Result.Success(new StorefrontProductDto(
            t.Id, t.Name, t.Slug, t.Description, t.ShortDescription, category, brand, t.SeoTitle, t.MetaDescription, t.Tags,
            t.Options.Select(o => new ProductOptionDto(o.Name, o.Values)).ToList(),
            products.Select(p => new StorefrontVariantDto(p.Id, p.Name, p.SKU, p.VariantOptions(), p.SalePrice, p.TaxRate, p.StockQuantity, p.TrackInventory)).ToList(),
            images));
    }
}

internal sealed class GetStorefrontCategoriesHandler(InventoryDbContext db)
    : IQueryHandler<GetStorefrontCategoriesQuery, IReadOnlyList<StorefrontCategoryDto>>
{
    public async Task<Result<IReadOnlyList<StorefrontCategoryDto>>> Handle(GetStorefrontCategoriesQuery q, CancellationToken ct)
    {
        var rows = await StorefrontScope.OnSale(db).Select(t => t.CategoryId).ToListAsync(ct);
        var ids = rows.Distinct().ToList();
        var names = await db.ProductCategories.AsNoTracking().Where(c => ids.Contains(c.Id)).ToDictionaryAsync(c => c.Id, c => c.Name, ct);
        IReadOnlyList<StorefrontCategoryDto> result = rows.GroupBy(id => names.GetValueOrDefault(id, ""))
            .Where(g => g.Key.Length > 0).Select(g => new StorefrontCategoryDto(g.Key, g.Count())).OrderBy(c => c.Name).ToList();
        return Result.Success(result);
    }
}

internal sealed class GetStorefrontCheckoutVariantsHandler(InventoryDbContext db)
    : IQueryHandler<GetStorefrontCheckoutVariantsQuery, IReadOnlyList<StorefrontCheckoutVariantDto>>
{
    public async Task<Result<IReadOnlyList<StorefrontCheckoutVariantDto>>> Handle(GetStorefrontCheckoutVariantsQuery q, CancellationToken ct)
    {
        var ids = q.ProductIds.Distinct().Take(200).ToList();
        var products = await db.Products.AsNoTracking()
            .Where(p => ids.Contains(p.Id) && !p.IsDeleted && p.TemplateId != null).ToListAsync(ct);

        var templateIds = products.Select(p => p.TemplateId!.Value).Distinct().ToList();
        var templates = await db.ProductTemplates.AsNoTracking()
            .Where(t => templateIds.Contains(t.Id) && !t.IsDeleted).ToDictionaryAsync(t => t.Id, ct);
        var covers = (await db.ProductImages.AsNoTracking()
                .Where(i => templateIds.Contains(i.TemplateId))
                .Select(i => new { i.TemplateId, i.Id, i.IsPrimary, i.SortOrder }).ToListAsync(ct))
            .GroupBy(i => i.TemplateId)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(i => i.IsPrimary).ThenBy(i => i.SortOrder).First().Id);

        IReadOnlyList<StorefrontCheckoutVariantDto> result = products
            .Where(p => templates.ContainsKey(p.TemplateId!.Value))
            .Select(p =>
            {
                var t = templates[p.TemplateId!.Value];
                var available = t.PublishedOnline && t.IsActive && p.IsActive && p.SellOnline;
                return new StorefrontCheckoutVariantDto(
                    p.Id, t.Id, t.Name, t.Slug, p.Name, p.SKU, p.SalePrice, p.TaxRate, p.StockQuantity, p.TrackInventory,
                    available, covers.TryGetValue(t.Id, out var c) ? c : null, p.WeightGrams);
            }).ToList();
        return Result.Success(result);
    }
}
