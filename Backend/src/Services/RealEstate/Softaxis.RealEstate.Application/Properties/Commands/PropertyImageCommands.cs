using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.RealEstate.Application.Properties.Dtos;

namespace Softaxis.RealEstate.Application.Properties.Commands;

/// <summary>
/// Uploads one or more photographs against a property.
///
/// The browser reads a chosen file as a data URI, so that is what this accepts. Multipart form
/// upload would avoid the base64 inflation on the wire, but every other upload in this product
/// (employee avatar, expense receipt) is JSON + data URI, and a lone multipart endpoint would be
/// a second pattern for the frontend to maintain for no real gain at these sizes.
/// </summary>
public sealed record AddPropertyImagesCommand(Guid PropertyId, IReadOnlyList<PropertyImageInput> Images)
    : ICommand<IReadOnlyList<PropertyImageDto>>;

/// <param name="Data">A data URI: <c>data:image/jpeg;base64,...</c></param>
public sealed record PropertyImageInput(string Data, string? FileName = null, string? Caption = null);

public sealed record DeletePropertyImageCommand(Guid PropertyId, Guid ImageId) : ICommand;

/// <summary>Promotes one image to the cover shot, demoting whichever held it.</summary>
public sealed record SetPrimaryPropertyImageCommand(Guid PropertyId, Guid ImageId) : ICommand;

/// <summary>Reorders the gallery. Ids not listed keep their existing order.</summary>
public sealed record ReorderPropertyImagesCommand(Guid PropertyId, IReadOnlyList<Guid> OrderedIds) : ICommand;

/// <summary>Publishes or withdraws a property from the public website.</summary>
public sealed record SetPropertyWebsiteListingCommand(Guid PropertyId, bool ListOnWebsite) : ICommand;

public sealed class AddPropertyImagesValidator : AbstractValidator<AddPropertyImagesCommand>
{
    /// <summary>
    /// Per-image ceiling, applied to the DECODED bytes. Phone cameras routinely produce 8–12 MB
    /// files, so a limit below this would reject ordinary photographs with no explanation.
    /// </summary>
    public const int MaxBytesPerImage = 8 * 1024 * 1024;

    /// <summary>Per-request ceiling. Larger selections are chunked by the uploader.</summary>
    public const int MaxImagesPerRequest = 20;

    public AddPropertyImagesValidator()
    {
        RuleFor(x => x.PropertyId).NotEmpty();
        RuleFor(x => x.Images).NotNull()
            .Must(i => i.Count > 0).WithMessage("No images to upload.")
            .Must(i => i.Count <= MaxImagesPerRequest)
            .WithMessage($"Too many images in one request (max {MaxImagesPerRequest}).");

        RuleForEach(x => x.Images).ChildRules(img =>
        {
            img.RuleFor(i => i.Data).NotEmpty().WithMessage("Image data is required.")
                .Must(d => d.StartsWith("data:image/", StringComparison.OrdinalIgnoreCase))
                .WithMessage("Only image files can be uploaded.");
        });
    }
}
