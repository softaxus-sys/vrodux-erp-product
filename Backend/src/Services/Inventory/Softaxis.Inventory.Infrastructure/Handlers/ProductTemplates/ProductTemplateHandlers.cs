using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Application.Storage;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Inventory.Application.ProductTemplates;
using Softaxis.Inventory.Domain.Entities;
using Softaxis.Inventory.Infrastructure.Persistence;
using static Softaxis.Inventory.Infrastructure.Handlers.ProductTemplates.ProductTemplateSupport;

namespace Softaxis.Inventory.Infrastructure.Handlers.ProductTemplates;

internal sealed class CreateProductTemplateHandler(InventoryDbContext db)
    : ICommandHandler<CreateProductTemplateCommand, ProductTemplateDto>
{
    public async Task<Result<ProductTemplateDto>> Handle(CreateProductTemplateCommand cmd, CancellationToken ct)
    {
        var c = cmd.Content;
        if (!await db.ProductCategories.AnyAsync(x => x.Id == c.CategoryId, ct))
            return Result.Failure<ProductTemplateDto>(Error.Custom("ProductTemplate.NotFound", "That category no longer exists."));
        if (c.BrandId is Guid brandId && !await db.Brands.AnyAsync(x => x.Id == brandId, ct))
            return Result.Failure<ProductTemplateDto>(Error.Custom("ProductTemplate.NotFound", "That brand no longer exists."));

        var options = NormaliseOptions(cmd.Options);
        if (options.IsFailure) return Result.Failure<ProductTemplateDto>(options.Error);

        var slug = await UniqueSlugAsync(db, c.Slug, c.Name, null, ct);
        var template = new ProductTemplate(c.Name, c.CategoryId, c.BrandId, slug);
        template.UpdateContent(c.Name, c.Description, c.ShortDescription, c.CategoryId, c.BrandId, slug, c.SeoTitle, c.MetaDescription, c.Tags);
        template.SetOptions(options.Value);

        var variants = await BuildVariantsAsync(db, template, options.Value, cmd.Variants, [], 0, ct);
        if (variants.IsFailure) return Result.Failure<ProductTemplateDto>(variants.Error);

        db.ProductTemplates.Add(template);
        await db.SaveChangesAsync(ct);
        return Result.Success(await LoadDtoAsync(db, template.Id, ct));
    }
}

internal sealed class UpdateProductTemplateHandler(InventoryDbContext db)
    : ICommandHandler<UpdateProductTemplateCommand, ProductTemplateDto>
{
    public async Task<Result<ProductTemplateDto>> Handle(UpdateProductTemplateCommand cmd, CancellationToken ct)
    {
        var t = await db.ProductTemplates.FirstOrDefaultAsync(x => x.Id == cmd.Id, ct);
        if (t is null) return Result.Failure<ProductTemplateDto>(NotFound);

        var c = cmd.Content;
        if (!await db.ProductCategories.AnyAsync(x => x.Id == c.CategoryId, ct))
            return Result.Failure<ProductTemplateDto>(Error.Custom("ProductTemplate.NotFound", "That category no longer exists."));
        if (c.BrandId is Guid brandId && !await db.Brands.AnyAsync(x => x.Id == brandId, ct))
            return Result.Failure<ProductTemplateDto>(Error.Custom("ProductTemplate.NotFound", "That brand no longer exists."));

        var options = NormaliseOptions(cmd.Options);
        if (options.IsFailure) return Result.Failure<ProductTemplateDto>(options.Error);

        // Every variant already in the listing must still be a valid choice. A value that is removed
        // while a variant uses it would leave that variant pointing at nothing, so say which one.
        var variants = await db.Products.Where(p => p.TemplateId == t.Id).ToListAsync(ct);
        var given = (cmd.VariantChoices ?? []).GroupBy(x => x.ProductId).ToDictionary(g => g.Key, g => g.Last().Options);
        if (given.Keys.Any(id => variants.All(v => v.Id != id)))
            return Result.Failure<ProductTemplateDto>(Invalid("A variant you changed is not part of this listing."));

        var seen = new HashSet<string>();
        foreach (var v in variants)
        {
            var choices = given.TryGetValue(v.Id, out var g) ? g : v.VariantOptions();
            var ok = CanonicalChoices(options.Value, choices, $"'{v.Name}'");
            if (ok.IsFailure) return Result.Failure<ProductTemplateDto>(ok.Error);
            if (!seen.Add(ProductTemplate.CombinationKey(ok.Value)))
                return Result.Failure<ProductTemplateDto>(Conflict($"'{v.Name}': {VariantLabel(ok.Value)} is already another variant."));
            v.JoinTemplate(t.Id, ok.Value);   // re-spelled exactly as the options spell them
        }
        // Variants collapse to one when there are no options at all.
        if (options.Value.Count == 0 && variants.Count > 1)
            return Result.Failure<ProductTemplateDto>(Invalid("Remove the extra variants before removing every option."));

        // A rename must not move the page: links, bookmarks and search engines already point at the old
        // address. The slug changes only when the caller asks for a different one.
        var slug = string.IsNullOrWhiteSpace(c.Slug)
            ? t.Slug
            : await UniqueSlugAsync(db, c.Slug, c.Name, t.Id, ct);
        t.UpdateContent(c.Name, c.Description, c.ShortDescription, c.CategoryId, c.BrandId, slug, c.SeoTitle, c.MetaDescription, c.Tags);
        t.SetOptions(options.Value);

        await db.SaveChangesAsync(ct);
        return Result.Success(await LoadDtoAsync(db, t.Id, ct));
    }
}

internal sealed class AddTemplateVariantsHandler(InventoryDbContext db)
    : ICommandHandler<AddTemplateVariantsCommand, ProductTemplateDto>
{
    public async Task<Result<ProductTemplateDto>> Handle(AddTemplateVariantsCommand cmd, CancellationToken ct)
    {
        var t = await db.ProductTemplates.FirstOrDefaultAsync(x => x.Id == cmd.TemplateId, ct);
        if (t is null) return Result.Failure<ProductTemplateDto>(NotFound);

        var existing = await db.Products.Where(p => p.TemplateId == t.Id).ToListAsync(ct);
        var made = await BuildVariantsAsync(db, t, t.Options, cmd.Variants, CombinationKeys(existing), existing.Count, ct);
        if (made.IsFailure) return Result.Failure<ProductTemplateDto>(made.Error);

        await db.SaveChangesAsync(ct);
        return Result.Success(await LoadDtoAsync(db, t.Id, ct));
    }
}

internal sealed class UpdateTemplateVariantHandler(InventoryDbContext db)
    : ICommandHandler<UpdateTemplateVariantCommand, ProductTemplateDto>
{
    public async Task<Result<ProductTemplateDto>> Handle(UpdateTemplateVariantCommand cmd, CancellationToken ct)
    {
        var t = await db.ProductTemplates.AsNoTracking().FirstOrDefaultAsync(x => x.Id == cmd.TemplateId, ct);
        if (t is null) return Result.Failure<ProductTemplateDto>(NotFound);

        var variants = await db.Products.Where(p => p.TemplateId == t.Id).ToListAsync(ct);
        var product = variants.FirstOrDefault(p => p.Id == cmd.ProductId);
        if (product is null)
            return Result.Failure<ProductTemplateDto>(Error.Custom("ProductTemplate.NotFound", "That variant is not part of this listing."));

        var choices = CanonicalChoices(t.Options, cmd.Options, $"'{product.Name}'");
        if (choices.IsFailure) return Result.Failure<ProductTemplateDto>(choices.Error);

        var key = Softaxis.Inventory.Domain.Entities.ProductTemplate.CombinationKey(choices.Value);
        if (variants.Any(v => v.Id != product.Id &&
                Softaxis.Inventory.Domain.Entities.ProductTemplate.CombinationKey(v.VariantOptions()) == key))
            return Result.Failure<ProductTemplateDto>(Conflict($"Another variant is already {VariantLabel(choices.Value)}."));

        product.JoinTemplate(t.Id, choices.Value);
        product.SetOnlineDetails(cmd.SellOnline, cmd.WeightGrams, cmd.LengthCm, cmd.WidthCm, cmd.HeightCm);

        await db.SaveChangesAsync(ct);
        return Result.Success(await LoadDtoAsync(db, t.Id, ct));
    }
}

internal sealed class RemoveTemplateVariantHandler(InventoryDbContext db)
    : ICommandHandler<RemoveTemplateVariantCommand, ProductTemplateDto>
{
    public async Task<Result<ProductTemplateDto>> Handle(RemoveTemplateVariantCommand cmd, CancellationToken ct)
    {
        var t = await db.ProductTemplates.FirstOrDefaultAsync(x => x.Id == cmd.TemplateId, ct);
        if (t is null) return Result.Failure<ProductTemplateDto>(NotFound);

        var product = await db.Products.FirstOrDefaultAsync(p => p.Id == cmd.ProductId && p.TemplateId == t.Id, ct);
        if (product is null)
            return Result.Failure<ProductTemplateDto>(Error.Custom("ProductTemplate.NotFound", "That variant is not part of this listing."));

        product.LeaveTemplate();

        // Photos assigned to that variant fall back to the whole listing, never into a dangling reference.
        var photos = await db.ProductImages.Where(i => i.ProductId == product.Id).ToListAsync(ct);
        foreach (var p in photos) p.Describe(p.AltText, null);

        // A live listing cannot be left with nothing to sell.
        if (t.PublishedOnline)
        {
            var left = await db.Products.Where(p => p.TemplateId == t.Id && p.Id != product.Id && p.IsActive && p.SellOnline).AnyAsync(ct);
            if (!left) t.Unpublish();
        }

        await db.SaveChangesAsync(ct);
        return Result.Success(await LoadDtoAsync(db, t.Id, ct));
    }
}

internal sealed class SetTemplatePublishedHandler(InventoryDbContext db)
    : ICommandHandler<SetTemplatePublishedCommand, ProductTemplateDto>
{
    public async Task<Result<ProductTemplateDto>> Handle(SetTemplatePublishedCommand cmd, CancellationToken ct)
    {
        var t = await db.ProductTemplates.FirstOrDefaultAsync(x => x.Id == cmd.Id, ct);
        if (t is null) return Result.Failure<ProductTemplateDto>(NotFound);

        if (cmd.Published)
        {
            var variants = await db.Products.AsNoTracking().Where(p => p.TemplateId == t.Id).ToListAsync(ct);
            var problems = PublishProblems(t, variants);
            if (problems.Count > 0)
                return Result.Failure<ProductTemplateDto>(Invalid("Not ready to publish: " + string.Join(" ", problems)));
            t.Publish();
        }
        else t.Unpublish();

        await db.SaveChangesAsync(ct);
        return Result.Success(await LoadDtoAsync(db, t.Id, ct));
    }
}

internal sealed class DeleteProductTemplateHandler(InventoryDbContext db, IObjectStorage storage)
    : ICommandHandler<DeleteProductTemplateCommand>
{
    public async Task<Result> Handle(DeleteProductTemplateCommand cmd, CancellationToken ct)
    {
        var t = await db.ProductTemplates.FirstOrDefaultAsync(x => x.Id == cmd.Id, ct);
        if (t is null) return Result.Failure(NotFound);

        // The products stay: they carry SKUs, stock and sales history that deleting a web page must not touch.
        foreach (var p in await db.Products.Where(p => p.TemplateId == t.Id).ToListAsync(ct)) p.LeaveTemplate();

        var images = await db.ProductImages.Where(i => i.TemplateId == t.Id).ToListAsync(ct);
        var keys = images.Where(i => i.ObjectKey != null).Select(i => i.ObjectKey!).ToList();
        foreach (var i in images) i.Delete();

        t.Delete();
        await db.SaveChangesAsync(ct);

        // After the save: a slow or unreachable bucket must not block the delete (best-effort by contract).
        foreach (var key in keys) await storage.DeleteAsync(key, ct);
        return Result.Success();
    }
}

// ── Queries ──────────────────────────────────────────────────────────────────

internal sealed class GetProductTemplatesHandler(InventoryDbContext db)
    : IQueryHandler<GetProductTemplatesQuery, PagedResult<ProductTemplateSummaryDto>>
{
    public async Task<Result<PagedResult<ProductTemplateSummaryDto>>> Handle(GetProductTemplatesQuery q, CancellationToken ct)
    {
        var page = Math.Max(1, q.Page);
        var size = Math.Clamp(q.PageSize, 1, 100);

        var query = db.ProductTemplates.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var s = q.Search.Trim();
            query = query.Where(t => t.Name.Contains(s) || t.Slug.Contains(s) || (t.Tags != null && t.Tags.Contains(s))
                || db.Products.Any(p => p.TemplateId == t.Id && (p.SKU != null && p.SKU.Contains(s))));
        }
        if (q.CategoryId is Guid cat) query = query.Where(t => t.CategoryId == cat);
        if (q.PublishedOnline is bool pub) query = query.Where(t => t.PublishedOnline == pub);

        var total = await query.CountAsync(ct);
        var rows = await query.OrderBy(t => t.Name).Skip((page - 1) * size).Take(size).ToListAsync(ct);
        var ids = rows.Select(r => r.Id).ToList();

        var cats = rows.Select(r => r.CategoryId).Distinct().ToList();
        var catNames = await db.ProductCategories.AsNoTracking().Where(c => cats.Contains(c.Id)).ToDictionaryAsync(c => c.Id, c => c.Name, ct);
        var brandIds = rows.Where(r => r.BrandId != null).Select(r => r.BrandId!.Value).Distinct().ToList();
        var brandNames = await db.Brands.AsNoTracking().Where(b => brandIds.Contains(b.Id)).ToDictionaryAsync(b => b.Id, b => b.Name, ct);

        var variantStats = (await db.Products.AsNoTracking()
                .Where(p => p.TemplateId != null && ids.Contains(p.TemplateId!.Value))
                .Select(p => new { TemplateId = p.TemplateId!.Value, p.StockQuantity, p.SalePrice, p.IsActive, p.SellOnline })
                .ToListAsync(ct))
            .GroupBy(v => v.TemplateId)
            .ToDictionary(g => g.Key, g => g.ToList());

        var covers = (await db.ProductImages.AsNoTracking()
                .Where(i => ids.Contains(i.TemplateId))
                .Select(i => new { i.TemplateId, i.Id, i.IsPrimary, i.SortOrder })
                .ToListAsync(ct))
            .GroupBy(i => i.TemplateId)
            .ToDictionary(g => g.Key, g => (Count: g.Count(), Cover: g.OrderByDescending(i => i.IsPrimary).ThenBy(i => i.SortOrder).First().Id));

        var items = rows.Select(r =>
        {
            variantStats.TryGetValue(r.Id, out var vs);
            vs ??= [];
            var priced = vs.Where(v => v.IsActive && v.SellOnline).Select(v => v.SalePrice).ToList();
            covers.TryGetValue(r.Id, out var img);
            return new ProductTemplateSummaryDto(
                r.Id, r.Name, r.Slug, r.CategoryId, catNames.GetValueOrDefault(r.CategoryId, ""),
                r.BrandId is Guid b ? brandNames.GetValueOrDefault(b) : null,
                r.PublishedOnline, r.IsActive, vs.Count, vs.Sum(v => v.StockQuantity),
                priced.Count == 0 ? null : priced.Min(), priced.Count == 0 ? null : priced.Max(),
                img.Count == 0 ? null : img.Cover, img.Count, r.CreatedAt, r.UpdatedAt);
        }).ToList();

        return Result.Success(PagedResult<ProductTemplateSummaryDto>.Create(items, total, page, size));
    }
}

internal sealed class GetProductTemplateByIdHandler(InventoryDbContext db)
    : IQueryHandler<GetProductTemplateByIdQuery, ProductTemplateDto>
{
    public async Task<Result<ProductTemplateDto>> Handle(GetProductTemplateByIdQuery q, CancellationToken ct) =>
        await db.ProductTemplates.AnyAsync(t => t.Id == q.Id, ct)
            ? Result.Success(await LoadDtoAsync(db, q.Id, ct))
            : Result.Failure<ProductTemplateDto>(NotFound);
}

internal sealed class GetPublishCheckHandler(InventoryDbContext db)
    : IQueryHandler<GetPublishCheckQuery, PublishCheckDto>
{
    public async Task<Result<PublishCheckDto>> Handle(GetPublishCheckQuery q, CancellationToken ct)
    {
        var t = await db.ProductTemplates.AsNoTracking().FirstOrDefaultAsync(x => x.Id == q.Id, ct);
        if (t is null) return Result.Failure<PublishCheckDto>(NotFound);
        var variants = await db.Products.AsNoTracking().Where(p => p.TemplateId == t.Id).ToListAsync(ct);
        var problems = PublishProblems(t, variants);
        return Result.Success(new PublishCheckDto(problems.Count == 0, problems));
    }
}
