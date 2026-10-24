namespace Softaxis.Restaurant.Domain.Entities;

/// <summary>
/// An order that arrived at the CLOUD for a branch that runs on its own server: a QR / kiosk order from a
/// guest's phone, a Foodpanda order, or a Foodpanda cancellation. Those only ever reach the cloud (public
/// webhooks and the public ordering page), but the bill must be written at the branch, which owns it.
///
/// <para>
/// Owned by the CLOUD: written when the order arrives, flows DOWN. The branch creates the bill from it,
/// using <see cref="Id"/> as the order's id so the cloud could already give that id to the guest or to
/// Foodpanda. What happened is a separate row (<see cref="RelayedOrderResult"/>, owned by the branch, flows
/// UP). Same split as <see cref="BranchInstruction"/>. See <c>docs/branch-server-design.md</c> §6.4.
/// </para>
/// </summary>
public sealed class RelayedOrder
{
    public const string QrOrder          = "qr_order";
    public const string PlatformOrder    = "platform_order";
    public const string PlatformCancel   = "platform_cancel";

    private RelayedOrder() { }

    public RelayedOrder(Guid id, Guid branchId, string kind, string payload, string? externalRef = null)
    {
        Id = id; BranchId = branchId; Kind = kind; Payload = payload; ExternalRef = externalRef; ReceivedAt = DateTime.UtcNow;
    }

    /// <summary>For an order: the id the bill is created with. For a cancellation: a fresh id.</summary>
    public Guid Id { get; private set; }
    public Guid BranchId { get; private set; }
    public string Kind { get; private set; } = string.Empty;

    /// <summary>JSON - what the branch needs to build the bill (see <c>RelayPayloads</c>).</summary>
    public string Payload { get; private set; } = string.Empty;
    public DateTime ReceivedAt { get; private set; }

    /// <summary>The platform's own order token (Foodpanda), so a resent order is not queued twice.</summary>
    public string? ExternalRef { get; private set; }
}

/// <summary>What the branch did with a relayed order. One row per relayed order (same id), written only by the branch.</summary>
public sealed class RelayedOrderResult
{
    public const string Applied  = "applied";
    public const string Rejected = "rejected";

    private RelayedOrderResult() { }

    public RelayedOrderResult(Guid relayId, Guid branchId, bool success, string? orderNumber, string? message)
    {
        Id = relayId; BranchId = branchId;
        Status = success ? Applied : Rejected;
        OrderNumber = orderNumber;
        Message = message is { Length: > 500 } ? message[..500] : message;
        UpdatedAt = DateTime.UtcNow;
    }

    public Guid Id { get; private set; }
    public Guid BranchId { get; private set; }
    public string Status { get; private set; } = Applied;
    public string? OrderNumber { get; private set; }
    public string? Message { get; private set; }
    public DateTime UpdatedAt { get; private set; }
}

/// <summary>
/// A Foodpanda action taken at a branch's till - accept, reject, hand over. Only the cloud holds the
/// Foodpanda credentials, so the branch asks and the cloud calls Foodpanda. Owned by the BRANCH (flows UP);
/// the cloud's answer is <see cref="PlatformActionResult"/> (flows DOWN).
/// </summary>
public sealed class PlatformActionRequest
{
    public const string Accept   = "accept";
    public const string Reject   = "reject";
    public const string HandOver = "handover";

    private PlatformActionRequest() { }

    public PlatformActionRequest(Guid branchId, Guid orderId, string action, int? prepMinutes, string? reason, string? message)
    {
        Id = Guid.NewGuid(); BranchId = branchId; OrderId = orderId; Action = action;
        PrepMinutes = prepMinutes; Reason = reason; Message = message; RequestedAt = DateTime.UtcNow;
    }

    public Guid Id { get; private set; }
    public Guid BranchId { get; private set; }
    public Guid OrderId { get; private set; }
    public string Action { get; private set; } = string.Empty;
    public int? PrepMinutes { get; private set; }
    public string? Reason { get; private set; }
    public string? Message { get; private set; }
    public DateTime RequestedAt { get; private set; }
}

/// <summary>The cloud's answer to a <see cref="PlatformActionRequest"/> (same id).</summary>
public sealed class PlatformActionResult
{
    public const string Done   = "done";
    public const string Failed = "failed";

    private PlatformActionResult() { }

    public PlatformActionResult(Guid requestId, Guid branchId, bool success, string? message)
    {
        Id = requestId; BranchId = branchId; Status = success ? Done : Failed;
        Message = message is { Length: > 500 } ? message[..500] : message;
        UpdatedAt = DateTime.UtcNow;
    }

    public Guid Id { get; private set; }
    public Guid BranchId { get; private set; }
    public string Status { get; private set; } = Done;
    public string? Message { get; private set; }
    public DateTime UpdatedAt { get; private set; }
}
