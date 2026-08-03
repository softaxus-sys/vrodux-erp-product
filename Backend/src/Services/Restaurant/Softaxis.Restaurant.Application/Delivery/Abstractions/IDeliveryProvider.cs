using Softaxis.BuildingBlocks.Domain.Results;

namespace Softaxis.Restaurant.Application.Delivery.Abstractions;

/// <summary>One request to hand a delivery off to a dispatch channel (in-house driver pool, or a
/// third-party platform like Talabat/Careem/Deliveroo/Uber Eats).</summary>
public sealed record DeliveryDispatchRequest(Guid DeliveryOrderId, string Address, string Phone, decimal OrderTotal);

public sealed record DeliveryDispatchResult(string? ThirdPartyOrderRef);

/// <summary>
/// Plug-in dispatch channel for a delivery order — same provider-registry pattern as CRM's Module 7
/// lead-integration framework (one interface, one class + one DI line per platform). "Manual" (in-house
/// driver pool) is the only channel with real credentials needed; the rest are catalog stubs
/// (IsAvailable = false) until a tenant's third-party API keys are configured — mirrors the Visa
/// module's "coming_soon" government-channel pattern.
/// </summary>
public interface IDeliveryProvider
{
    string Key { get; }
    string DisplayName { get; }
    bool IsAvailable { get; }
    Task<Result<DeliveryDispatchResult>> DispatchAsync(DeliveryDispatchRequest request, CancellationToken ct);
}
