using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Manufacturing.Application.Abstractions;
using Softaxis.Manufacturing.Application.ProductionOrders.Dtos;
using Softaxis.Manufacturing.Domain.Entities;
using Softaxis.Manufacturing.Infrastructure.Persistence;

namespace Softaxis.Manufacturing.Infrastructure.Handlers.ProductionOrders;

internal static class ProductionOrderSupport
{
    public static IQueryable<ProductionOrder> WithDetail(IQueryable<ProductionOrder> orders) =>
        orders.Include(o => o.Components).Include(o => o.Operations)
              .Include(o => o.Outputs).Include(o => o.Issues).AsSplitQuery();

    public static Task<ProductionOrder?> LoadAsync(ManufacturingDbContext db, Guid id, CancellationToken ct) =>
        WithDetail(db.ProductionOrders).FirstOrDefaultAsync(o => o.Id == id && !o.IsDeleted, ct);

    /// <summary>
    /// The BOM's routing scaled to an order: setup once, run time once per batch. A fraction of a
    /// batch still takes its share of run time.
    /// </summary>
    public static List<ProductionOrderOperation> BuildOperations(
        Guid orderId, IEnumerable<BomOperation> bomOperations, decimal batches) =>
        bomOperations.OrderBy(o => o.Sequence).Select(o => new ProductionOrderOperation(
            orderId, o.Sequence, o.Name, o.WorkCentreId, o.WorkCentreName,
            Math.Round(o.SetupMinutes + o.RunMinutesPerBatch * batches, 2), o.LabourRate, o.OverheadRate)).ToList();

    public static List<ProductionOrderOutput> BuildOutputs(
        Guid orderId, IEnumerable<BomByProduct> byProducts, decimal batches) =>
        byProducts.Select(b => new ProductionOrderOutput(
            orderId, b.ProductId, b.ProductName, b.ProductSku, b.Unit, Math.Round(b.Quantity * batches, 4))).ToList();

    public static Error NotFound(Guid id) => Error.NotFoundById("ProductionOrder", id);

    public static Error Transition(string message) => Error.Custom("ProductionOrder.InvalidTransition", message);

    public static ProductionOrderSummaryDto ToSummary(ProductionOrder o) => new(
        o.Id, o.OrderNumber, o.BomNumber, o.ProductId, o.ProductName, o.ProductSku, o.PlannedQuantity,
        o.ProducedQuantity, o.ScrappedQuantity, o.Unit, o.Status, o.WarehouseName, o.PlannedStartDate,
        o.DueDate, o.Reference, o.MaterialCost, o.LabourCost, o.OverheadCost, o.TotalCost, o.UnitCost,
        o.ParentOrderNumber, o.JournalEntryId != null, o.CreatedAt, o.CompletedAt);

    /// <summary>
    /// Maps an order, adding what each component can draw from stock while the order is still
    /// open. A finished or cancelled order skips the lookups.
    /// </summary>
    public static async Task<ProductionOrderDto> ToDtoAsync(
        ManufacturingDbContext db, ProductionOrder o, IManufacturingStock stock, CancellationToken ct)
    {
        var open = o.Status is ProductionOrderStatus.Planned or ProductionOrderStatus.Released
            or ProductionOrderStatus.InProgress;

        var components = new List<ProductionOrderComponentDto>(o.Components.Count);
        foreach (var c in o.Components.OrderBy(c => c.SortOrder))
        {
            decimal? onHand = open ? await stock.GetAvailableAsync(c.ProductId, o.WarehouseId, ct) : null;
            components.Add(new ProductionOrderComponentDto(c.Id, c.ProductId, c.Name, c.Sku,
                c.RequiredQuantity, c.IssuedQuantity, c.RemainingQuantity, c.Unit, c.UnitCost, onHand, c.SortOrder));
        }

        var subOrders = await db.ProductionOrders.AsNoTracking()
            .Where(s => s.ParentOrderId == o.Id && !s.IsDeleted)
            .OrderBy(s => s.CreatedAt)
            .Select(s => new SubOrderDto(s.Id, s.OrderNumber, s.ProductName, s.PlannedQuantity, s.Unit, s.Status))
            .ToListAsync(ct);

        return new ProductionOrderDto(
            o.Id, o.OrderNumber, o.BomId, o.BomNumber, o.ProductId, o.ProductName, o.ProductSku,
            o.PlannedQuantity, o.ProducedQuantity, o.ScrappedQuantity, o.Unit, o.Status, o.WarehouseId,
            o.WarehouseName, o.PlannedStartDate, o.DueDate, o.Reference, o.Notes, o.QualityNotes,
            o.MaterialCost, o.LabourCost, o.OverheadCost, o.TotalCost, o.UnitCost,
            o.ScrapCost, o.BatchNumber, o.ExpiryDate, o.RequisitionNumber, o.ParentOrderId, o.ParentOrderNumber,
            o.JournalEntryId, o.JournalEntryNumber,
            o.CreatedAt, o.ReleasedAt, o.StartedAt, o.CompletedAt, components,
            o.Operations.OrderBy(op => op.Sequence).Select(op => new ProductionOrderOperationDto(
                op.Id, op.Sequence, op.Name, op.WorkCentreName, op.PlannedMinutes, op.ActualMinutes,
                op.IsDone, op.LabourCost, op.OverheadCost)).ToList(),
            o.Outputs.OrderBy(x => x.Name).Select(x => new ProductionOrderOutputDto(
                x.Id, x.ProductId, x.Name, x.Sku, x.Unit, x.PlannedQuantity, x.ReceivedQuantity)).ToList(),
            o.Issues.OrderByDescending(i => i.CreatedAt).Select(i => new MaterialIssueDto(
                i.Id, i.ProductName, i.Quantity, i.BatchNumber, i.CreatedAt)).ToList(),
            subOrders);
    }

    /// <summary>
    /// Issues the requested quantities (or, when <paramref name="requested"/> is empty, everything
    /// still outstanding) out of Inventory.
    /// <para>
    /// Stock is checked for every line before anything moves, so a shortage is reported once and
    /// nothing is issued. The movements themselves are separate Inventory transactions: each one
    /// that succeeds is recorded on the order and saved straight away, so a failure part-way
    /// leaves the order showing exactly what was taken and the rest can be retried.
    /// </para>
    /// </summary>
    public static async Task<Result> IssueAsync(
        ManufacturingDbContext db, IManufacturingStock stock, ProductionOrder order,
        IReadOnlyList<(Guid ComponentId, decimal Quantity, string? BatchNumber)>? requested, CancellationToken ct)
    {
        var plan = new List<(ProductionOrderComponent Component, decimal Quantity, string? Batch)>();

        if (requested is null || requested.Count == 0)
        {
            plan.AddRange(order.Components.Where(c => c.RemainingQuantity > 0)
                .OrderBy(c => c.SortOrder).Select(c => (c, c.RemainingQuantity, (string?)null)));
        }
        else
        {
            // Same component from two batches stays as two movements; the stock check adds them up.
            foreach (var line in requested)
            {
                var component = order.Components.FirstOrDefault(c => c.Id == line.ComponentId);
                if (component is null)
                    return Result.Failure(Error.Custom("ProductionOrder.Component.NotFound",
                        "One of the components is not on this production order."));
                plan.Add((component, line.Quantity, line.BatchNumber));
            }
        }

        if (plan.Count == 0) return Result.Success();

        var shortages = new List<string>();
        foreach (var group in plan.GroupBy(p => p.Component))
        {
            var needed    = group.Sum(p => p.Quantity);
            var available = await stock.GetAvailableAsync(group.Key.ProductId, order.WarehouseId, ct);
            if (available is null)
                shortages.Add($"{group.Key.Name} is no longer in Inventory");
            else if (available < needed)
                shortages.Add($"{group.Key.Name}: need {needed:0.####} {group.Key.Unit}, {available:0.####} available");
        }

        if (shortages.Count > 0)
            return Result.Failure(Error.Custom("ProductionOrder.Stock.Conflict",
                "Not enough stock to issue. " + string.Join("; ", shortages) + "."));

        foreach (var (component, quantity, batch) in plan)
        {
            var moved = await stock.IssueAsync(component.ProductId, quantity, component.UnitCost,
                order.WarehouseId, order.OrderNumber, batch, ct);
            if (moved.IsFailure)
                return Result.Failure(Error.Custom("ProductionOrder.Stock.Conflict",
                    $"Could not issue {component.Name}: {moved.Error.Description}"));

            db.ProductionMaterialIssues.Add(order.RecordIssue(component, quantity, batch));
            await db.SaveChangesAsync(ct);
        }

        return Result.Success();
    }
}
