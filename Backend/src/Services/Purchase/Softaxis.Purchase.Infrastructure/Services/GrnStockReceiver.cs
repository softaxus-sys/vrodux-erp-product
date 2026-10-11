using MediatR;
using Microsoft.AspNetCore.Http;
using Softaxis.Inventory.Application.StockMovements.Commands.CreateStockMovement;
using Softaxis.Inventory.Application.Warehouses.Queries.GetWarehouses;
using Softaxis.Inventory.Domain.Constants;
using Softaxis.Purchase.Domain.Entities;

namespace Softaxis.Purchase.Infrastructure.Services;

/// <summary>What happened to stock when goods were received.</summary>
internal sealed record StockReceiptOutcome(int LinesAdded, string? Note);

/// <summary>
/// Adds received goods to stock. Purchase is sold on its own, so this only runs for a workspace that
/// also has Inventory, and only for lines that point at an inventory product. It sends Inventory's own
/// stock-movement command, so the product total, the warehouse bucket and the movement trail are
/// written by the one handler that owns them. Never throws: the receipt is already saved, and a stock
/// problem is reported back rather than undoing a delivery that really arrived.
/// </summary>
internal sealed class GrnStockReceiver(ISender sender, IHttpContextAccessor http)
{
    public async Task<StockReceiptOutcome> ReceiveAsync(GoodsReceiptNote grn, string orderNumber, CancellationToken ct)
    {
        if (!HasInventory()) return new StockReceiptOutcome(0, null);

        var lines = grn.Items.Where(i => i.ReceivedQuantity > 0).ToList();
        var linked = lines.Where(i => i.ProductId is not null).ToList();
        var unlinked = lines.Count - linked.Count;
        if (linked.Count == 0)
            return new StockReceiptOutcome(0, unlinked > 0
                ? "Stock was not updated: none of the received lines are linked to an inventory product."
                : null);

        Guid? warehouseId = null;
        try
        {
            var wh = await sender.Send(new GetWarehousesQuery(), ct);
            if (wh.IsSuccess)
                warehouseId = wh.Value.Where(w => w.IsActive).OrderByDescending(w => w.IsDefault).ThenBy(w => w.Name)
                    .Select(w => (Guid?)w.Id).FirstOrDefault();
        }
        catch { /* receive without a warehouse bucket rather than not at all */ }

        var added = 0;
        string? firstError = null;
        var failed = 0;
        foreach (var line in linked)
        {
            try
            {
                var r = await sender.Send(new CreateStockMovementCommand(
                    line.ProductId!.Value, MovementTypes.Receipt, line.ReceivedQuantity, line.UnitCost,
                    grn.GrnNumber, $"Received against {orderNumber}", warehouseId), ct);
                if (r.IsSuccess) added++;
                else { failed++; firstError ??= r.Error.Description; }
            }
            catch (Exception ex) { failed++; firstError ??= ex.Message; }
        }

        var notes = new List<string>();
        if (failed > 0) notes.Add($"{failed} line(s) could not be added to stock ({firstError}).");
        if (unlinked > 0) notes.Add($"{unlinked} line(s) are not linked to an inventory product, so their stock was not changed.");
        return new StockReceiptOutcome(added, notes.Count == 0 ? null : string.Join(" ", notes));
    }

    /// <summary>The licensed modules ride in the token. No token (a background caller) means do nothing.</summary>
    private bool HasInventory()
    {
        var user = http.HttpContext?.User;
        if (user?.Identity?.IsAuthenticated != true) return false;
        if (string.Equals(user.FindFirst("is_super_admin")?.Value, "true", StringComparison.OrdinalIgnoreCase)) return true;
        var modules = user.FindFirst("modules")?.Value ?? "";
        return modules.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Contains("inventory", StringComparer.OrdinalIgnoreCase);
    }
}
