using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Inventory.Application.ProductTemplates;

/// <summary>One option the shopper chooses between — "Size" with S, M, L.</summary>
public sealed record ProductOptionInput(string Name, IReadOnlyList<string> Values);

/// <summary>
/// One variant of a listing. Either an existing product to bring in (<see cref="ExistingProductId"/> —
/// its price, stock and SKU are left exactly as they are) or the details of a new product to create.
/// </summary>
public sealed record VariantInput(
    Guid?   ExistingProductId,
    IReadOnlyDictionary<string, string> Options,
    string? Name         = null,
    string? SKU          = null,
    string? Barcode      = null,
    decimal SalePrice    = 0,
    decimal CostPrice    = 0,
    decimal TaxRate      = 0,
    decimal OpeningStock = 0,
    decimal ReorderLevel = 0,
    string? Unit         = null,
    bool    TrackInventory = true,
    bool    SellOnline   = true,
    decimal? WeightGrams = null,
    decimal? LengthCm    = null,
    decimal? WidthCm     = null,
    decimal? HeightCm    = null);

public sealed record ProductTemplateContent(
    string  Name,
    string? Description,
    string? ShortDescription,
    Guid    CategoryId,
    Guid?   BrandId,
    string? Slug,
    string? SeoTitle,
    string? MetaDescription,
    string? Tags);

public sealed record CreateProductTemplateCommand(
    ProductTemplateContent Content,
    IReadOnlyList<ProductOptionInput> Options,
    IReadOnlyList<VariantInput> Variants) : ICommand<ProductTemplateDto>;

/// <summary>One existing variant's choices, sent together with an options change.</summary>
public sealed record VariantChoiceInput(Guid ProductId, IReadOnlyDictionary<string, string> Options);

/// <summary>
/// Changes the listing's content and options. A variant's choices must always fit the options, so when
/// the options change (a new "Colour", a renamed value) the new choices for the affected variants travel
/// in <paramref name="VariantChoices"/> and are checked together with the options — one change, never
/// a half-applied one. Variants not named keep the choices they have.
/// </summary>
public sealed record UpdateProductTemplateCommand(
    Guid Id,
    ProductTemplateContent Content,
    IReadOnlyList<ProductOptionInput> Options,
    IReadOnlyList<VariantChoiceInput>? VariantChoices = null) : ICommand<ProductTemplateDto>;

public sealed record AddTemplateVariantsCommand(Guid TemplateId, IReadOnlyList<VariantInput> Variants)
    : ICommand<ProductTemplateDto>;

/// <summary>The online side of one variant: its choices, whether it is offered, and its shipping size.</summary>
public sealed record UpdateTemplateVariantCommand(
    Guid TemplateId,
    Guid ProductId,
    IReadOnlyDictionary<string, string> Options,
    bool SellOnline,
    decimal? WeightGrams,
    decimal? LengthCm,
    decimal? WidthCm,
    decimal? HeightCm) : ICommand<ProductTemplateDto>;

/// <summary>Takes a product out of the listing. The product itself — SKU, stock, history — stays.</summary>
public sealed record RemoveTemplateVariantCommand(Guid TemplateId, Guid ProductId) : ICommand<ProductTemplateDto>;

public sealed record SetTemplatePublishedCommand(Guid Id, bool Published) : ICommand<ProductTemplateDto>;

/// <summary>Deletes the listing and its photos. The products in it are kept.</summary>
public sealed record DeleteProductTemplateCommand(Guid Id) : ICommand;

// ── Photos ────────────────────────────────────────────────────────────────────

/// <param name="Data">A data URI: <c>data:image/jpeg;base64,...</c></param>
public sealed record ProductImageInput(string Data, string? FileName = null, string? AltText = null, Guid? ProductId = null);

public sealed record AddTemplateImagesCommand(Guid TemplateId, IReadOnlyList<ProductImageInput> Images)
    : ICommand<IReadOnlyList<ProductImageDto>>;

public sealed record DeleteTemplateImageCommand(Guid TemplateId, Guid ImageId) : ICommand;
public sealed record SetPrimaryTemplateImageCommand(Guid TemplateId, Guid ImageId) : ICommand;
public sealed record ReorderTemplateImagesCommand(Guid TemplateId, IReadOnlyList<Guid> OrderedIds) : ICommand;
public sealed record UpdateTemplateImageCommand(Guid TemplateId, Guid ImageId, string? AltText, Guid? ProductId) : ICommand;

// ── Validation ────────────────────────────────────────────────────────────────

public sealed class ProductTemplateContentValidator : AbstractValidator<ProductTemplateContent>
{
    public ProductTemplateContentValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.CategoryId).NotEmpty();
        RuleFor(x => x.ShortDescription).MaximumLength(500);
        RuleFor(x => x.Slug).MaximumLength(160);
        RuleFor(x => x.SeoTitle).MaximumLength(200);
        RuleFor(x => x.MetaDescription).MaximumLength(320);
        RuleFor(x => x.Tags).MaximumLength(500);
    }
}

public sealed class ProductOptionInputValidator : AbstractValidator<ProductOptionInput>
{
    public ProductOptionInputValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(50);
        RuleFor(x => x.Values).NotNull().Must(v => v is { Count: > 0 and <= 100 })
            .WithMessage("Each option needs between 1 and 100 values.");
        RuleForEach(x => x.Values).NotEmpty().MaximumLength(50);
    }
}

public sealed class VariantInputValidator : AbstractValidator<VariantInput>
{
    public VariantInputValidator()
    {
        RuleFor(x => x.Options).NotNull();
        RuleFor(x => x.Name).MaximumLength(200);
        RuleFor(x => x.SKU).MaximumLength(100);
        RuleFor(x => x.Barcode).MaximumLength(100);
        RuleFor(x => x.SalePrice).GreaterThanOrEqualTo(0);
        RuleFor(x => x.CostPrice).GreaterThanOrEqualTo(0);
        RuleFor(x => x.TaxRate).InclusiveBetween(0, 100);
        RuleFor(x => x.OpeningStock).GreaterThanOrEqualTo(0);
    }
}

public sealed class CreateProductTemplateCommandValidator : AbstractValidator<CreateProductTemplateCommand>
{
    public CreateProductTemplateCommandValidator()
    {
        RuleFor(x => x.Content).NotNull().SetValidator(new ProductTemplateContentValidator());
        RuleFor(x => x.Options).NotNull();
        RuleForEach(x => x.Options).SetValidator(new ProductOptionInputValidator());
        RuleFor(x => x.Variants).NotNull().Must(v => v is { Count: > 0 })
            .WithMessage("A listing needs at least one variant.");
        RuleForEach(x => x.Variants).SetValidator(new VariantInputValidator());
    }
}

public sealed class UpdateProductTemplateCommandValidator : AbstractValidator<UpdateProductTemplateCommand>
{
    public UpdateProductTemplateCommandValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.Content).NotNull().SetValidator(new ProductTemplateContentValidator());
        RuleFor(x => x.Options).NotNull();
        RuleForEach(x => x.Options).SetValidator(new ProductOptionInputValidator());
    }
}

public sealed class AddTemplateVariantsCommandValidator : AbstractValidator<AddTemplateVariantsCommand>
{
    public AddTemplateVariantsCommandValidator()
    {
        RuleFor(x => x.TemplateId).NotEmpty();
        RuleFor(x => x.Variants).NotNull().Must(v => v is { Count: > 0 }).WithMessage("No variants to add.");
        RuleForEach(x => x.Variants).SetValidator(new VariantInputValidator());
    }
}

public sealed class AddTemplateImagesValidator : AbstractValidator<AddTemplateImagesCommand>
{
    /// <summary>Applied to the decoded bytes. Phone cameras routinely produce 8 MB photos.</summary>
    public const int MaxBytesPerImage = 8 * 1024 * 1024;
    public const int MaxImagesPerRequest = 10;
    /// <summary>Shopify allows 250; every photo also counts against the plan's storage.</summary>
    public const int MaxImagesPerTemplate = 60;

    public AddTemplateImagesValidator()
    {
        RuleFor(x => x.TemplateId).NotEmpty();
        RuleFor(x => x.Images).NotNull()
            .Must(i => i.Count > 0).WithMessage("No photos to upload.")
            .Must(i => i.Count <= MaxImagesPerRequest).WithMessage($"Too many photos in one go (max {MaxImagesPerRequest}).");
        RuleForEach(x => x.Images).ChildRules(img =>
        {
            img.RuleFor(i => i.Data).NotEmpty()
                .Must(d => d.StartsWith("data:image/", StringComparison.OrdinalIgnoreCase))
                .WithMessage("Only image files can be uploaded.");
            img.RuleFor(i => i.AltText).MaximumLength(300);
        });
    }
}
