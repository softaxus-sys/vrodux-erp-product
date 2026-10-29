using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;

namespace Softaxis.Ecommerce.Application.StoreAdmin;

// The staff side of the workspace's own store: settings, pages, collections, shipping, discounts, orders, customers.

// ── Settings ──────────────────────────────────────────────────────────────────

/// <summary>Secrets are never returned — only whether one is stored.</summary>
public sealed record StoreSettingsDto(
    Guid Id, string Name, string Slug, string? CustomDomain, bool IsPublished, string CurrencyCode, string Language,
    string? ContactEmail, string? ContactPhone, string? Address, string? OrderNotifyEmail,
    Guid? LogoAssetId, Guid? FaviconAssetId, string? AnnouncementText, string? SeoTitle, string? MetaDescription,
    string ThemeJson, string HeaderMenuJson, string FooterMenuJson, string SocialJson,
    decimal TaxPercent, bool PricesIncludeTax, bool AllowGuestCheckout, bool RequirePhone,
    bool CodEnabled, string? CodInstructions, bool BankEnabled, string? BankDetails,
    bool StripeEnabled, bool HasStripeSecret, bool HasStripeWebhookSecret,
    bool PayPalEnabled, string? PayPalClientId, bool HasPayPalSecret, bool PayPalSandbox,
    string PublicUrl, string StripeWebhookUrl);

public sealed record GetStoreQuery : IQuery<StoreSettingsDto>;

/// <summary>Creates the workspace's store with sensible starting pages, menus and a shipping zone.</summary>
public sealed record CreateStoreCommand(string Name, string Slug) : ICommand<StoreSettingsDto>;

public sealed class CreateStoreValidator : AbstractValidator<CreateStoreCommand>
{
    public CreateStoreValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(150);
        RuleFor(x => x.Slug).NotEmpty().MaximumLength(63).Matches("^[a-z0-9]([a-z0-9-]*[a-z0-9])?$")
            .WithMessage("The address may use lower-case letters, numbers and hyphens only.");
    }
}

/// <param name="StripeSecretKey">Null = keep what is stored; empty = remove; otherwise replace.</param>
public sealed record UpdateStoreCommand(
    string Name, string Slug, string? CustomDomain, bool IsPublished, string CurrencyCode, string Language,
    string? ContactEmail, string? ContactPhone, string? Address, string? OrderNotifyEmail,
    Guid? LogoAssetId, Guid? FaviconAssetId, string? AnnouncementText, string? SeoTitle, string? MetaDescription,
    string ThemeJson, string HeaderMenuJson, string FooterMenuJson, string SocialJson,
    decimal TaxPercent, bool PricesIncludeTax, bool AllowGuestCheckout, bool RequirePhone,
    bool CodEnabled, string? CodInstructions, bool BankEnabled, string? BankDetails,
    bool StripeEnabled, string? StripeSecretKey, string? StripeWebhookSecret,
    bool PayPalEnabled, string? PayPalClientId, string? PayPalSecret, bool PayPalSandbox) : ICommand<StoreSettingsDto>;

public sealed class UpdateStoreValidator : AbstractValidator<UpdateStoreCommand>
{
    public UpdateStoreValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(150);
        RuleFor(x => x.Slug).NotEmpty().MaximumLength(63).Matches("^[a-z0-9]([a-z0-9-]*[a-z0-9])?$")
            .WithMessage("The address may use lower-case letters, numbers and hyphens only.");
        RuleFor(x => x.CurrencyCode).NotEmpty().Length(3);
        RuleFor(x => x.Language).Must(l => l is "en" or "ar").WithMessage("Language must be en or ar.");
        RuleFor(x => x.TaxPercent).InclusiveBetween(0, 100);
        RuleFor(x => x.ContactEmail).EmailAddress().When(x => !string.IsNullOrWhiteSpace(x.ContactEmail));
        RuleFor(x => x.OrderNotifyEmail).EmailAddress().When(x => !string.IsNullOrWhiteSpace(x.OrderNotifyEmail));
        RuleFor(x => x.ThemeJson).MaximumLength(20_000);
        RuleFor(x => x.HeaderMenuJson).MaximumLength(10_000);
        RuleFor(x => x.FooterMenuJson).MaximumLength(10_000);
        RuleFor(x => x.SocialJson).MaximumLength(5_000);
    }
}

// ── Pages (the page builder) ──────────────────────────────────────────────────

public sealed record PageSummaryDto(Guid Id, string Slug, string Title, string Kind, bool IsPublished, int SectionCount, DateTime? UpdatedAt);
public sealed record PageDto(Guid Id, string Slug, string Title, string Kind, bool IsPublished, string SectionsJson, string? SeoTitle, string? MetaDescription);

public sealed record GetPagesQuery : IQuery<IReadOnlyList<PageSummaryDto>>;
public sealed record GetPageQuery(Guid Id) : IQuery<PageDto>;
public sealed record SavePageCommand(Guid? Id, string Slug, string Title, string Kind, bool IsPublished, string SectionsJson, string? SeoTitle, string? MetaDescription)
    : ICommand<PageDto>;
public sealed record DeletePageCommand(Guid Id) : ICommand;

public sealed class SavePageValidator : AbstractValidator<SavePageCommand>
{
    public SavePageValidator()
    {
        RuleFor(x => x.Title).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Slug).NotEmpty().MaximumLength(100).Matches("^[a-z0-9]([a-z0-9-]*[a-z0-9])?$")
            .WithMessage("The page address may use lower-case letters, numbers and hyphens only.");
        RuleFor(x => x.Kind).Must(k => k is "home" or "page" or "policy").WithMessage("Unknown page kind.");
        RuleFor(x => x.SectionsJson).NotEmpty().MaximumLength(400_000);
    }
}

// ── Assets ────────────────────────────────────────────────────────────────────

public sealed record AssetDto(Guid Id, string FileName, string ContentType, int Size);
public sealed record UploadAssetCommand(string FileName, string ContentType, byte[] Data) : ICommand<AssetDto>;
public sealed record GetAssetsQuery : IQuery<IReadOnlyList<AssetDto>>;

// ── Collections ───────────────────────────────────────────────────────────────

public sealed record CollectionDto(
    Guid Id, string Slug, string Name, string? Description, Guid? ImageAssetId,
    IReadOnlyList<Guid> TemplateIds, string? CategoryName, bool IsPublished, int SortOrder);

public sealed record GetCollectionsQuery : IQuery<IReadOnlyList<CollectionDto>>;
public sealed record SaveCollectionCommand(
    Guid? Id, string Name, string Slug, string? Description, Guid? ImageAssetId,
    IReadOnlyList<Guid> TemplateIds, string? CategoryName, bool IsPublished, int SortOrder) : ICommand<CollectionDto>;
public sealed record DeleteCollectionCommand(Guid Id) : ICommand;

public sealed class SaveCollectionValidator : AbstractValidator<SaveCollectionCommand>
{
    public SaveCollectionValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(150);
        RuleFor(x => x.Slug).NotEmpty().MaximumLength(100).Matches("^[a-z0-9]([a-z0-9-]*[a-z0-9])?$");
        RuleFor(x => x.TemplateIds).Must(l => l.Count <= 500).WithMessage("A collection holds at most 500 hand-picked products.");
    }
}

// ── Shipping ──────────────────────────────────────────────────────────────────

public sealed record ShippingZoneDto(
    Guid Id, string Name, IReadOnlyList<string> Countries, decimal FlatRate, decimal? FreeOver, decimal? MinOrder,
    string? EstimatedDays, bool IsActive, int SortOrder);

public sealed record GetShippingZonesQuery : IQuery<IReadOnlyList<ShippingZoneDto>>;
public sealed record SaveShippingZoneCommand(
    Guid? Id, string Name, IReadOnlyList<string> Countries, decimal FlatRate, decimal? FreeOver, decimal? MinOrder,
    string? EstimatedDays, bool IsActive, int SortOrder) : ICommand<ShippingZoneDto>;
public sealed record DeleteShippingZoneCommand(Guid Id) : ICommand;

public sealed class SaveShippingZoneValidator : AbstractValidator<SaveShippingZoneCommand>
{
    public SaveShippingZoneValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(150);
        RuleFor(x => x.Countries).NotEmpty().WithMessage("Choose at least one country, or all.");
        RuleFor(x => x.FlatRate).GreaterThanOrEqualTo(0);
        RuleFor(x => x.FreeOver).GreaterThanOrEqualTo(0).When(x => x.FreeOver.HasValue);
        RuleFor(x => x.MinOrder).GreaterThanOrEqualTo(0).When(x => x.MinOrder.HasValue);
    }
}

// ── Discounts ─────────────────────────────────────────────────────────────────

public sealed record DiscountDto(
    Guid Id, string Code, string Kind, decimal Value, decimal? MinSubtotal, int? MaxUses, int UsedCount,
    DateTime? StartsAt, DateTime? EndsAt, bool IsActive);

public sealed record GetDiscountsQuery : IQuery<IReadOnlyList<DiscountDto>>;
public sealed record SaveDiscountCommand(
    Guid? Id, string Code, string Kind, decimal Value, decimal? MinSubtotal, int? MaxUses,
    DateTime? StartsAt, DateTime? EndsAt, bool IsActive) : ICommand<DiscountDto>;
public sealed record DeleteDiscountCommand(Guid Id) : ICommand;

public sealed class SaveDiscountValidator : AbstractValidator<SaveDiscountCommand>
{
    public SaveDiscountValidator()
    {
        RuleFor(x => x.Code).NotEmpty().MaximumLength(40).Matches("^[A-Za-z0-9_-]+$").WithMessage("A code uses letters, numbers, - and _ only.");
        RuleFor(x => x.Kind).Must(k => k is "percent" or "fixed" or "free_shipping");
        RuleFor(x => x.Value).GreaterThan(0).When(x => x.Kind != "free_shipping");
        RuleFor(x => x.Value).LessThanOrEqualTo(100).When(x => x.Kind == "percent");
        RuleFor(x => x.MaxUses).GreaterThan(0).When(x => x.MaxUses.HasValue);
    }
}

// ── Orders ────────────────────────────────────────────────────────────────────

public sealed record StoreOrderLineDto(Guid ProductId, string Title, string? VariantName, string? Sku, int Quantity, decimal UnitPrice, decimal LineTotal);
public sealed record StoreOrderEventDto(string Kind, string Message, string? ByName, DateTime At);

public sealed record StoreOrderDto(
    Guid Id, string Number, string Status, string PaymentMethod, string PaymentStatus,
    string Email, string? Phone, string CustomerName,
    string ShipName, string ShipLine1, string? ShipLine2, string ShipCity, string? ShipRegion, string? ShipPostal, string ShipCountry,
    string? ShippingMethod, decimal Subtotal, decimal DiscountTotal, string? DiscountCode, decimal ShippingTotal, decimal TaxTotal, decimal Total,
    string CurrencyCode, string? PaymentReference, DateTime? PaidAt,
    string? TrackingCarrier, string? TrackingNumber, string? TrackingUrl, DateTime? ShippedAt, DateTime? DeliveredAt,
    DateTime? CancelledAt, string? CancelReason, string? CustomerNote, string? StaffNote,
    DateTime CreatedAt, IReadOnlyList<StoreOrderLineDto> Lines, IReadOnlyList<StoreOrderEventDto> Events);

public sealed record StoreOrderSummaryDto(
    Guid Id, string Number, string Status, string PaymentMethod, string PaymentStatus, string CustomerName, string Email,
    decimal Total, string CurrencyCode, int ItemCount, DateTime CreatedAt);

public sealed record StoreOrdersSummaryDto(int ToFulfil, int AwaitingPayment, int Shipped, decimal Revenue30Days, int Orders30Days, string CurrencyCode);

public sealed record GetStoreOrdersQuery(string? Search, string? Status, string? PaymentStatus, int Page = 1, int PageSize = 25)
    : IQuery<PagedResult<StoreOrderSummaryDto>>;
public sealed record GetStoreOrderQuery(Guid Id) : IQuery<StoreOrderDto>;
public sealed record GetStoreOrdersSummaryQuery : IQuery<StoreOrdersSummaryDto>;

public sealed record MarkStoreOrderPaidCommand(Guid Id, string? Reference) : ICommand<StoreOrderDto>;
public sealed record ShipStoreOrderCommand(Guid Id, string? Carrier, string? TrackingNumber, string? TrackingUrl) : ICommand<StoreOrderDto>;
public sealed record DeliverStoreOrderCommand(Guid Id) : ICommand<StoreOrderDto>;
public sealed record CancelStoreOrderCommand(Guid Id, string? Reason) : ICommand<StoreOrderDto>;
/// <summary>Sends the money back through the card / PayPal provider when the order was paid that way; otherwise only records it.</summary>
public sealed record RefundStoreOrderCommand(Guid Id, string? Reason) : ICommand<StoreOrderDto>;
public sealed record SetStoreOrderNoteCommand(Guid Id, string? Note) : ICommand<StoreOrderDto>;

// ── Customers ─────────────────────────────────────────────────────────────────

public sealed record StoreCustomerDto(Guid Id, string Email, string Name, string? Phone, bool AcceptsMarketing, int Orders, decimal TotalSpent, DateTime CreatedAt, DateTime? LastSignInAt);
public sealed record GetStoreCustomersQuery(string? Search, int Page = 1, int PageSize = 25) : IQuery<PagedResult<StoreCustomerDto>>;
