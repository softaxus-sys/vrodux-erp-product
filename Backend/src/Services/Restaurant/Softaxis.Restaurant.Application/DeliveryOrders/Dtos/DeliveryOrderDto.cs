namespace Softaxis.Restaurant.Application.DeliveryOrders.Dtos;

public sealed record DeliveryOrderDto(
    Guid Id, Guid OrderId, string OrderNumber, decimal OrderTotal,
    Guid? DeliveryZoneId, string? DeliveryZoneName, Guid? DriverId, string? DriverName,
    string Status, string Address, string Phone, DateTime? EstimatedDeliveryAt, DateTime? DeliveredAt,
    decimal DeliveryFee, string? ThirdPartyProvider, string? ThirdPartyOrderRef, string TrackingToken, DateTime CreatedAt);

public sealed record DeliverySummaryDto(int Total, int Assigned, int PickedUp, int Enroute, int Delivered, int Failed);

public sealed record DeliveryProviderDto(string Key, string DisplayName, bool IsAvailable);

/// <summary>Public, anonymous-safe shape for the customer tracking page — no internal ids beyond
/// what the token itself already grants access to.</summary>
public sealed record DeliveryTrackingDto(
    string OrderNumber, string Status, string? DriverName, DateTime? EstimatedDeliveryAt, DateTime? DeliveredAt, string Address);
