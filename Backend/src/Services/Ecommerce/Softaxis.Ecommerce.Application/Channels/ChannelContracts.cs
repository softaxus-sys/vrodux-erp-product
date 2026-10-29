using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.Ecommerce.Application.Abstractions;

namespace Softaxis.Ecommerce.Application.Channels;

// ── DTOs ──────────────────────────────────────────────────────────────────────

public sealed record ChannelDto(
    Guid Id, string Kind, string Name, string ShopDomain, string Status,
    string? LocationId, string? LocationName, string? CurrencyCode,
    bool SyncStock, bool SyncContent, bool ImportOrders,
    DateTime? LastSyncAt, string? LastError, int ConsecutiveFailures,
    int LiveListings, int FailedListings, int Orders, DateTime CreatedAt);

public sealed record ListingDto(
    Guid Id, Guid ChannelId, string ChannelName, Guid TemplateId, string TemplateName,
    string? ExternalProductId, string? AdminUrl, string Status, string? LastError,
    DateTime? LastSyncedAt, int VariantCount, DateTime CreatedAt);

public sealed record OrderLineDto(string Title, string? Sku, decimal Quantity, decimal UnitPrice, Guid? ProductId, bool StockTaken, bool StockReturned);

public sealed record ChannelOrderDto(
    Guid Id, Guid ChannelId, string ChannelName, string ExternalId, string OrderNumber, string Status,
    string? CustomerName, string? Email, string? FinancialStatus, string? FulfillmentStatus,
    decimal Total, string? CurrencyCode, DateTime PlacedAt, DateTime ImportedAt, string? Note,
    IReadOnlyList<OrderLineDto> Lines);

public sealed record LocationDto(string Id, string Name, bool Active);

public sealed record TemplateLookupDto(Guid Id, string Name, int VariantCount, decimal TotalStock, bool PublishedOnline, bool IsActive);

/// <summary>What a sync pass did. Errors are per item so one bad product does not hide the rest.</summary>
public sealed record SyncResultDto(int ProductsPushed, int StockUpdates, int OrdersImported, int OrdersCancelled, IReadOnlyList<string> Errors);

// ── Queries ───────────────────────────────────────────────────────────────────

public sealed record GetProvidersQuery : IQuery<IReadOnlyList<ProviderInfo>>;
public sealed record GetChannelsQuery : IQuery<IReadOnlyList<ChannelDto>>;
public sealed record GetChannelByIdQuery(Guid Id) : IQuery<ChannelDto>;
public sealed record GetChannelLocationsQuery(Guid Id) : IQuery<IReadOnlyList<LocationDto>>;
public sealed record GetListingsQuery(Guid? ChannelId, Guid? TemplateId = null) : IQuery<IReadOnlyList<ListingDto>>;
public sealed record GetChannelOrdersQuery(Guid? ChannelId, string? Search = null, string? Status = null, int Page = 1, int PageSize = 25)
    : IQuery<PagedResult<ChannelOrderDto>>;
public sealed record SearchTemplatesQuery(string? Search) : IQuery<IReadOnlyList<TemplateLookupDto>>;

// ── Commands ──────────────────────────────────────────────────────────────────

/// <param name="ShopDomain">The shop's own address, e.g. <c>my-shop.myshopify.com</c>.</param>
/// <param name="AccessToken">The Admin API access token of a custom app the shop owner created.</param>
public sealed record ConnectChannelCommand(string Kind, string Name, string ShopDomain, string AccessToken) : ICommand<ChannelDto>;

public sealed class ConnectChannelValidator : AbstractValidator<ConnectChannelCommand>
{
    public ConnectChannelValidator()
    {
        RuleFor(x => x.Kind).NotEmpty().MaximumLength(30);
        RuleFor(x => x.Name).NotEmpty().MaximumLength(150);
        RuleFor(x => x.ShopDomain).NotEmpty().MaximumLength(200);
        RuleFor(x => x.AccessToken).NotEmpty().MaximumLength(500);
    }
}

public sealed record UpdateChannelCommand(
    Guid Id, string Name, bool SyncStock, bool SyncContent, bool ImportOrders, string? LocationId, bool Paused) : ICommand<ChannelDto>;

public sealed class UpdateChannelValidator : AbstractValidator<UpdateChannelCommand>
{
    public UpdateChannelValidator() { RuleFor(x => x.Name).NotEmpty().MaximumLength(150); }
}

public sealed record ReplaceChannelTokenCommand(Guid Id, string AccessToken) : ICommand<ChannelDto>;

/// <summary>Disconnects the store. Products already created in it are left there; only the link is removed.</summary>
public sealed record DeleteChannelCommand(Guid Id) : ICommand;

/// <param name="ResetStock">Set every variant's stock in the store to Inventory's figure instead of sending only the changes.</param>
public sealed record SyncChannelCommand(Guid Id, bool ResetStock = false) : ICommand<SyncResultDto>;

public sealed record PublishListingCommand(Guid ChannelId, Guid TemplateId) : ICommand<ListingDto>;
public sealed record SyncListingCommand(Guid ListingId) : ICommand<ListingDto>;

/// <summary>Hides the product in the store (draft) without deleting it.</summary>
public sealed record UnpublishListingCommand(Guid ListingId) : ICommand<ListingDto>;

/// <param name="DeleteInStore">Also delete the product in the store. Otherwise it is only unlinked and stays there.</param>
public sealed record RemoveListingCommand(Guid ListingId, bool DeleteInStore) : ICommand;

public sealed record ImportChannelOrdersCommand(Guid ChannelId) : ICommand<SyncResultDto>;
