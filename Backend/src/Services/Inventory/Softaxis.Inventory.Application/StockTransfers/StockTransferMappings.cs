using Softaxis.Inventory.Application.StockTransfers.Dtos;
using Softaxis.Inventory.Domain.Entities;

namespace Softaxis.Inventory.Application.StockTransfers;

internal static class StockTransferMappings
{
    public static StockTransferDto ToDto(StockTransfer t) => new(
        t.Id, t.TransferNumber, t.FromWarehouseId, t.FromWarehouseName,
        t.ToWarehouseId, t.ToWarehouseName, t.Status, t.RequestedBy, t.ApprovedBy,
        t.RequestDate, t.ExpectedDate, t.ReceivedDate,
        t.Items.Select(i => new StockTransferItemDto(i.Id, i.StockItemId, i.ItemName, i.Sku, i.Quantity, i.UnitCost, i.Total)).ToList(),
        t.TotalValue, t.Notes ?? "", t.CreatedAt, t.UpdatedAt);
}
