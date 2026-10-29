using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Inventory.Application.ProductTemplates;
using Softaxis.Inventory.Infrastructure.Persistence;

namespace Softaxis.Inventory.Infrastructure.Handlers.ProductTemplates;

internal static partial class CatalogueSeoRows
{
    [GeneratedRegex("<[^>]+>")] private static partial Regex Tags();
    [GeneratedRegex(@"\s+")] private static partial Regex Spaces();
    [GeneratedRegex(@"[\p{L}\p{N}]+")] private static partial Regex Words();

    public static async Task<List<CatalogueSeoRowDto>> LoadAsync(InventoryDbContext db, Guid? onlyId, int limit, CancellationToken ct)
    {
        var rows = await db.ProductTemplates.AsNoTracking()
            .Where(t => !t.IsDeleted && (onlyId == null || t.Id == onlyId))
            .OrderByDescending(t => t.PublishedOnline).ThenBy(t => t.Name)
            .Take(Math.Clamp(limit, 1, 1000))
            .Select(t => new
            {
                t.Id, t.Name, t.Slug, t.PublishedOnline, t.SeoTitle, t.MetaDescription, t.ShortDescription, t.Description,
                Category = t.Category != null ? t.Category.Name : "", Brand = t.Brand != null ? t.Brand.Name : null,
            }).ToListAsync(ct);

        var ids = rows.Select(r => r.Id).ToList();
        var images = await db.ProductImages.AsNoTracking().Where(i => ids.Contains(i.TemplateId))
            .GroupBy(i => i.TemplateId).Select(g => new { Id = g.Key, Count = g.Count(), NoAlt = g.Count(i => i.AltText == null || i.AltText == "") })
            .ToDictionaryAsync(x => x.Id, ct);

        return rows.Select(r =>
        {
            var plain = Spaces().Replace(Tags().Replace(r.Description ?? "", " "), " ").Trim();
            images.TryGetValue(r.Id, out var img);
            return new CatalogueSeoRowDto(r.Id, r.Name, r.Slug, r.Category, r.Brand, r.PublishedOnline, r.SeoTitle, r.MetaDescription, r.ShortDescription,
                plain.Length > 800 ? plain[..800] : plain, Words().Count(plain), img?.Count ?? 0, img?.NoAlt ?? 0);
        }).ToList();
    }
}

internal sealed class GetCatalogueSeoHandler(InventoryDbContext db) : IQueryHandler<GetCatalogueSeoQuery, IReadOnlyList<CatalogueSeoRowDto>>
{
    public async Task<Result<IReadOnlyList<CatalogueSeoRowDto>>> Handle(GetCatalogueSeoQuery q, CancellationToken ct) =>
        Result.Success<IReadOnlyList<CatalogueSeoRowDto>>(await CatalogueSeoRows.LoadAsync(db, null, q.Limit, ct));
}

internal sealed class SetTemplateSeoHandler(InventoryDbContext db) : ICommandHandler<SetTemplateSeoCommand, CatalogueSeoRowDto>
{
    public async Task<Result<CatalogueSeoRowDto>> Handle(SetTemplateSeoCommand cmd, CancellationToken ct)
    {
        var t = await db.ProductTemplates.FirstOrDefaultAsync(x => x.Id == cmd.TemplateId && !x.IsDeleted, ct);
        if (t is null) return Result.Failure<CatalogueSeoRowDto>(Error.Custom("ProductTemplate.NotFound", "That listing no longer exists."));

        t.UpdateContent(t.Name, t.Description, t.ShortDescription, t.CategoryId, t.BrandId, t.Slug,
            string.IsNullOrWhiteSpace(cmd.SeoTitle) ? t.SeoTitle : cmd.SeoTitle.Trim(),
            string.IsNullOrWhiteSpace(cmd.MetaDescription) ? t.MetaDescription : cmd.MetaDescription.Trim(), t.Tags);
        await db.SaveChangesAsync(ct);
        return Result.Success((await CatalogueSeoRows.LoadAsync(db, t.Id, 1, ct)).First());
    }
}
