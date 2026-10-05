using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Application.Storage;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.BuildingBlocks.Infrastructure.Storage;
using Softaxis.Restaurant.Application.Menu.Commands;
using Softaxis.Restaurant.Application.Menu.Dtos;
using Softaxis.Restaurant.Application.Menu.Queries;
using Softaxis.Restaurant.Domain.Entities;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.Menu;

internal static class MenuItemImages
{
    public static string BuildKey(Guid tenantId, Guid menuItemId, Guid imageId) =>
        $"restaurant/{tenantId:N}/menu/{menuItemId:N}/{imageId:N}";

    public static MenuItemImageDto ToDto(MenuItemImage i) => new(i.Id, i.IsPrimary, i.SortOrder, i.FileName);

    /// <summary>Photo metadata for a whole batch of dishes in one query — never the bytes, and never
    /// one query per dish. Cover first, then upload order.</summary>
    public static async Task<Dictionary<Guid, List<MenuItemImageDto>>> ForItemsAsync(
        RestaurantDbContext db, IReadOnlyCollection<Guid> itemIds, CancellationToken ct)
    {
        if (itemIds.Count == 0) return [];
        var rows = await db.MenuItemImages.AsNoTracking()
            .Where(i => itemIds.Contains(i.MenuItemId) && !i.IsDeleted)
            .Select(i => new { i.Id, i.MenuItemId, i.IsPrimary, i.SortOrder, i.FileName })
            .ToListAsync(ct);
        return rows.GroupBy(r => r.MenuItemId).ToDictionary(
            g => g.Key,
            g => g.OrderByDescending(r => r.IsPrimary).ThenBy(r => r.SortOrder)
                  .Select(r => new MenuItemImageDto(r.Id, r.IsPrimary, r.SortOrder, r.FileName)).ToList());
    }

    /// <summary>Returns false rather than throwing: a truncated upload is a client error to report.</summary>
    public static bool TryParseDataUri(string value, out byte[] bytes, out string contentType)
    {
        bytes = []; contentType = "image/jpeg";
        var comma = value.IndexOf(',');
        if (comma < 0 || !value.StartsWith("data:", StringComparison.OrdinalIgnoreCase)) return false;
        var header = value[5..comma];
        if (!header.Contains("base64", StringComparison.OrdinalIgnoreCase)) return false;
        var semi = header.IndexOf(';');
        if (semi > 0) contentType = header[..semi];
        try { bytes = Convert.FromBase64String(value[(comma + 1)..]); return bytes.Length > 0; }
        catch (FormatException) { return false; }
    }
}

internal sealed class AddMenuItemImagesHandler(
    RestaurantDbContext db, IObjectStorage storage, IImageProcessor imageProcessor,
    ILogger<AddMenuItemImagesHandler> logger)
    : ICommandHandler<AddMenuItemImagesCommand, IReadOnlyList<MenuItemImageDto>>
{
    public async Task<Result<IReadOnlyList<MenuItemImageDto>>> Handle(AddMenuItemImagesCommand cmd, CancellationToken ct)
    {
        static Result<IReadOnlyList<MenuItemImageDto>> Fail(string code, string message) =>
            Result.Failure<IReadOnlyList<MenuItemImageDto>>(Error.Custom(code, message));

        var itemExists = await db.MenuItems.AnyAsync(i => i.Id == cmd.MenuItemId && !i.IsDeleted, ct);
        if (!itemExists) return Fail("MenuItem.NotFound", "That dish no longer exists.");

        var existingOrders = await db.MenuItemImages
            .Where(i => i.MenuItemId == cmd.MenuItemId && !i.IsDeleted)
            .Select(i => i.SortOrder)
            .ToListAsync(ct);
        if (existingOrders.Count + cmd.Images.Count > AddMenuItemImagesValidator.MaxImagesPerItem)
            return Fail("MenuItem.Conflict",
                $"A dish can have up to {AddMenuItemImagesValidator.MaxImagesPerItem} photos. Remove one before adding more.");

        // Falls back to the Data column when object storage is not configured — never blocks an upload.
        var tenantId = TenantAmbient.TenantId;
        var useStorage = storage.IsConfigured && tenantId is not null;

        var nextOrder = existingOrders.Count == 0 ? 0 : existingOrders.Max() + 1;
        var added = new List<MenuItemImage>();
        long committedInBatch = 0;

        foreach (var input in cmd.Images)
        {
            var label = input.FileName ?? "A photo";
            if (!MenuItemImages.TryParseDataUri(input.Data, out var bytes, out var contentType))
                return Fail("MenuItem.InvalidImage", $"'{label}' could not be read. Please choose the file again.");
            if (bytes.Length > AddMenuItemImagesValidator.MaxBytesPerImage)
                return Fail("MenuItem.InvalidImage",
                    $"'{label}' is {bytes.Length / 1024 / 1024}MB. The limit is {AddMenuItemImagesValidator.MaxBytesPerImage / 1024 / 1024}MB per photo.");

            var (storedBytes, storedContentType) = imageProcessor.IsCompressibleImage(contentType)
                ? imageProcessor.Compress(bytes, contentType)
                : (bytes, contentType);

            var image = new MenuItemImage(cmd.MenuItemId, storedBytes, storedContentType, input.FileName, nextOrder++);
            // The first photo becomes the cover, so a dish with photos always has one to show.
            if (existingOrders.Count == 0 && added.Count == 0) image.SetPrimary(true);

            if (useStorage)
            {
                var quota = await TenantStorageQuota.CheckAsync(
                    db.Database, tenantId!.Value, committedInBatch + storedBytes.LongLength, ct);
                if (!quota.Allowed)
                    return Fail("MenuItem.Conflict", TenantStorageQuota.QuotaErrorMessage(quota, input.FileName));

                var key = MenuItemImages.BuildKey(tenantId!.Value, cmd.MenuItemId, image.Id);
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
                    logger.LogError(ex, "Menu item photo upload failed (key {Key}, item {MenuItemId})", key, cmd.MenuItemId);
                    return Fail("MenuItem.ImageUploadFailed", $"'{label}' could not be uploaded. Please try again.");
                }
            }

            added.Add(image);
            db.MenuItemImages.Add(image);
        }

        await db.SaveChangesAsync(ct);
        return Result.Success<IReadOnlyList<MenuItemImageDto>>(added.Select(MenuItemImages.ToDto).ToList());
    }
}

internal sealed class DeleteMenuItemImageHandler(RestaurantDbContext db, IObjectStorage storage)
    : ICommandHandler<DeleteMenuItemImageCommand>
{
    public async Task<Result> Handle(DeleteMenuItemImageCommand cmd, CancellationToken ct)
    {
        var image = await db.MenuItemImages
            .FirstOrDefaultAsync(i => i.Id == cmd.ImageId && i.MenuItemId == cmd.MenuItemId && !i.IsDeleted, ct);
        if (image is null)
            return Result.Failure(Error.Custom("MenuItemImage.NotFound", "That photo no longer exists."));

        var wasPrimary = image.IsPrimary;
        var objectKey = image.ObjectKey;
        image.Delete();
        image.SetPrimary(false);

        // Removing the cover promotes the next photo, or the dish silently loses its picture on the till.
        if (wasPrimary)
        {
            var next = await db.MenuItemImages
                .Where(i => i.MenuItemId == cmd.MenuItemId && i.Id != cmd.ImageId && !i.IsDeleted)
                .OrderBy(i => i.SortOrder).FirstOrDefaultAsync(ct);
            next?.SetPrimary(true);
        }

        await db.SaveChangesAsync(ct);
        // After the save: a slow or unreachable bucket must not block the delete. Best-effort by contract.
        if (objectKey is not null) await storage.DeleteAsync(objectKey, ct);
        return Result.Success();
    }
}

internal sealed class SetPrimaryMenuItemImageHandler(RestaurantDbContext db)
    : ICommandHandler<SetPrimaryMenuItemImageCommand>
{
    public async Task<Result> Handle(SetPrimaryMenuItemImageCommand cmd, CancellationToken ct)
    {
        var images = await db.MenuItemImages
            .Where(i => i.MenuItemId == cmd.MenuItemId && !i.IsDeleted).ToListAsync(ct);
        if (images.All(i => i.Id != cmd.ImageId))
            return Result.Failure(Error.Custom("MenuItemImage.NotFound", "That photo no longer exists."));

        foreach (var image in images) image.SetPrimary(image.Id == cmd.ImageId);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class GetMenuItemImageHandler(RestaurantDbContext db, IObjectStorage storage)
    : IQueryHandler<GetMenuItemImageQuery, MenuItemImageFileDto>
{
    public async Task<Result<MenuItemImageFileDto>> Handle(GetMenuItemImageQuery query, CancellationToken ct)
    {
        // The one place that selects Data — alongside ObjectKey, to know which holds the bytes.
        var row = await db.MenuItemImages.AsNoTracking()
            .Where(i => i.Id == query.ImageId && i.MenuItemId == query.MenuItemId && !i.IsDeleted)
            .Select(i => new { i.Data, i.ContentType, i.ObjectKey })
            .FirstOrDefaultAsync(ct);
        if (row is null)
            return Result.Failure<MenuItemImageFileDto>(Error.Custom("MenuItemImage.NotFound", "That photo no longer exists."));

        if (row.ObjectKey is not null)
        {
            var file = await storage.GetAsync(row.ObjectKey, ct);
            if (file is not null) return Result.Success(new MenuItemImageFileDto(file.Data, file.ContentType));
        }
        return Result.Success(new MenuItemImageFileDto(row.Data, row.ContentType));
    }
}
