using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Application.Storage;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Inventory.Application.ProductPhotos;
using Softaxis.Inventory.Application.ProductTemplates;
using Softaxis.Inventory.Domain.Entities;
using Softaxis.Inventory.Infrastructure.Handlers.ProductTemplates;
using Softaxis.Inventory.Infrastructure.Persistence;

namespace Softaxis.Inventory.Infrastructure.Handlers.ProductPhotos;

internal static class ProductPhotoSupport
{
    public static readonly Error ProductGone = Error.Custom("ProductPhoto.NotFound", "That stock item no longer exists.");
    public static readonly Error PhotoGone   = Error.Custom("ProductPhoto.NotFound", "That photo no longer exists.");

    /// <summary>The photos shown together with this one: its listing's gallery, or the item's own.</summary>
    public static IQueryable<ProductImage> Gallery(InventoryDbContext db, ProductImage image) =>
        image.TemplateId is Guid t
            ? db.ProductImages.Where(i => i.TemplateId == t)
            : db.ProductImages.Where(i => i.TemplateId == null && i.ProductId == image.ProductId);
}

internal sealed class GetProductPhotosHandler(InventoryDbContext db)
    : IQueryHandler<GetProductPhotosQuery, IReadOnlyList<ProductImageDto>>
{
    public async Task<Result<IReadOnlyList<ProductImageDto>>> Handle(GetProductPhotosQuery q, CancellationToken ct)
    {
        if (!await db.Products.AnyAsync(p => p.Id == q.ProductId && !p.IsDeleted, ct))
            return Result.Failure<IReadOnlyList<ProductImageDto>>(ProductPhotoSupport.ProductGone);

        var rows = await db.ProductImages.AsNoTracking().Where(i => i.ProductId == q.ProductId)
            .OrderByDescending(i => i.IsPrimary).ThenBy(i => i.SortOrder)
            .Select(i => new ProductImageDto(i.Id, i.ProductId, i.IsPrimary, i.SortOrder, i.FileName, i.AltText)).ToListAsync(ct);
        return Result.Success<IReadOnlyList<ProductImageDto>>(rows);
    }
}

internal sealed class GetProductPhotoHandler(InventoryDbContext db, IObjectStorage storage)
    : IQueryHandler<GetProductPhotoQuery, ProductImageFileDto>
{
    public async Task<Result<ProductImageFileDto>> Handle(GetProductPhotoQuery q, CancellationToken ct)
    {
        var row = await db.ProductImages.AsNoTracking()
            .Where(i => i.Id == q.ImageId && i.ProductId == q.ProductId)
            .Select(i => new { i.Data, i.ContentType, i.ObjectKey }).FirstOrDefaultAsync(ct);
        if (row is null) return Result.Failure<ProductImageFileDto>(ProductPhotoSupport.PhotoGone);

        if (row.ObjectKey is not null)
        {
            var file = await storage.GetAsync(row.ObjectKey, ct);
            if (file is not null) return Result.Success(new ProductImageFileDto(file.Data, file.ContentType));
        }
        return Result.Success(new ProductImageFileDto(row.Data, row.ContentType));
    }
}

internal sealed class AddProductPhotosHandler(
    InventoryDbContext db, IObjectStorage storage, IImageProcessor imageProcessor, ILogger<AddProductPhotosHandler> logger)
    : ICommandHandler<AddProductPhotosCommand, IReadOnlyList<ProductImageDto>>
{
    public async Task<Result<IReadOnlyList<ProductImageDto>>> Handle(AddProductPhotosCommand cmd, CancellationToken ct)
    {
        var product = await db.Products.AsNoTracking().Where(p => p.Id == cmd.ProductId && !p.IsDeleted)
            .Select(p => new { p.Id, p.TemplateId }).FirstOrDefaultAsync(ct);
        if (product is null) return Result.Failure<IReadOnlyList<ProductImageDto>>(ProductPhotoSupport.ProductGone);

        // In a listing the photo joins the listing's gallery (and its limit); otherwise it is the item's own.
        var scope = product.TemplateId is Guid t
            ? db.ProductImages.Where(i => i.TemplateId == t)
            : db.ProductImages.Where(i => i.TemplateId == null && i.ProductId == product.Id);
        var existing = await scope.Select(i => i.SortOrder).ToListAsync(ct);
        var limit = product.TemplateId is null ? AddProductPhotosValidator.MaxPerProduct : AddTemplateImagesValidator.MaxImagesPerTemplate;
        if (existing.Count + cmd.Images.Count > limit)
            return Result.Failure<IReadOnlyList<ProductImageDto>>(Error.Custom("ProductPhoto.Conflict",
                $"This item can have up to {limit} photos. Remove one before adding more."));

        var stored = await ImageStore.StoreAsync(db, storage, imageProcessor, logger, cmd.Images, product.TemplateId,
            _ => product.Id, existing.Count == 0 ? 0 : existing.Max() + 1, existing.Count == 0,
            product.TemplateId ?? product.Id, "ProductPhoto", ct);
        if (stored.IsFailure) return Result.Failure<IReadOnlyList<ProductImageDto>>(stored.Error);

        await db.SaveChangesAsync(ct);
        return Result.Success<IReadOnlyList<ProductImageDto>>(
            stored.Value.Select(i => new ProductImageDto(i.Id, i.ProductId, i.IsPrimary, i.SortOrder, i.FileName, i.AltText)).ToList());
    }
}

internal sealed class DeleteProductPhotoHandler(InventoryDbContext db, IObjectStorage storage)
    : ICommandHandler<DeleteProductPhotoCommand>
{
    public async Task<Result> Handle(DeleteProductPhotoCommand cmd, CancellationToken ct)
    {
        var image = await db.ProductImages.FirstOrDefaultAsync(i => i.Id == cmd.ImageId && i.ProductId == cmd.ProductId, ct);
        if (image is null) return Result.Failure(ProductPhotoSupport.PhotoGone);

        var wasPrimary = image.IsPrimary;
        var key = image.ObjectKey;
        var gallery = ProductPhotoSupport.Gallery(db, image);
        image.Delete();
        image.SetPrimary(false);

        // Removing the cover promotes the next photo, or the item silently loses its picture everywhere.
        if (wasPrimary)
            (await gallery.Where(i => i.Id != image.Id).OrderBy(i => i.SortOrder).FirstOrDefaultAsync(ct))?.SetPrimary(true);

        await db.SaveChangesAsync(ct);
        if (key is not null) await storage.DeleteAsync(key, ct);
        return Result.Success();
    }
}

internal sealed class SetPrimaryProductPhotoHandler(InventoryDbContext db) : ICommandHandler<SetPrimaryProductPhotoCommand>
{
    public async Task<Result> Handle(SetPrimaryProductPhotoCommand cmd, CancellationToken ct)
    {
        var image = await db.ProductImages.FirstOrDefaultAsync(i => i.Id == cmd.ImageId && i.ProductId == cmd.ProductId, ct);
        if (image is null) return Result.Failure(ProductPhotoSupport.PhotoGone);

        foreach (var i in await ProductPhotoSupport.Gallery(db, image).ToListAsync(ct)) i.SetPrimary(i.Id == image.Id);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class UpdateProductPhotoHandler(InventoryDbContext db) : ICommandHandler<UpdateProductPhotoCommand>
{
    public async Task<Result> Handle(UpdateProductPhotoCommand cmd, CancellationToken ct)
    {
        var image = await db.ProductImages.FirstOrDefaultAsync(i => i.Id == cmd.ImageId && i.ProductId == cmd.ProductId, ct);
        if (image is null) return Result.Failure(ProductPhotoSupport.PhotoGone);

        image.Describe(cmd.AltText, image.ProductId);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
