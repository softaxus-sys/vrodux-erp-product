using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Application.Storage;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.BuildingBlocks.Infrastructure.Storage;
using Softaxis.Inventory.Application.ProductTemplates;
using Softaxis.Inventory.Domain.Entities;
using Softaxis.Inventory.Infrastructure.Persistence;
using static Softaxis.Inventory.Infrastructure.Handlers.ProductTemplates.ProductTemplateSupport;

namespace Softaxis.Inventory.Infrastructure.Handlers.ProductTemplates;

internal sealed class AddTemplateImagesHandler(
    InventoryDbContext db, IObjectStorage storage, IImageProcessor imageProcessor,
    ILogger<AddTemplateImagesHandler> logger)
    : ICommandHandler<AddTemplateImagesCommand, IReadOnlyList<ProductImageDto>>
{
    public async Task<Result<IReadOnlyList<ProductImageDto>>> Handle(AddTemplateImagesCommand cmd, CancellationToken ct)
    {
        static Result<IReadOnlyList<ProductImageDto>> Fail(string code, string message) =>
            Result.Failure<IReadOnlyList<ProductImageDto>>(Error.Custom(code, message));

        if (!await db.ProductTemplates.AnyAsync(t => t.Id == cmd.TemplateId, ct))
            return Fail("ProductTemplate.NotFound", "That listing no longer exists.");

        var existing = await db.ProductImages.Where(i => i.TemplateId == cmd.TemplateId).Select(i => i.SortOrder).ToListAsync(ct);
        if (existing.Count + cmd.Images.Count > AddTemplateImagesValidator.MaxImagesPerTemplate)
            return Fail("ProductTemplate.Conflict",
                $"A product can have up to {AddTemplateImagesValidator.MaxImagesPerTemplate} photos. Remove one before adding more.");

        // A photo can be tied to a variant of THIS listing only.
        var variantIds = cmd.Images.Where(i => i.ProductId != null).Select(i => i.ProductId!.Value).Distinct().ToList();
        if (variantIds.Count > 0)
        {
            var valid = await db.Products.Where(p => p.TemplateId == cmd.TemplateId && variantIds.Contains(p.Id)).CountAsync(ct);
            if (valid != variantIds.Count)
                return Fail("ProductTemplate.Invalid", "A photo was tied to a variant that is not part of this listing.");
        }

        // Falls back to the Data column when object storage is not configured — never blocks an upload.
        var tenantId = TenantAmbient.TenantId;
        var useStorage = storage.IsConfigured && tenantId is not null;

        var nextOrder = existing.Count == 0 ? 0 : existing.Max() + 1;
        var added = new List<ProductImage>();
        long committedInBatch = 0;

        foreach (var input in cmd.Images)
        {
            var label = input.FileName ?? "A photo";
            if (!TryParseDataUri(input.Data, out var bytes, out var contentType))
                return Fail("ProductTemplate.Invalid", $"'{label}' could not be read. Please choose the file again.");
            if (bytes.Length > AddTemplateImagesValidator.MaxBytesPerImage)
                return Fail("ProductTemplate.Invalid",
                    $"'{label}' is {bytes.Length / 1024 / 1024}MB. The limit is {AddTemplateImagesValidator.MaxBytesPerImage / 1024 / 1024}MB per photo.");

            var (storedBytes, storedContentType) = imageProcessor.IsCompressibleImage(contentType)
                ? imageProcessor.Compress(bytes, contentType)
                : (bytes, contentType);

            var image = new ProductImage(cmd.TemplateId, storedBytes, storedContentType, input.FileName, nextOrder++, input.ProductId);
            image.Describe(input.AltText, input.ProductId);
            // The first photo becomes the cover, so a listing with photos always has one to show.
            if (existing.Count == 0 && added.Count == 0) image.SetPrimary(true);

            if (useStorage)
            {
                var quota = await TenantStorageQuota.CheckAsync(
                    db.Database, tenantId!.Value, committedInBatch + storedBytes.LongLength, ct);
                if (!quota.Allowed)
                    return Fail("ProductTemplate.Conflict", TenantStorageQuota.QuotaErrorMessage(quota, input.FileName));

                var key = ImageKey(tenantId!.Value, cmd.TemplateId, image.Id);
                try
                {
                    await storage.PutAsync(key, storedBytes, storedContentType, ct);
                    image.SetObjectKey(key, storedContentType, storedBytes.LongLength);
                    committedInBatch += storedBytes.LongLength;
                }
                catch (Exception ex)
                {
                    // PutAsync throws by contract — the photo did not land anywhere, so say so rather
                    // than quietly storing it in the database instead.
                    logger.LogError(ex, "Product photo upload failed (key {Key}, listing {TemplateId})", key, cmd.TemplateId);
                    return Fail("ProductTemplate.ImageUploadFailed", $"'{label}' could not be uploaded. Please try again.");
                }
            }

            added.Add(image);
            db.ProductImages.Add(image);
        }

        await db.SaveChangesAsync(ct);
        return Result.Success<IReadOnlyList<ProductImageDto>>(added.Select(ToDto).ToList());
    }
}

internal sealed class DeleteTemplateImageHandler(InventoryDbContext db, IObjectStorage storage)
    : ICommandHandler<DeleteTemplateImageCommand>
{
    public async Task<Result> Handle(DeleteTemplateImageCommand cmd, CancellationToken ct)
    {
        var image = await db.ProductImages.FirstOrDefaultAsync(i => i.Id == cmd.ImageId && i.TemplateId == cmd.TemplateId, ct);
        if (image is null)
            return Result.Failure(Error.Custom("ProductTemplate.NotFound", "That photo no longer exists."));

        var wasPrimary = image.IsPrimary;
        var objectKey = image.ObjectKey;
        image.Delete();
        image.SetPrimary(false);

        // Removing the cover promotes the next photo, or the listing silently loses its picture everywhere.
        if (wasPrimary)
        {
            var next = await db.ProductImages
                .Where(i => i.TemplateId == cmd.TemplateId && i.Id != cmd.ImageId)
                .OrderBy(i => i.SortOrder).FirstOrDefaultAsync(ct);
            next?.SetPrimary(true);
        }

        await db.SaveChangesAsync(ct);
        // After the save: a slow or unreachable bucket must not block the delete.
        if (objectKey is not null) await storage.DeleteAsync(objectKey, ct);
        return Result.Success();
    }
}

internal sealed class SetPrimaryTemplateImageHandler(InventoryDbContext db)
    : ICommandHandler<SetPrimaryTemplateImageCommand>
{
    public async Task<Result> Handle(SetPrimaryTemplateImageCommand cmd, CancellationToken ct)
    {
        var images = await db.ProductImages.Where(i => i.TemplateId == cmd.TemplateId).ToListAsync(ct);
        if (images.All(i => i.Id != cmd.ImageId))
            return Result.Failure(Error.Custom("ProductTemplate.NotFound", "That photo no longer exists."));

        foreach (var image in images) image.SetPrimary(image.Id == cmd.ImageId);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class ReorderTemplateImagesHandler(InventoryDbContext db)
    : ICommandHandler<ReorderTemplateImagesCommand>
{
    public async Task<Result> Handle(ReorderTemplateImagesCommand cmd, CancellationToken ct)
    {
        var images = await db.ProductImages.Where(i => i.TemplateId == cmd.TemplateId).ToListAsync(ct);
        // An id that is not ours is ignored: a stale tab can send an order containing a photo someone
        // else has since deleted, and losing the whole reorder over that would be worse.
        for (var i = 0; i < cmd.OrderedIds.Count; i++)
            images.FirstOrDefault(img => img.Id == cmd.OrderedIds[i])?.SetSortOrder(i);

        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class UpdateTemplateImageHandler(InventoryDbContext db)
    : ICommandHandler<UpdateTemplateImageCommand>
{
    public async Task<Result> Handle(UpdateTemplateImageCommand cmd, CancellationToken ct)
    {
        var image = await db.ProductImages.FirstOrDefaultAsync(i => i.Id == cmd.ImageId && i.TemplateId == cmd.TemplateId, ct);
        if (image is null)
            return Result.Failure(Error.Custom("ProductTemplate.NotFound", "That photo no longer exists."));

        if (cmd.ProductId is Guid pid &&
            !await db.Products.AnyAsync(p => p.Id == pid && p.TemplateId == cmd.TemplateId, ct))
            return Result.Failure(Invalid("That variant is not part of this listing."));

        image.Describe(cmd.AltText, cmd.ProductId);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class GetTemplateImageHandler(InventoryDbContext db, IObjectStorage storage)
    : IQueryHandler<GetTemplateImageQuery, ProductImageFileDto>
{
    public async Task<Result<ProductImageFileDto>> Handle(GetTemplateImageQuery q, CancellationToken ct)
    {
        // The one place that selects Data — alongside ObjectKey, to know which holds the bytes.
        var row = await db.ProductImages.AsNoTracking()
            .Where(i => i.Id == q.ImageId && i.TemplateId == q.TemplateId)
            .Select(i => new { i.Data, i.ContentType, i.ObjectKey })
            .FirstOrDefaultAsync(ct);
        if (row is null)
            return Result.Failure<ProductImageFileDto>(Error.Custom("ProductTemplate.NotFound", "That photo no longer exists."));

        if (row.ObjectKey is not null)
        {
            var file = await storage.GetAsync(row.ObjectKey, ct);
            if (file is not null) return Result.Success(new ProductImageFileDto(file.Data, file.ContentType));
        }
        return Result.Success(new ProductImageFileDto(row.Data, row.ContentType));
    }
}
