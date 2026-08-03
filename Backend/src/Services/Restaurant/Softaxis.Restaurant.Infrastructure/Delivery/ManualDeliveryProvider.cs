using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.Delivery.Abstractions;

namespace Softaxis.Restaurant.Infrastructure.Delivery;

/// <summary>In-house dispatch — the driver pool managed via the Drivers screen. Always available,
/// never produces a third-party reference (DeliveryOrder.ThirdPartyProvider stays null).</summary>
internal sealed class ManualDeliveryProvider : IDeliveryProvider
{
    public string Key => "manual";
    public string DisplayName => "In-House Delivery";
    public bool IsAvailable => true;

    public Task<Result<DeliveryDispatchResult>> DispatchAsync(DeliveryDispatchRequest request, CancellationToken ct) =>
        Task.FromResult(Result.Success(new DeliveryDispatchResult(null)));
}

/// <summary>Catalog placeholder for a third-party platform with no configured credentials yet — the
/// registry lists it (so the UI can show a "coming soon" card) but dispatch always fails clearly
/// rather than silently pretending to work.</summary>
internal sealed class StubDeliveryProvider(string key, string displayName) : IDeliveryProvider
{
    public string Key => key;
    public string DisplayName => displayName;
    public bool IsAvailable => false;

    public Task<Result<DeliveryDispatchResult>> DispatchAsync(DeliveryDispatchRequest request, CancellationToken ct) =>
        Task.FromResult(Result.Failure<DeliveryDispatchResult>(
            Error.Custom("Delivery.NotConfigured", $"{displayName} isn't configured for this tenant yet.")));
}
