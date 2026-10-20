using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Restaurant.Application.Menu.Dtos;

namespace Softaxis.Restaurant.Application.Menu.Commands;

/// <summary>Uploads one or more photos of a dish. Accepts data URIs, like every other upload in
/// this product (see RealEstate's AddPropertyImagesCommand for why not multipart).</summary>
public sealed record AddMenuItemImagesCommand(Guid MenuItemId, IReadOnlyList<MenuItemImageInput> Images)
    : ICommand<IReadOnlyList<MenuItemImageDto>>;

/// <param name="Data">A data URI: <c>data:image/jpeg;base64,...</c></param>
public sealed record MenuItemImageInput(string Data, string? FileName = null);

public sealed record DeleteMenuItemImageCommand(Guid MenuItemId, Guid ImageId) : ICommand;

/// <summary>Makes one photo the cover, demoting whichever held it.</summary>
public sealed record SetPrimaryMenuItemImageCommand(Guid MenuItemId, Guid ImageId) : ICommand;

public sealed class AddMenuItemImagesValidator : AbstractValidator<AddMenuItemImagesCommand>
{
    /// <summary>Applied to the decoded bytes. Phone cameras routinely produce 8 MB photos.</summary>
    public const int MaxBytesPerImage = 8 * 1024 * 1024;
    public const int MaxImagesPerRequest = 10;
    /// <summary>A dish needs a few angles, not a gallery — and every one counts against the plan's storage.</summary>
    public const int MaxImagesPerItem = 12;

    public AddMenuItemImagesValidator()
    {
        RuleFor(x => x.MenuItemId).NotEmpty();
        RuleFor(x => x.Images).NotNull()
            .Must(i => i.Count > 0).WithMessage("No photos to upload.")
            .Must(i => i.Count <= MaxImagesPerRequest).WithMessage($"Too many photos in one go (max {MaxImagesPerRequest}).");
        RuleForEach(x => x.Images).ChildRules(img =>
            img.RuleFor(i => i.Data).NotEmpty()
                .Must(d => d.StartsWith("data:image/", StringComparison.OrdinalIgnoreCase))
                .WithMessage("Only image files can be uploaded."));
    }
}
