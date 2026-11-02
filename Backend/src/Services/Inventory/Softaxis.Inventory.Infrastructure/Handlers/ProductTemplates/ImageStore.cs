using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Application.Storage;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.BuildingBlocks.Infrastructure.Storage;
using Softaxis.Inventory.Application.ProductTemplates;
using Softaxis.Inventory.Domain.Entities;
using Softaxis.Inventory.Infrastructure.Persistence;
using static Softaxis.Inventory.Infrastructure.Handlers.ProductTemplates.ProductTemplateSupport;

namespace Softaxis.Inventory.Infrastructure.Handlers.ProductTemplates;

/// <summary>
/// Decodes, compresses, checks the storage quota for and stores uploaded photos. One place, so a photo
/// added to a listing and a photo added to a stock item obey exactly the same rules.
/// </summary>
internal static class ImageStore
{
    public static async Task<Result<List<ProductImage>>> StoreAsync(
        InventoryDbContext db, IObjectStorage storage, IImageProcessor imageProcessor, ILogger logger,
        IReadOnlyList<ProductImageInput> inputs, Guid? templateId, Func<ProductImageInput, Guid?> productIdOf,
        int firstSortOrder, bool firstBecomesCover, Guid keyScopeId, string failCodePrefix, CancellationToken ct)
    {
        static Result<List<ProductImage>> Fail(string code, string message) =>
            Result.Failure<List<ProductImage>>(Error.Custom(code, message));

        // Falls back to the Data column when object storage is not configured — never blocks an upload.
        var tenantId = TenantAmbient.TenantId;
        var useStorage = storage.IsConfigured && tenantId is not null;

        var nextOrder = firstSortOrder;
        var added = new List<ProductImage>();
        long committedInBatch = 0;

        foreach (var input in inputs)
        {
            var label = input.FileName ?? "A photo";
            if (!TryParseDataUri(input.Data, out var bytes, out var contentType))
                return Fail($"{failCodePrefix}.Invalid", $"'{label}' could not be read. Please choose the file again.");
            if (bytes.Length > AddTemplateImagesValidator.MaxBytesPerImage)
                return Fail($"{failCodePrefix}.Invalid",
                    $"'{label}' is {bytes.Length / 1024 / 1024}MB. The limit is {AddTemplateImagesValidator.MaxBytesPerImage / 1024 / 1024}MB per photo.");

            var (storedBytes, storedContentType) = imageProcessor.IsCompressibleImage(contentType)
                ? imageProcessor.Compress(bytes, contentType)
                : (bytes, contentType);

            var productId = productIdOf(input);
            var image = new ProductImage(templateId, storedBytes, storedContentType, input.FileName, nextOrder++, productId);
            image.Describe(input.AltText, productId);
            // The first photo becomes the cover, so a gallery with photos always has one to show.
            if (firstBecomesCover && added.Count == 0) image.SetPrimary(true);

            if (useStorage)
            {
                var quota = await TenantStorageQuota.CheckAsync(
                    db.Database, tenantId!.Value, committedInBatch + storedBytes.LongLength, ct);
                if (!quota.Allowed)
                    return Fail($"{failCodePrefix}.Conflict", TenantStorageQuota.QuotaErrorMessage(quota, input.FileName));

                var key = ImageKey(tenantId!.Value, keyScopeId, image.Id);
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
                    logger.LogError(ex, "Photo upload failed (key {Key}, scope {Scope})", key, keyScopeId);
                    return Fail($"{failCodePrefix}.ImageUploadFailed", $"'{label}' could not be uploaded. Please try again.");
                }
            }

            added.Add(image);
            db.ProductImages.Add(image);
        }
        return Result.Success(added);
    }

    /// <summary>
    /// A stock item joined a listing: the photos it already has are shown by the listing too. They are
    /// the same rows, not copies, so a photo is stored and paid for once. Nothing is saved here.
    /// </summary>
    public static async Task AdoptProductPhotosAsync(
        InventoryDbContext db, Guid templateId, IReadOnlyCollection<Guid> productIds, CancellationToken ct)
    {
        if (productIds.Count == 0) return;
        var owned = await db.ProductImages
            .Where(i => i.TemplateId == null && i.ProductId != null && productIds.Contains(i.ProductId.Value))
            .OrderByDescending(i => i.IsPrimary).ThenBy(i => i.SortOrder).ToListAsync(ct);
        if (owned.Count == 0) return;

        var inTemplate = await db.ProductImages.Where(i => i.TemplateId == templateId)
            .Select(i => new { i.SortOrder, i.IsPrimary }).ToListAsync(ct);
        var room = Math.Max(0, AddTemplateImagesValidator.MaxImagesPerTemplate - inTemplate.Count);
        var next = inTemplate.Count == 0 ? 0 : inTemplate.Max(i => i.SortOrder) + 1;
        var hasCover = inTemplate.Any(i => i.IsPrimary);

        // Over the limit the extra photos simply stay with the stock item, which still owns them.
        foreach (var image in owned.Take(room))
        {
            var cover = !hasCover;
            image.AdoptInto(templateId, next++);
            if (cover) { image.SetPrimary(true); hasCover = true; }
        }
    }

    /// <summary>Makes sure a listing that still has photos has a cover.</summary>
    public static async Task EnsureCoverAsync(InventoryDbContext db, Guid templateId, CancellationToken ct)
    {
        var images = await db.ProductImages.Where(i => i.TemplateId == templateId).OrderBy(i => i.SortOrder).ToListAsync(ct);
        if (images.Count > 0 && images.All(i => !i.IsPrimary)) images[0].SetPrimary(true);
    }
}
