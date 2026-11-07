using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;

namespace Softaxis.Ecommerce.Application.Shop;

// The public storefront. Every request is anonymous: the shop comes from the address, a signed-in shopper from the
// token they were given. Nothing here returns anything a visitor should not see (no cost, no secrets, no other
// shopper's data).

// ── The shop itself ───────────────────────────────────────────────────────────

public sealed record ShopPaymentMethodDto(string Method, string Label, string? Instructions);

public sealed record ShopInfoDto(
    string Name, string Slug, string CurrencyCode, string Language,
    string? ContactEmail, string? ContactPhone, string? Address,
    Guid? LogoAssetId, Guid? FaviconAssetId, string? AnnouncementText, string? SeoTitle, string? MetaDescription,
    string ThemeJson, string HeaderMenuJson, string FooterMenuJson, string SocialJson,
    decimal TaxPercent, bool PricesIncludeTax, bool AllowGuestCheckout, bool RequirePhone,
    IReadOnlyList<ShopPaymentMethodDto> PaymentMethods, IReadOnlyList<string> Countries, bool AllCountries);

public sealed record GetShopInfoQuery(string Slug) : IQuery<ShopInfoDto>;

/// <summary>Which shop a browser address belongs to: a custom domain, or a sub-domain of a configured store domain.</summary>
public sealed record ShopHostDto(string Slug);
public sealed record ResolveShopHostQuery(string Host) : IQuery<ShopHostDto>;

// ── Catalogue ─────────────────────────────────────────────────────────────────

public sealed record ShopCardDto(
    Guid Id, string Name, string Slug, string? ShortDescription, string CategoryName, string? BrandName,
    decimal PriceFrom, decimal PriceTo, Guid? CoverImageId, bool InStock);

public sealed record ShopOptionDto(string Name, IReadOnlyList<string> Values);
public sealed record ShopVariantDto(Guid ProductId, string Name, string? Sku, IReadOnlyDictionary<string, string> Options, decimal Price, bool InStock, int? Remaining);
public sealed record ShopImageDto(Guid Id, Guid? ProductId, string? Alt);

public sealed record ShopProductDto(
    Guid Id, string Name, string Slug, string? Description, string? ShortDescription, string CategoryName, string? BrandName,
    string? SeoTitle, string? MetaDescription, IReadOnlyList<ShopOptionDto> Options, IReadOnlyList<ShopVariantDto> Variants,
    IReadOnlyList<ShopImageDto> Images, IReadOnlyList<ShopCardDto> Related);

public sealed record ShopCategoryDto(string Name, int Count);
public sealed record ShopCollectionDto(string Slug, string Name, string? Description, Guid? ImageAssetId);

public sealed record GetShopProductsQuery(string Slug, string? Search, string? Category, string? Collection, string Sort = "newest", int Page = 1, int PageSize = 24)
    : IQuery<PagedResult<ShopCardDto>>;
public sealed record GetShopProductQuery(string Slug, string ProductSlug) : IQuery<ShopProductDto>;
public sealed record GetShopCategoriesQuery(string Slug) : IQuery<IReadOnlyList<ShopCategoryDto>>;
public sealed record GetShopCollectionsQuery(string Slug) : IQuery<IReadOnlyList<ShopCollectionDto>>;
/// <summary>The title, description and sections of a page ("home" for the front page).</summary>
public sealed record ShopPageDto(string Slug, string Title, string Kind, string SectionsJson, string? SeoTitle, string? MetaDescription);
public sealed record GetShopPageQuery(string Slug, string PageSlug) : IQuery<ShopPageDto>;
/// <summary>For search engines: every address in the store.</summary>
public sealed record GetShopSitemapQuery(string Slug, string? Origin) : IQuery<IReadOnlyList<string>>;

// ── Cart and checkout ─────────────────────────────────────────────────────────

public sealed record ShopCartLine(Guid ProductId, int Quantity);

public sealed record ShopQuoteLineDto(
    Guid ProductId, string ProductSlug, string Title, string? VariantName, string? Sku, Guid TemplateId, Guid? CoverImageId,
    decimal UnitPrice, int Quantity, decimal LineTotal, int? MaxQuantity, string? Problem);

public sealed record ShopShippingOptionDto(Guid ZoneId, string Name, decimal Price, string? EstimatedDays, bool Free);

public sealed record ShopQuoteDto(
    IReadOnlyList<ShopQuoteLineDto> Lines, decimal Subtotal, decimal DiscountTotal, string? DiscountCode, string? DiscountError,
    IReadOnlyList<ShopShippingOptionDto> ShippingOptions, Guid? SelectedZoneId, decimal ShippingTotal, decimal TaxTotal, decimal Total,
    string CurrencyCode, bool CanCheckout, string? BlockedReason);

public sealed record GetShopQuoteQuery(string Slug, IReadOnlyList<ShopCartLine> Items, string? DiscountCode, string? Country, Guid? ZoneId)
    : IQuery<ShopQuoteDto>;

public sealed record ShopCheckoutCommand(
    string Slug, IReadOnlyList<ShopCartLine> Items, string? DiscountCode,
    string Email, string? Phone, string Name,
    string Line1, string? Line2, string City, string? Region, string? PostalCode, string Country,
    Guid ZoneId, string PaymentMethod, string? Note, string? CustomerToken, string? Origin, bool SaveAddress = false)
    : ICommand<ShopCheckoutResultDto>;

public sealed class ShopCheckoutValidator : AbstractValidator<ShopCheckoutCommand>
{
    public ShopCheckoutValidator()
    {
        RuleFor(x => x.Items).NotEmpty().WithMessage("Your cart is empty.").Must(i => i.Count <= 100).WithMessage("The cart is too large.");
        RuleForEach(x => x.Items).ChildRules(i =>
        {
            i.RuleFor(l => l.Quantity).InclusiveBetween(1, 999);
            i.RuleFor(l => l.ProductId).NotEmpty();
        });
        RuleFor(x => x.Email).NotEmpty().EmailAddress().MaximumLength(320);
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Phone).MaximumLength(40);
        RuleFor(x => x.Line1).NotEmpty().MaximumLength(250);
        RuleFor(x => x.Line2).MaximumLength(250);
        RuleFor(x => x.City).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Region).MaximumLength(100);
        RuleFor(x => x.PostalCode).MaximumLength(20);
        RuleFor(x => x.Country).NotEmpty().Length(2);
        RuleFor(x => x.PaymentMethod).NotEmpty();
        RuleFor(x => x.Note).MaximumLength(1000);
    }
}

/// <param name="RedirectUrl">Where to send the shopper to pay (card / PayPal). Null when nothing more is needed.</param>
public sealed record ShopCheckoutResultDto(string OrderNumber, string AccessToken, string Status, string PaymentStatus, string? RedirectUrl);

/// <summary>What a shopper sees of an order. The access token is what proves it is theirs.</summary>
public sealed record ShopOrderLineDto(string Title, string? VariantName, int Quantity, decimal UnitPrice, decimal LineTotal);

public sealed record ShopOrderDto(
    string Number, string Status, string PaymentMethod, string PaymentStatus, string CurrencyCode,
    string Email, string CustomerName, string ShipName, string ShipLine1, string? ShipLine2, string ShipCity, string? ShipRegion, string? ShipPostal, string ShipCountry,
    string? ShippingMethod, decimal Subtotal, decimal DiscountTotal, decimal ShippingTotal, decimal TaxTotal, decimal Total,
    string? TrackingCarrier, string? TrackingNumber, string? TrackingUrl, DateTime CreatedAt, bool CanPay,
    string? PaymentInstructions, IReadOnlyList<ShopOrderLineDto> Lines);

public sealed record GetShopOrderQuery(string Slug, string Number, string Token) : IQuery<ShopOrderDto>;
/// <summary>Takes the payment of an approved PayPal order, then returns the order.</summary>
public sealed record CaptureShopPayPalCommand(string Slug, string Number, string Token, string PayPalOrderId) : ICommand<ShopOrderDto>;
/// <summary>Starts card / PayPal payment again for an order that is still unpaid.</summary>
public sealed record StartShopPaymentCommand(string Slug, string Number, string Token, string? Origin) : ICommand<ShopCheckoutResultDto>;
public sealed record ShopStripeWebhookCommand(string Slug, string Payload, string? Signature) : ICommand;

// ── Accounts ──────────────────────────────────────────────────────────────────

public sealed record ShopCustomerDto(Guid Id, string Email, string FirstName, string LastName, string? Phone, bool AcceptsMarketing);
public sealed record ShopAddressDto(Guid Id, string Name, string? Phone, string Line1, string? Line2, string City, string? Region, string? PostalCode, string Country, bool IsDefault);
public sealed record ShopSessionDto(string Token, DateTime ExpiresAt, ShopCustomerDto Customer);
public sealed record ShopAccountDto(ShopCustomerDto Customer, IReadOnlyList<ShopAddressDto> Addresses);
public sealed record ShopOrderSummaryDto(string Number, string AccessToken, string Status, string PaymentStatus, decimal Total, string CurrencyCode, int ItemCount, DateTime CreatedAt);

public sealed record ShopRegisterCommand(string Slug, string Email, string Password, string FirstName, string LastName, string? Phone, bool AcceptsMarketing)
    : ICommand<ShopSessionDto>;

public sealed class ShopRegisterValidator : AbstractValidator<ShopRegisterCommand>
{
    public ShopRegisterValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress().MaximumLength(320);
        RuleFor(x => x.Password).NotEmpty().MinimumLength(8).MaximumLength(100);
        RuleFor(x => x.FirstName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.LastName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Phone).MaximumLength(40);
    }
}

public sealed record ShopSignInCommand(string Slug, string Email, string Password) : ICommand<ShopSessionDto>;
public sealed record GetShopAccountQuery(string Slug, string Token) : IQuery<ShopAccountDto>;
public sealed record GetShopMyOrdersQuery(string Slug, string Token, int Page = 1, int PageSize = 20) : IQuery<PagedResult<ShopOrderSummaryDto>>;

public sealed record UpdateShopAccountCommand(
    string Slug, string Token, string FirstName, string LastName, string? Phone, bool AcceptsMarketing,
    string? CurrentPassword, string? NewPassword) : ICommand<ShopAccountDto>;

public sealed record SaveShopAddressCommand(
    string Slug, string Token, Guid? Id, string Name, string? Phone, string Line1, string? Line2, string City, string? Region,
    string? PostalCode, string Country, bool IsDefault) : ICommand<ShopAddressDto>;

public sealed class SaveShopAddressValidator : AbstractValidator<SaveShopAddressCommand>
{
    public SaveShopAddressValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(150);
        RuleFor(x => x.Line1).NotEmpty().MaximumLength(250);
        RuleFor(x => x.City).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Country).NotEmpty().Length(2);
    }
}

public sealed record DeleteShopAddressCommand(string Slug, string Token, Guid Id) : ICommand;
public sealed record ShopForgotPasswordCommand(string Slug, string Email, string? Origin) : ICommand;
public sealed record ShopResetPasswordCommand(string Slug, string Email, string Token, string NewPassword) : ICommand;
