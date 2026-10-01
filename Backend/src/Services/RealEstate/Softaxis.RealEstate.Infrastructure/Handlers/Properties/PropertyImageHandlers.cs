using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Application.Storage;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.RealEstate.Application.Properties.Commands;
using Softaxis.RealEstate.Application.Properties.Queries;
using Softaxis.RealEstate.Application.Properties.Dtos;
using Softaxis.RealEstate.Domain.Entities;
using Softaxis.RealEstate.Infrastructure.Handlers.QasroIntegrations;
using Softaxis.RealEstate.Infrastructure.Persistence;
using Softaxis.RealEstate.Infrastructure.Qasro;

namespace Softaxis.RealEstate.Infrastructure.Handlers.Properties;

/// <summary>
/// Object-storage plumbing shared by every PropertyImage read/write handler (and the public,
/// anonymous image endpoint in PublicListingHandlers.cs, which reuses LoadAsync — same assembly,
/// internal visibility is enough).
/// </summary>
internal static class PropertyImageStorage
{
    public static string BuildKey(Guid tenantId, Guid propertyId, Guid imageId) =>
        $"real-estate/{tenantId:N}/{propertyId:N}/{imageId:N}";

    /// <summary>Dual-read: bytes come from the bucket when ObjectKey is set, otherwise from the
    /// legacy Data column. A bucket miss (shouldn't happen — see PropertyImage's own remarks on
    /// the two never both being populated) falls back to Data rather than failing the request.</summary>
    public static async Task<PropertyImageFileDto> LoadAsync(
        byte[] data, string contentType, string? objectKey, IObjectStorage storage, CancellationToken ct)
    {
        if (objectKey is not null)
        {
            var file = await storage.GetAsync(objectKey, ct);
            if (file is not null) return new PropertyImageFileDto(file.Data, file.ContentType);
        }
        return new PropertyImageFileDto(data, contentType);
    }
}

/// <summary>Decodes the <c>data:</c> URIs the browser produces into storable bytes.</summary>
internal static class DataUri
{
    /// <summary>
    /// Returns false rather than throwing on malformed input: the payload comes from a browser
    /// and a truncated upload is a client error to report, not an exception to surface as a 500.
    /// </summary>
    public static bool TryParse(string value, out byte[] bytes, out string contentType)
    {
        bytes = [];
        contentType = "image/jpeg";

        var comma = value.IndexOf(',');
        if (comma < 0 || !value.StartsWith("data:", StringComparison.OrdinalIgnoreCase)) return false;

        var header = value[5..comma];
        if (!header.Contains("base64", StringComparison.OrdinalIgnoreCase)) return false;

        var semi = header.IndexOf(';');
        if (semi > 0) contentType = header[..semi];

        try
        {
            bytes = Convert.FromBase64String(value[(comma + 1)..]);
            return bytes.Length > 0;
        }
        catch (FormatException)
        {
            return false;
        }
    }
}

internal sealed class AddPropertyImagesHandler(
    RealEstateDbContext db, IObjectStorage storage, IImageProcessor imageProcessor,
    ILogger<AddPropertyImagesHandler> logger)
    : ICommandHandler<AddPropertyImagesCommand, IReadOnlyList<PropertyImageDto>>
{
    public async Task<Result<IReadOnlyList<PropertyImageDto>>> Handle(
        AddPropertyImagesCommand cmd, CancellationToken ct)
    {
        var property = await db.Properties
            .Include(p => p.Images)
            .FirstOrDefaultAsync(p => p.Id == cmd.PropertyId, ct);

        if (property is null)
            return Result.Failure<IReadOnlyList<PropertyImageDto>>(
                Error.Custom("Property.NotFound", "That property no longer exists."));

        // Falls back to the legacy Data column when object storage isn't configured, or the
        // ambient tenant is somehow unresolved — neither should ever block an upload.
        var tenantId = TenantAmbient.TenantId;
        var useStorage = storage.IsConfigured && tenantId is not null;

        var existing = property.Images.Where(i => !i.IsDeleted).ToList();
        var nextOrder = existing.Count == 0 ? 0 : existing.Max(i => i.SortOrder) + 1;
        var added = new List<PropertyImage>();

        foreach (var input in cmd.Images)
        {
            if (!DataUri.TryParse(input.Data, out var bytes, out var contentType))
                return Result.Failure<IReadOnlyList<PropertyImageDto>>(
                    Error.Custom("Property.InvalidImage",
                        $"'{input.FileName ?? "An image"}' could not be read. Please re-select the file."));

            // Checked against the decoded length, not the base64 string, which is a third larger
            // and would reject files comfortably inside the stated limit. Checked on the ORIGINAL
            // upload, not the post-compression size — the limit is about what the user is sending,
            // not what ends up stored.
            if (bytes.Length > AddPropertyImagesValidator.MaxBytesPerImage)
                return Result.Failure<IReadOnlyList<PropertyImageDto>>(
                    Error.Custom("Property.ImageTooLarge",
                        $"'{input.FileName ?? "An image"}' is {bytes.Length / 1024 / 1024}MB. " +
                        $"The limit is {AddPropertyImagesValidator.MaxBytesPerImage / 1024 / 1024}MB per photo."));

            // Property photos routinely arrive at several MB from a phone camera — exactly what
            // IImageProcessor's longest-dimension cap + WebP re-encode exists for.
            var (storedBytes, storedContentType) = imageProcessor.IsCompressibleImage(contentType)
                ? imageProcessor.Compress(bytes, contentType)
                : (bytes, contentType);

            var image = new PropertyImage(property.Id, storedBytes, storedContentType, input.FileName, nextOrder++);
            image.SetCaption(input.Caption);

            // The first photo uploaded becomes the cover, so a property is never left with a
            // gallery but no image to represent it in a list.
            if (existing.Count == 0 && added.Count == 0) image.SetPrimary(true);

            if (useStorage)
            {
                var key = PropertyImageStorage.BuildKey(tenantId!.Value, property.Id, image.Id);
                try
                {
                    await storage.PutAsync(key, storedBytes, storedContentType, ct);
                    image.SetObjectKey(key, storedContentType, storedBytes.LongLength); // clears Data
                }
                catch (Exception ex)
                {
                    // PutAsync throws on failure by contract (see IObjectStorage) — the upload
                    // genuinely didn't land anywhere, so this must fail loudly, not fall back
                    // silently to storing in the DB (that would surprise a deployment that chose
                    // object storage specifically to stop doing that). Logged with the real
                    // exception — without this, a bucket-side failure (bad signature, policy,
                    // connectivity) was previously swallowed with no trace anywhere.
                    logger.LogError(ex,
                        "Property image upload to object storage failed (key {Key}, property {PropertyId})",
                        key, property.Id);
                    return Result.Failure<IReadOnlyList<PropertyImageDto>>(
                        Error.Custom("Property.ImageUploadFailed",
                            $"'{input.FileName ?? "An image"}' could not be uploaded. Please try again."));
                }
            }

            added.Add(image);
            db.PropertyImages.Add(image);
        }

        await db.SaveChangesAsync(ct);

        return Result.Success<IReadOnlyList<PropertyImageDto>>(
            added.Select(PropertyMappings.ToDto).ToList());
    }
}

internal sealed class DeletePropertyImageHandler(RealEstateDbContext db, IObjectStorage storage)
    : ICommandHandler<DeletePropertyImageCommand>
{
    public async Task<Result> Handle(DeletePropertyImageCommand cmd, CancellationToken ct)
    {
        var image = await db.PropertyImages
            .FirstOrDefaultAsync(i => i.Id == cmd.ImageId && i.PropertyId == cmd.PropertyId, ct);

        if (image is null)
            return Result.Failure(Error.Custom("Property.Image.NotFound", "That image no longer exists."));

        var wasPrimary = image.IsPrimary;
        var objectKey = image.ObjectKey;
        image.Delete();

        // Deleting the cover shot must promote another, or the property silently loses its
        // representative image everywhere one is shown.
        if (wasPrimary)
        {
            var next = await db.PropertyImages
                .Where(i => i.PropertyId == cmd.PropertyId && i.Id != cmd.ImageId)
                .OrderBy(i => i.SortOrder)
                .FirstOrDefaultAsync(ct);
            next?.SetPrimary(true);
        }

        await db.SaveChangesAsync(ct);

        // After, not before: the tenant's own delete must not be blocked by the bucket being slow
        // or unreachable (same reasoning as Qasro's UnlinkAgencyAsync). A failed bucket delete
        // leaves an orphaned object — a storage cost, not a correctness problem.
        if (objectKey is not null) await storage.DeleteAsync(objectKey, ct);

        return Result.Success();
    }
}

internal sealed class SetPrimaryPropertyImageHandler(RealEstateDbContext db)
    : ICommandHandler<SetPrimaryPropertyImageCommand>
{
    public async Task<Result> Handle(SetPrimaryPropertyImageCommand cmd, CancellationToken ct)
    {
        var images = await db.PropertyImages
            .Where(i => i.PropertyId == cmd.PropertyId)
            .ToListAsync(ct);

        var target = images.FirstOrDefault(i => i.Id == cmd.ImageId);
        if (target is null)
            return Result.Failure(Error.Custom("Property.Image.NotFound", "That image no longer exists."));

        foreach (var image in images) image.SetPrimary(image.Id == cmd.ImageId);

        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class ReorderPropertyImagesHandler(RealEstateDbContext db)
    : ICommandHandler<ReorderPropertyImagesCommand>
{
    public async Task<Result> Handle(ReorderPropertyImagesCommand cmd, CancellationToken ct)
    {
        var images = await db.PropertyImages
            .Where(i => i.PropertyId == cmd.PropertyId)
            .ToListAsync(ct);

        for (var i = 0; i < cmd.OrderedIds.Count; i++)
        {
            // An id that is not ours is ignored rather than failing the request: a stale tab can
            // submit an order containing an image someone else has since deleted, and losing the
            // whole reorder over that would be worse than ordering what remains.
            images.FirstOrDefault(img => img.Id == cmd.OrderedIds[i])?.SetSortOrder(i);
        }

        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class SetPropertyWebsiteListingHandler(RealEstateDbContext db)
    : ICommandHandler<SetPropertyWebsiteListingCommand>
{
    public async Task<Result> Handle(SetPropertyWebsiteListingCommand cmd, CancellationToken ct)
    {
        var property = await db.Properties
            .Include(p => p.Images)
            .FirstOrDefaultAsync(p => p.Id == cmd.PropertyId, ct);

        if (property is null)
            return Result.Failure(Error.Custom("Property.NotFound", "That property no longer exists."));

        // Publishing a property with no photograph produces a listing nobody will click, so it is
        // refused here rather than discovered on the live site.
        if (cmd.ListOnWebsite && property.Images.Count(i => !i.IsDeleted) == 0)
            return Result.Failure(Error.Custom("Property.NoImages",
                "Add at least one photo before listing this property on the website."));

        property.SetWebsiteListing(cmd.ListOnWebsite);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class SetPropertyQasroListingHandler(RealEstateDbContext db, IQasroClient qasro)
    : ICommandHandler<SetPropertyQasroListingCommand>
{
    public async Task<Result> Handle(SetPropertyQasroListingCommand cmd, CancellationToken ct)
    {
        var property = await db.Properties
            .Include(p => p.Images)
            .FirstOrDefaultAsync(p => p.Id == cmd.PropertyId, ct);

        if (property is null)
            return Result.Failure(Error.Custom("Property.NotFound", "That property no longer exists."));

        // Same reasoning as the website listing above — Qasro is a public portal too.
        if (cmd.ListOnQasro && property.Images.Count(i => !i.IsDeleted) == 0)
            return Result.Failure(Error.Custom("Property.NoImages",
                "Add at least one photo before listing this property on Qasro."));

        property.SetQasroListing(cmd.ListOnQasro);
        await db.SaveChangesAsync(ct);

        // Best-effort — tells Qasro to pull this property right away instead of waiting for its own
        // cron, which on a free-tier deployment can run as infrequently as once a day. Fired on both
        // listing and un-listing, so a property that just sold stops showing on Qasro just as fast as
        // a new one starts. See QasroIntegrationScope.NotifySyncNowAsync.
        if (QasroIntegrationScope.CurrentTenant() is { } tenantId)
            await QasroIntegrationScope.NotifySyncNowAsync(db, qasro, tenantId, [property.Id], ct);

        return Result.Success();
    }
}

internal sealed class BulkSetPropertyQasroListingHandler(RealEstateDbContext db, IQasroClient qasro)
    : ICommandHandler<BulkSetPropertyQasroListingCommand, BulkQasroListingResultDto>
{
    public async Task<Result<BulkQasroListingResultDto>> Handle(BulkSetPropertyQasroListingCommand cmd, CancellationToken ct)
    {
        var properties = await db.Properties
            .Include(p => p.Images)
            .Where(p => cmd.PropertyIds.Contains(p.Id))
            .ToListAsync(ct);

        var changed = new List<Guid>();
        var skipped = 0;

        foreach (var property in properties)
        {
            // Listing without a photo is refused per-property, not for the whole batch — a mixed
            // selection should list what it can rather than failing everything over one property
            // with no photos yet.
            if (cmd.ListOnQasro && property.Images.Count(i => !i.IsDeleted) == 0) { skipped++; continue; }

            property.SetQasroListing(cmd.ListOnQasro);
            changed.Add(property.Id);
        }

        // Ids that matched no property (deleted, wrong tenant) count as skipped too.
        skipped += cmd.PropertyIds.Count - properties.Count;

        await db.SaveChangesAsync(ct);

        // One batched signal, not one per property — bulk-listing 50 properties should not fire 50
        // separate calls at Qasro. See QasroIntegrationScope.NotifySyncNowAsync.
        if (QasroIntegrationScope.CurrentTenant() is { } tenantId)
            await QasroIntegrationScope.NotifySyncNowAsync(db, qasro, tenantId, changed, ct);

        return Result.Success(new BulkQasroListingResultDto(changed.Count, skipped));
    }
}

internal sealed class GetPropertyImageHandler(RealEstateDbContext db, IObjectStorage storage)
    : IQueryHandler<GetPropertyImageQuery, PropertyImageFileDto>
{
    public async Task<Result<PropertyImageFileDto>> Handle(GetPropertyImageQuery query, CancellationToken ct)
    {
        // One of the two places that deliberately selects Data (alongside ObjectKey, to know
        // which one actually holds the bytes). Everything else projects metadata only.
        var row = await db.PropertyImages.AsNoTracking()
            .Where(i => i.Id == query.ImageId && i.PropertyId == query.PropertyId && !i.IsDeleted)
            .Select(i => new { i.Data, i.ContentType, i.ObjectKey })
            .FirstOrDefaultAsync(ct);

        if (row is null)
            return Result.Failure<PropertyImageFileDto>(
                Error.Custom("Property.Image.NotFound", "That image no longer exists."));

        return Result.Success(await PropertyImageStorage.LoadAsync(
            row.Data, row.ContentType, row.ObjectKey, storage, ct));
    }
}
