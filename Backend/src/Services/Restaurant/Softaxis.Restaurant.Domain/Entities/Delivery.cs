namespace Softaxis.Restaurant.Domain.Entities;

/// <summary>A delivery service area — drives the delivery fee/minimum/ETA shown at checkout for an
/// address in that zone. PostalCodesJson is a simple '|'-joined or JSON list of covered postal codes;
/// polygon-based zones are a future refinement, not needed for a first delivery-zone model.</summary>
public sealed class DeliveryZone
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public Guid? BranchId { get; private set; }
    public string Name { get; private set; } = null!;
    public string? PostalCodesJson { get; private set; }
    public decimal DeliveryFee { get; private set; }
    public decimal MinOrderAmount { get; private set; }
    public int EstimatedMinutes { get; private set; }
    public bool IsActive { get; private set; } = true;
    public bool IsDeleted { get; private set; }
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; private set; } = DateTime.UtcNow;

    public DeliveryZone(string name, string? postalCodesJson, decimal deliveryFee, decimal minOrderAmount,
        int estimatedMinutes, Guid? branchId = null)
    {
        Name = name; PostalCodesJson = postalCodesJson; DeliveryFee = deliveryFee;
        MinOrderAmount = minOrderAmount; EstimatedMinutes = estimatedMinutes; BranchId = branchId;
    }

    public void Update(string name, string? postalCodesJson, decimal deliveryFee, decimal minOrderAmount,
        int estimatedMinutes, bool isActive)
    {
        Name = name; PostalCodesJson = postalCodesJson; DeliveryFee = deliveryFee;
        MinOrderAmount = minOrderAmount; EstimatedMinutes = estimatedMinutes; IsActive = isActive;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}

/// <summary>A delivery driver profile. Deliberately thin — a driver is just a restricted-role Identity
/// user (LinkedUserId, optional), not a parallel identity system.</summary>
public sealed class Driver
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public Guid? BranchId { get; private set; }
    public Guid? LinkedUserId { get; private set; }
    public string Name { get; private set; } = null!;
    public string Phone { get; private set; } = null!;
    public string? VehicleInfo { get; private set; }
    public bool IsActive { get; private set; } = true;
    public bool IsDeleted { get; private set; }
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; private set; } = DateTime.UtcNow;

    public Driver(string name, string phone, string? vehicleInfo, Guid? linkedUserId, Guid? branchId = null)
    {
        Name = name; Phone = phone; VehicleInfo = vehicleInfo; LinkedUserId = linkedUserId; BranchId = branchId;
    }

    public void Update(string name, string phone, string? vehicleInfo, bool isActive)
    {
        Name = name; Phone = phone; VehicleInfo = vehicleInfo; IsActive = isActive; UpdatedAt = DateTime.UtcNow;
    }

    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}

/// <summary>Delivery leg of an order — one row per delivery order, linked 1:1 to the Restaurant
/// `Order` it fulfills (OrderId, scalar, no FK). TrackingToken is an unguessable token for the
/// anonymous customer-facing tracking page (mirrors this codebase's Careers/webhook anonymous-endpoint
/// pattern — tenant resolved from the token, not a session).</summary>
public sealed class DeliveryOrder
{
    private static readonly Dictionary<string, string[]> Transitions = new()
    {
        ["assigned"] = ["picked_up", "failed"],
        ["picked_up"] = ["enroute", "failed"],
        ["enroute"] = ["delivered", "failed"],
        ["delivered"] = [],
        ["failed"] = [],
    };

    public Guid Id { get; private set; } = Guid.NewGuid();
    public Guid OrderId { get; private set; }
    public Guid? DeliveryZoneId { get; private set; }
    public Guid? DriverId { get; private set; }
    public string Status { get; private set; } = "assigned"; // assigned/picked_up/enroute/delivered/failed
    public string Address { get; private set; } = null!;
    public string Phone { get; private set; } = null!;
    public DateTime? EstimatedDeliveryAt { get; private set; }
    public DateTime? DeliveredAt { get; private set; }
    public decimal DeliveryFee { get; private set; }
    /// <summary>Set when this delivery came from a plugged-in third-party channel (Talabat/Careem/…)
    /// rather than in-house dispatch — see IDeliveryProvider. Null = in-house/manual.</summary>
    public string? ThirdPartyProvider { get; private set; }
    public string? ThirdPartyOrderRef { get; private set; }
    public string TrackingToken { get; private set; } = Guid.NewGuid().ToString("N");
    public bool IsDeleted { get; private set; }
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; private set; } = DateTime.UtcNow;

    // EF Core materialization ctor — estimatedMinutes below isn't a 1:1 property (it's transformed
    // into EstimatedDeliveryAt), so EF can't bind the public ctor and needs this parameterless one.
    private DeliveryOrder() { }

    public DeliveryOrder(Guid orderId, string address, string phone, decimal deliveryFee,
        Guid? deliveryZoneId, int? estimatedMinutes, string? thirdPartyProvider = null, string? thirdPartyOrderRef = null)
    {
        OrderId = orderId; Address = address; Phone = phone; DeliveryFee = deliveryFee;
        DeliveryZoneId = deliveryZoneId;
        EstimatedDeliveryAt = estimatedMinutes.HasValue ? DateTime.UtcNow.AddMinutes(estimatedMinutes.Value) : null;
        ThirdPartyProvider = thirdPartyProvider; ThirdPartyOrderRef = thirdPartyOrderRef;
    }

    public void AssignDriver(Guid driverId) { DriverId = driverId; UpdatedAt = DateTime.UtcNow; }

    /// <summary>Returns false if the transition isn't legal from the current status.</summary>
    public bool ChangeStatus(string newStatus)
    {
        if (!Transitions.TryGetValue(Status, out var allowed) || !allowed.Contains(newStatus)) return false;
        Status = newStatus;
        if (newStatus == "delivered") DeliveredAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
        return true;
    }

    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}
