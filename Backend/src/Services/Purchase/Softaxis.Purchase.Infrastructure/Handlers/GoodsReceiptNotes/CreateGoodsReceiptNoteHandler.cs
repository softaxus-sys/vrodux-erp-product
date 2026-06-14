using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Purchase.Application.GoodsReceiptNotes.Commands;
using Softaxis.Purchase.Application.GoodsReceiptNotes.Dtos;
using Softaxis.Purchase.Domain.Entities;
using Softaxis.Purchase.Infrastructure.Persistence;

namespace Softaxis.Purchase.Infrastructure.Handlers.GoodsReceiptNotes;

internal sealed class CreateGoodsReceiptNoteHandler(PurchaseDbContext db)
    : ICommandHandler<CreateGoodsReceiptNoteCommand, GoodsReceiptNoteDto>
{
    public async Task<Result<GoodsReceiptNoteDto>> Handle(
        CreateGoodsReceiptNoteCommand cmd, CancellationToken ct)
    {
        var order = await db.PurchaseOrders
            .Include(x => x.Vendor)
            .Include(x => x.Items)
            .FirstOrDefaultAsync(x => x.Id == cmd.PurchaseOrderId, ct);

        if (order is null)
            return Result.Failure<GoodsReceiptNoteDto>(
                Error.Custom("GoodsReceiptNote.NotFound", $"Purchase order '{cmd.PurchaseOrderId}' was not found."));

        if (order.Status is "cancelled")
            return Result.Failure<GoodsReceiptNoteDto>(
                Error.Custom("GoodsReceiptNote.Conflict", "Cannot record a receipt against a cancelled purchase order."));

        var grn = new GoodsReceiptNote(order.Id, order.VendorId, cmd.GrnDate, cmd.DriverName, cmd.Notes);

        foreach (var item in cmd.Items)
            grn.AddItem(item.PurchaseOrderItemId, item.ProductId, item.Description,
                item.OrderedQuantity, item.ReceivedQuantity, item.UnitCost);

        db.GoodsReceiptNotes.Add(grn);

        // Determine cumulative received quantities per PO item across all GRNs (including this one)
        var previousReceived = await db.GoodsReceiptNoteItems
            .Where(i => i.GoodsReceiptNote!.PurchaseOrderId == order.Id
                     && i.GoodsReceiptNote!.Status == "posted"
                     && i.PurchaseOrderItemId != null)
            .GroupBy(i => i.PurchaseOrderItemId)
            .Select(g => new { PurchaseOrderItemId = g.Key, Total = g.Sum(x => x.ReceivedQuantity) })
            .ToListAsync(ct);

        var newReceived = cmd.Items
            .Where(i => i.PurchaseOrderItemId is not null)
            .GroupBy(i => i.PurchaseOrderItemId)
            .Select(g => new { PurchaseOrderItemId = g.Key, Total = g.Sum(x => x.ReceivedQuantity) });

        var cumulative = order.Items.ToDictionary(i => i.Id, i => 0m);
        foreach (var p in previousReceived)
            if (p.PurchaseOrderItemId is { } poiId && cumulative.ContainsKey(poiId))
                cumulative[poiId] += p.Total;
        foreach (var n in newReceived)
            if (n.PurchaseOrderItemId is { } poiId && cumulative.ContainsKey(poiId))
                cumulative[poiId] += n.Total;

        var fullyReceived = order.Items.Count > 0 &&
            order.Items.All(i => cumulative.TryGetValue(i.Id, out var qty) && qty >= i.Quantity);
        var anyReceived = cumulative.Values.Any(q => q > 0);

        var newStatus = fullyReceived ? "received" : anyReceived ? "partial" : order.Status;
        if (newStatus != order.Status)
            order.Update(order.VendorId, order.Notes, order.ExpectedDate, newStatus);

        await db.SaveChangesAsync(ct);

        return Result.Success(new GoodsReceiptNoteDto(
            grn.Id, grn.GrnNumber, grn.PurchaseOrderId, order.OrderNumber,
            grn.VendorId, order.Vendor?.Name ?? "Unknown",
            grn.GrnDate, grn.DriverName, grn.Notes, grn.Status,
            grn.Items.Select(i => new GoodsReceiptNoteItemDto(
                i.Id, i.PurchaseOrderItemId, i.ProductId, i.Description,
                i.OrderedQuantity, i.ReceivedQuantity, i.UnitCost, i.LineTotal)).ToList(),
            grn.CreatedAt, grn.UpdatedAt));
    }
}
