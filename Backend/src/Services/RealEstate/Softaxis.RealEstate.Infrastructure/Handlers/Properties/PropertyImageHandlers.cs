using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.RealEstate.Application.Properties.Commands;
using Softaxis.RealEstate.Application.Properties.Queries;
using Softaxis.RealEstate.Application.Properties.Dtos;
using Softaxis.RealEstate.Domain.Entities;
using Softaxis.RealEstate.Infrastructure.Persistence;

namespace Softaxis.RealEstate.Infrastructure.Handlers.Properties;

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

internal sealed class AddPropertyImagesHandler(RealEstateDbContext db)
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
            // and would reject files comfortably inside the stated limit.
            if (bytes.Length > AddPropertyImagesValidator.MaxBytesPerImage)
                return Result.Failure<IReadOnlyList<PropertyImageDto>>(
                    Error.Custom("Property.ImageTooLarge",
                        $"'{input.FileName ?? "An image"}' is {bytes.Length / 1024 / 1024}MB. " +
                        $"The limit is {AddPropertyImagesValidator.MaxBytesPerImage / 1024 / 1024}MB per photo."));

            var image = new PropertyImage(property.Id, bytes, contentType, input.FileName, nextOrder++);
            image.SetCaption(input.Caption);

            // The first photo uploaded becomes the cover, so a property is never left with a
            // gallery but no image to represent it in a list.
            if (existing.Count == 0 && added.Count == 0) image.SetPrimary(true);

            added.Add(image);
            db.PropertyImages.Add(image);
        }

        await db.SaveChangesAsync(ct);

        return Result.Success<IReadOnlyList<PropertyImageDto>>(
            added.Select(PropertyMappings.ToDto).ToList());
    }
}

internal sealed class DeletePropertyImageHandler(RealEstateDbContext db)
    : ICommandHandler<DeletePropertyImageCommand>
{
    public async Task<Result> Handle(DeletePropertyImageCommand cmd, CancellationToken ct)
    {
        var image = await db.PropertyImages
            .FirstOrDefaultAsync(i => i.Id == cmd.ImageId && i.PropertyId == cmd.PropertyId, ct);

        if (image is null)
            return Result.Failure(Error.Custom("Property.ImageNotFound", "That image no longer exists."));

        var wasPrimary = image.IsPrimary;
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
            return Result.Failure(Error.Custom("Property.ImageNotFound", "That image no longer exists."));

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

internal sealed class GetPropertyImageHandler(RealEstateDbContext db)
    : IQueryHandler<GetPropertyImageQuery, PropertyImageFileDto>
{
    public async Task<Result<PropertyImageFileDto>> Handle(GetPropertyImageQuery query, CancellationToken ct)
    {
        // The one place that deliberately selects Data. Everything else projects metadata only.
        var image = await db.PropertyImages.AsNoTracking()
            .Where(i => i.Id == query.ImageId && i.PropertyId == query.PropertyId && !i.IsDeleted)
            .Select(i => new PropertyImageFileDto(i.Data, i.ContentType))
            .FirstOrDefaultAsync(ct);

        return image is null
            ? Result.Failure<PropertyImageFileDto>(
                Error.Custom("Property.ImageNotFound", "That image no longer exists."))
            : Result.Success(image);
    }
}
