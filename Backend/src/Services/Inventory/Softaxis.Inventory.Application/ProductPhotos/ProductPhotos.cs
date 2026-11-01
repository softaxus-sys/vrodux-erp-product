using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Inventory.Application.ProductTemplates;

namespace Softaxis.Inventory.Application.ProductPhotos;

/// <summary>
/// Photos of a stock item. They belong to the item: POS, the restaurant and online listings all show the
/// same pictures, and an item that joins an online listing brings them along.
/// </summary>
public sealed record GetProductPhotosQuery(Guid ProductId) : IQuery<IReadOnlyList<ProductImageDto>>;

public sealed record GetProductPhotoQuery(Guid ProductId, Guid ImageId) : IQuery<ProductImageFileDto>;

public sealed record AddProductPhotosCommand(Guid ProductId, IReadOnlyList<ProductImageInput> Images)
    : ICommand<IReadOnlyList<ProductImageDto>>;

public sealed record DeleteProductPhotoCommand(Guid ProductId, Guid ImageId) : ICommand;

/// <summary>Makes this the item's main photo (and the cover of its listing, if it is in one).</summary>
public sealed record SetPrimaryProductPhotoCommand(Guid ProductId, Guid ImageId) : ICommand;

public sealed record UpdateProductPhotoCommand(Guid ProductId, Guid ImageId, string? AltText) : ICommand;

public sealed class AddProductPhotosValidator : AbstractValidator<AddProductPhotosCommand>
{
    /// <summary>Photos one stock item can keep while it is not in a listing. In a listing the listing's limit applies.</summary>
    public const int MaxPerProduct = 20;

    public AddProductPhotosValidator()
    {
        RuleFor(x => x.ProductId).NotEmpty();
        RuleFor(x => x.Images).NotNull()
            .Must(i => i.Count > 0).WithMessage("No photos to upload.")
            .Must(i => i.Count <= AddTemplateImagesValidator.MaxImagesPerRequest)
            .WithMessage($"Too many photos in one go (max {AddTemplateImagesValidator.MaxImagesPerRequest}).");
        RuleForEach(x => x.Images).ChildRules(img =>
        {
            img.RuleFor(i => i.Data).NotEmpty()
                .Must(d => d.StartsWith("data:image/", StringComparison.OrdinalIgnoreCase))
                .WithMessage("Only image files can be uploaded.");
            img.RuleFor(i => i.AltText).MaximumLength(300);
        });
    }
}
