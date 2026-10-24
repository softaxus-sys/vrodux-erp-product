using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Softaxis.BuildingBlocks.Infrastructure.Sync.Branch;
using Softaxis.Restaurant.Domain.Entities;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Common;

/// <summary>
/// On the cloud: hands an order that only reached the cloud (QR / kiosk, Foodpanda) to the branch server
/// that owns the bill, by writing a <see cref="RelayedOrder"/> row that flows down with the ordinary sync.
///
/// <para>
/// <b>Only while the branch is reachable.</b> A branch not heard from for <c>BranchSync:RelayOfflineAfterSeconds</c>
/// (default 120) is treated as offline: the order is refused, so the guest is told to ask staff and Foodpanda
/// gets no acceptance - rather than queueing food for a till that may not see it for hours.
/// </para>
/// See <c>docs/branch-server-design.md</c> §6.4.
/// </summary>
internal sealed class OrderRelay(RestaurantDbContext db, IConfiguration configuration)
{
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private TimeSpan OfflineAfter =>
        TimeSpan.FromSeconds(Math.Max(10, configuration.GetValue("BranchSync:RelayOfflineAfterSeconds", 120)));

    public bool BranchOnline(Guid branchId) => BranchPresence.IsOnline(branchId, OfflineAfter);

    /// <summary>Adds the relay row; the caller saves.</summary>
    public RelayedOrder Queue<T>(Guid id, Guid branchId, string kind, T payload, string? externalRef = null)
    {
        var row = new RelayedOrder(id, branchId, kind, JsonSerializer.Serialize(payload, Json), externalRef);
        db.RelayedOrders.Add(row);
        return row;
    }

    public static T? Read<T>(RelayedOrder row) => JsonSerializer.Deserialize<T>(row.Payload, Json);
}

/// <summary>What a relayed Foodpanda order carries: the raw body (the branch parses it itself) and whether the cloud already accepted it.</summary>
internal sealed record PlatformOrderRelay(string Platform, string Body, bool Accepted);

/// <summary>Foodpanda cancelled an order that lives on the branch.</summary>
internal sealed record PlatformCancelRelay(Guid OrderId, string? Message);
