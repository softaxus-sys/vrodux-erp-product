using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Inventory.Application.ProductTemplates;
using Softaxis.Inventory.Domain.Entities;
using Softaxis.Inventory.Infrastructure.Persistence;
using static Softaxis.Inventory.Infrastructure.Handlers.ProductTemplates.ProductTemplateSupport;

namespace Softaxis.Inventory.Infrastructure.Handlers.ProductTemplates;

/// <summary>
/// Stock-first listing: takes products that already exist and gives each its own online listing.
/// The listing copies the name, description, category and brand once; price, SKU and stock are never
/// copied — the product stays the single source of truth for them.
/// </summary>
internal sealed class ListProductsOnlineHandler(InventoryDbContext db)
    : ICommandHandler<ListProductsOnlineCommand, ListProductsOnlineResult>
{
    public async Task<Result<ListProductsOnlineResult>> Handle(ListProductsOnlineCommand cmd, CancellationToken ct)
    {
        var ids = cmd.ProductIds.Distinct().ToList();
        var products = await db.Products.Where(p => ids.Contains(p.Id) && !p.IsDeleted).ToListAsync(ct);

        var skipped = new List<ListOnlineSkipDto>();
        foreach (var id in ids.Where(id => products.All(p => p.Id != id)))
            skipped.Add(new ListOnlineSkipDto(id, "", "That stock item no longer exists."));

        var created = new List<(ProductTemplate Template, Product Product)>();
        var usedSlugs = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var p in products.OrderBy(p => p.Name))
        {
            if (p.TemplateId is not null) { skipped.Add(new(p.Id, p.Name, "Already in an online listing.")); continue; }
            if (!p.IsActive)              { skipped.Add(new(p.Id, p.Name, "The item is switched off.")); continue; }

            // A slug is claimed in the database only on save, so two items with the same name in one
            // request must be told apart here as well.
            var slug = await UniqueSlugAsync(db, null, p.Name, null, ct);
            var baseSlug = slug;
            for (var n = 2; !usedSlugs.Add(slug); n++) slug = $"{baseSlug}-{n}";

            var t = new ProductTemplate(p.Name, p.CategoryId, p.BrandId, slug);
            t.UpdateContent(p.Name, p.Description, null, p.CategoryId, p.BrandId, slug, null, null, null);
            db.ProductTemplates.Add(t);

            p.SetOnlineDetails(true, p.WeightGrams, p.LengthCm, p.WidthCm, p.HeightCm);
            p.JoinTemplate(t.Id, new Dictionary<string, string>());
            created.Add((t, p));
        }

        foreach (var (t, p) in created)
            await ImageStore.AdoptProductPhotosAsync(db, t.Id, [p.Id], ct);

        var published = 0;
        if (cmd.Publish)
        {
            foreach (var (t, p) in created)
            {
                var problems = PublishProblems(t, [p]);
                if (problems.Count == 0) { t.Publish(); published++; }
            }
        }

        if (created.Count > 0) await db.SaveChangesAsync(ct);

        return Result.Success(new ListProductsOnlineResult(
            created.Count, published,
            created.Select(c => new ListedProductDto(c.Product.Id, c.Template.Id, c.Template.PublishedOnline)).ToList(),
            skipped));
    }
}

internal sealed class GetUnlistedProductsHandler(InventoryDbContext db)
    : IQueryHandler<GetUnlistedProductsQuery, PagedResult<UnlistedProductDto>>
{
    public async Task<Result<PagedResult<UnlistedProductDto>>> Handle(GetUnlistedProductsQuery q, CancellationToken ct)
    {
        var page = Math.Max(1, q.Page);
        var size = Math.Clamp(q.PageSize, 1, 100);

        // The tenant filter replaces the entity's own soft-delete filter, so it is applied by hand.
        var query = db.Products.AsNoTracking().Where(p => !p.IsDeleted && p.IsActive && p.TemplateId == null);
        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var s = q.Search.Trim();
            query = query.Where(p => p.Name.Contains(s) || (p.SKU != null && p.SKU.Contains(s)) || (p.Barcode != null && p.Barcode.Contains(s)));
        }
        if (q.CategoryId is Guid cat) query = query.Where(p => p.CategoryId == cat);

        var total = await query.CountAsync(ct);
        var rows = await query.OrderBy(p => p.Name).Skip((page - 1) * size).Take(size)
            .Select(p => new { p.Id, p.Name, p.SKU, p.CategoryId, p.SalePrice, p.StockQuantity, p.IsActive })
            .ToListAsync(ct);

        var catIds = rows.Select(r => r.CategoryId).Distinct().ToList();
        var catNames = await db.ProductCategories.AsNoTracking().Where(c => catIds.Contains(c.Id))
            .ToDictionaryAsync(c => c.Id, c => c.Name, ct);

        var items = rows.Select(r => new UnlistedProductDto(
            r.Id, r.Name, r.SKU, catNames.GetValueOrDefault(r.CategoryId, ""), r.SalePrice, r.StockQuantity, r.IsActive)).ToList();
        return Result.Success(PagedResult<UnlistedProductDto>.Create(items, total, page, size));
    }
}

internal sealed class GetProductListingStatusHandler(InventoryDbContext db)
    : IQueryHandler<GetProductListingStatusQuery, IReadOnlyList<ProductListingStatusDto>>
{
    public async Task<Result<IReadOnlyList<ProductListingStatusDto>>> Handle(GetProductListingStatusQuery q, CancellationToken ct)
    {
        var ids = q.ProductIds.Distinct().Take(200).ToList();
        if (ids.Count == 0) return Result.Success<IReadOnlyList<ProductListingStatusDto>>([]);

        var rows = await db.Products.AsNoTracking()
            .Where(p => ids.Contains(p.Id) && p.TemplateId != null)
            .Join(db.ProductTemplates.AsNoTracking().Where(t => !t.IsDeleted),
                p => p.TemplateId, t => t.Id,
                (p, t) => new ProductListingStatusDto(p.Id, t.Id, t.PublishedOnline))
            .ToListAsync(ct);
        return Result.Success<IReadOnlyList<ProductListingStatusDto>>(rows);
    }
}
