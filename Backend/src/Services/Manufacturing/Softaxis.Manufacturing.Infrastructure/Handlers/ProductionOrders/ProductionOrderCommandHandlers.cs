using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Manufacturing.Application.Abstractions;
using Softaxis.Manufacturing.Application.ProductionOrders.Commands;
using Softaxis.Manufacturing.Application.ProductionOrders.Dtos;
using Softaxis.Manufacturing.Domain.Entities;
using Softaxis.Manufacturing.Infrastructure.Persistence;

namespace Softaxis.Manufacturing.Infrastructure.Handlers.ProductionOrders;

internal sealed class CreateProductionOrderHandler(ManufacturingDbContext db, IManufacturingStock stock)
    : ICommandHandler<CreateProductionOrderCommand, ProductionOrderDto>
{
    /// <summary>A product structure deeper than this is almost certainly a BOM that refers back to itself.</summary>
    private const int MaxDepth = 6;

    public async Task<Result<ProductionOrderDto>> Handle(CreateProductionOrderCommand cmd, CancellationToken ct)
    {
        var warehouse = await WarehouseResolver.ResolveAsync(stock, cmd.WarehouseId, ct);
        if (warehouse.IsFailure) return Result.Failure<ProductionOrderDto>(warehouse.Error);

        var created = await PlanAsync(cmd.BomId, cmd.PlannedQuantity, cmd.WarehouseId, warehouse.Value,
            cmd.PlannedStartDate, cmd.DueDate, cmd.Reference, cmd.Notes, parent: null,
            cmd.PlanSubAssemblies, depth: 0, [], ct);
        if (created.IsFailure) return Result.Failure<ProductionOrderDto>(created.Error);

        await db.SaveChangesAsync(ct);
        return Result.Success(await ProductionOrderSupport.ToDtoAsync(db, created.Value, stock, ct));
    }

    /// <summary>
    /// Builds one order and, when asked, an order for each manufactured component that stock does
    /// not cover. Everything is added to the context and saved together by the caller, so a
    /// structure is planned whole or not at all.
    /// </summary>
    private async Task<Result<ProductionOrder>> PlanAsync(
        Guid bomId, decimal quantity, Guid? warehouseId, string? warehouseName, string? startDate, string? dueDate,
        string? reference, string? notes, ProductionOrder? parent, bool planSubAssemblies, int depth,
        HashSet<Guid> productsAbove, CancellationToken ct)
    {
        var bom = await db.Boms.AsNoTracking()
            .Include(b => b.Lines).Include(b => b.Operations).Include(b => b.ByProducts).AsSplitQuery()
            .FirstOrDefaultAsync(b => b.Id == bomId && !b.IsDeleted, ct);
        if (bom is null) return Result.Failure<ProductionOrder>(Error.NotFoundById("Bom", bomId));

        if (bom.Status != BomStatus.Active)
            return Result.Failure<ProductionOrder>(Error.Custom("ProductionOrder.Conflict",
                $"Bill of materials {bom.BomNumber} is {bom.Status}. Activate it before planning production."));

        var order = new ProductionOrder(bom.Id, bom.BomNumber, bom.ProductId, bom.ProductName, bom.ProductSku,
            quantity, bom.Unit, warehouseId, warehouseName, startDate, dueDate, reference, notes);
        if (parent is not null) order.SetParent(parent.Id, parent.OrderNumber);

        // Scale the BOM (written for one batch) to the planned quantity, at today's cost.
        var batches    = quantity / bom.OutputQuantity;
        var components = new List<ProductionOrderComponent>(bom.Lines.Count);
        foreach (var line in bom.Lines.OrderBy(l => l.SortOrder))
        {
            var item = await stock.GetItemAsync(line.ComponentProductId, ct);
            components.Add(new ProductionOrderComponent(order.Id, line.ComponentProductId, line.ComponentName,
                line.ComponentSku, Math.Round(line.EffectiveQuantity * batches, 4), line.Unit,
                item?.CostPrice ?? line.UnitCost, line.SortOrder));
        }
        order.ReplaceComponents(components);
        order.ReplaceOperations(ProductionOrderSupport.BuildOperations(order.Id, bom.Operations, batches));
        order.ReplaceOutputs(ProductionOrderSupport.BuildOutputs(order.Id, bom.ByProducts, batches));
        db.ProductionOrders.Add(order);

        if (!planSubAssemblies || depth >= MaxDepth) return Result.Success(order);

        var above = new HashSet<Guid>(productsAbove) { bom.ProductId };
        foreach (var component in components)
        {
            // A component that is one of its own ancestors would plan itself for ever.
            if (above.Contains(component.ProductId)) continue;

            var childBom = await db.Boms.AsNoTracking()
                .Where(b => b.ProductId == component.ProductId && !b.IsDeleted && b.Status == BomStatus.Active)
                .OrderByDescending(b => b.CreatedAt).Select(b => new { b.Id }).FirstOrDefaultAsync(ct);
            if (childBom is null) continue;   // bought in, not made

            var available = await stock.GetAvailableAsync(component.ProductId, warehouseId, ct) ?? 0;
            var shortage  = component.RequiredQuantity - available;
            if (shortage <= 0) continue;

            // The sub-assembly has to be ready when the parent starts.
            var child = await PlanAsync(childBom.Id, shortage, warehouseId, warehouseName, startDate,
                startDate ?? dueDate, order.OrderNumber, null, order, true, depth + 1, above, ct);
            if (child.IsFailure) return child;
        }

        return Result.Success(order);
    }
}

internal sealed class UpdateProductionOrderHandler(ManufacturingDbContext db, IManufacturingStock stock)
    : ICommandHandler<UpdateProductionOrderCommand, ProductionOrderDto>
{
    public async Task<Result<ProductionOrderDto>> Handle(UpdateProductionOrderCommand cmd, CancellationToken ct)
    {
        var order = await ProductionOrderSupport.LoadAsync(db, cmd.Id, ct);
        if (order is null) return Result.Failure<ProductionOrderDto>(ProductionOrderSupport.NotFound(cmd.Id));

        if (order.Status != ProductionOrderStatus.Planned)
            return Result.Failure<ProductionOrderDto>(ProductionOrderSupport.Transition(
                "Only a planned order can be changed. This one has already been released."));

        var warehouse = await WarehouseResolver.ResolveAsync(stock, cmd.WarehouseId, ct);
        if (warehouse.IsFailure) return Result.Failure<ProductionOrderDto>(warehouse.Error);

        if (cmd.PlannedQuantity != order.PlannedQuantity)
        {
            // Components scale with the quantity. Scaling the order's own copy (not re-reading the
            // BOM) keeps it on the recipe it was planned with.
            var ratio  = cmd.PlannedQuantity / order.PlannedQuantity;
            var scaled = order.Components.Select(c => new ProductionOrderComponent(order.Id, c.ProductId,
                c.Name, c.Sku, Math.Round(c.RequiredQuantity * ratio, 4), c.Unit, c.UnitCost, c.SortOrder)).ToList();
            db.ProductionOrderComponents.RemoveRange(order.Components);
            order.ReplaceComponents(scaled);
            db.ProductionOrderComponents.AddRange(scaled);

            var outputs = order.Outputs.Select(x => new ProductionOrderOutput(order.Id, x.ProductId, x.Name,
                x.Sku, x.Unit, Math.Round(x.PlannedQuantity * ratio, 4))).ToList();
            db.ProductionOrderOutputs.RemoveRange(order.Outputs);
            order.ReplaceOutputs(outputs);
            db.ProductionOrderOutputs.AddRange(outputs);

            // Routing time is setup + run-per-batch, so it cannot be scaled by a plain ratio —
            // it is rebuilt from the BOM. If the BOM has since been deleted the times stay as planned.
            var bom = await db.Boms.AsNoTracking().Include(b => b.Operations)
                .FirstOrDefaultAsync(b => b.Id == order.BomId && !b.IsDeleted, ct);
            if (bom is not null && bom.OutputQuantity > 0)
            {
                var operations = ProductionOrderSupport.BuildOperations(
                    order.Id, bom.Operations, cmd.PlannedQuantity / bom.OutputQuantity);
                db.ProductionOrderOperations.RemoveRange(order.Operations);
                order.ReplaceOperations(operations);
                db.ProductionOrderOperations.AddRange(operations);
            }
        }

        order.UpdatePlan(cmd.PlannedQuantity, cmd.WarehouseId, warehouse.Value, cmd.PlannedStartDate,
            cmd.DueDate, cmd.Reference, cmd.Notes);

        await db.SaveChangesAsync(ct);
        return Result.Success(await ProductionOrderSupport.ToDtoAsync(db, order, stock, ct));
    }
}

internal sealed class ReleaseProductionOrderHandler(ManufacturingDbContext db, IManufacturingStock stock)
    : ICommandHandler<ReleaseProductionOrderCommand, ProductionOrderDto>
{
    public async Task<Result<ProductionOrderDto>> Handle(ReleaseProductionOrderCommand cmd, CancellationToken ct)
    {
        var order = await ProductionOrderSupport.LoadAsync(db, cmd.Id, ct);
        if (order is null) return Result.Failure<ProductionOrderDto>(ProductionOrderSupport.NotFound(cmd.Id));

        if (!order.Release())
            return Result.Failure<ProductionOrderDto>(ProductionOrderSupport.Transition(
                "Only a planned order can be released."));

        await db.SaveChangesAsync(ct);
        return Result.Success(await ProductionOrderSupport.ToDtoAsync(db, order, stock, ct));
    }
}

internal sealed class IssueMaterialsHandler(ManufacturingDbContext db, IManufacturingStock stock)
    : ICommandHandler<IssueMaterialsCommand, ProductionOrderDto>
{
    public async Task<Result<ProductionOrderDto>> Handle(IssueMaterialsCommand cmd, CancellationToken ct)
    {
        var order = await ProductionOrderSupport.LoadAsync(db, cmd.Id, ct);
        if (order is null) return Result.Failure<ProductionOrderDto>(ProductionOrderSupport.NotFound(cmd.Id));

        if (!order.CanIssue)
            return Result.Failure<ProductionOrderDto>(ProductionOrderSupport.Transition(
                order.Status == ProductionOrderStatus.Planned
                    ? "Release the order before issuing materials."
                    : $"Materials cannot be issued to a {order.Status} order."));

        var issued = await ProductionOrderSupport.IssueAsync(db, stock, order,
            cmd.Lines?.Select(l => (l.ComponentId, l.Quantity, l.BatchNumber)).ToList(), ct);
        if (issued.IsFailure) return Result.Failure<ProductionOrderDto>(issued.Error);

        return Result.Success(await ProductionOrderSupport.ToDtoAsync(db, order, stock, ct));
    }
}

internal sealed class ReturnMaterialsHandler(ManufacturingDbContext db, IManufacturingStock stock)
    : ICommandHandler<ReturnMaterialsCommand, ProductionOrderDto>
{
    public async Task<Result<ProductionOrderDto>> Handle(ReturnMaterialsCommand cmd, CancellationToken ct)
    {
        var order = await ProductionOrderSupport.LoadAsync(db, cmd.Id, ct);
        if (order is null) return Result.Failure<ProductionOrderDto>(ProductionOrderSupport.NotFound(cmd.Id));

        if (!order.CanIssue)
            return Result.Failure<ProductionOrderDto>(ProductionOrderSupport.Transition(
                $"Materials cannot be returned from a {order.Status} order."));

        // Check every line first, so a bad one stops the whole return before any stock moves.
        var plan = new List<(ProductionOrderComponent Component, decimal Quantity, string? Batch)>();
        foreach (var line in cmd.Lines)
        {
            var component = order.Components.FirstOrDefault(c => c.Id == line.ComponentId);
            if (component is null)
                return Result.Failure<ProductionOrderDto>(Error.Custom("ProductionOrder.Component.NotFound",
                    "One of the components is not on this production order."));
            plan.Add((component, line.Quantity, line.BatchNumber));
        }
        foreach (var group in plan.GroupBy(p => p.Component))
            if (group.Sum(p => p.Quantity) > group.Key.IssuedQuantity)
                return Result.Failure<ProductionOrderDto>(Error.Custom("ProductionOrder.Conflict",
                    $"Only {group.Key.IssuedQuantity:0.####} {group.Key.Unit} of {group.Key.Name} has been issued, so no more than that can be returned."));

        foreach (var (component, quantity, batch) in plan)
        {
            var moved = await stock.ReturnAsync(component.ProductId, quantity, component.UnitCost,
                order.WarehouseId, order.OrderNumber, batch, ct);
            if (moved.IsFailure)
                return Result.Failure<ProductionOrderDto>(Error.Custom("ProductionOrder.Stock.Conflict",
                    $"Could not return {component.Name}: {moved.Error.Description}"));

            db.ProductionMaterialIssues.Add(order.RecordReturn(component, quantity, batch));
            await db.SaveChangesAsync(ct);
        }

        return Result.Success(await ProductionOrderSupport.ToDtoAsync(db, order, stock, ct));
    }
}

internal sealed class CompleteProductionOrderHandler(ManufacturingDbContext db, IManufacturingStock stock)
    : ICommandHandler<CompleteProductionOrderCommand, ProductionOrderDto>
{
    public async Task<Result<ProductionOrderDto>> Handle(CompleteProductionOrderCommand cmd, CancellationToken ct)
    {
        var order = await ProductionOrderSupport.LoadAsync(db, cmd.Id, ct);
        if (order is null) return Result.Failure<ProductionOrderDto>(ProductionOrderSupport.NotFound(cmd.Id));

        if (!order.CanIssue)
            return Result.Failure<ProductionOrderDto>(ProductionOrderSupport.Transition(
                order.Status == ProductionOrderStatus.Planned
                    ? "Release the order before completing it."
                    : $"This order is already {order.Status}."));

        if (cmd.IssueRemaining)
        {
            var issued = await ProductionOrderSupport.IssueAsync(db, stock, order, null, ct);
            if (issued.IsFailure) return Result.Failure<ProductionOrderDto>(issued.Error);
        }

        // Finished goods with no materials behind them would enter stock at zero cost.
        if (!order.HasIssuedMaterials)
            return Result.Failure<ProductionOrderDto>(Error.Custom("ProductionOrder.Conflict",
                "No materials have been issued to this order yet. Issue them first, or complete with \"issue remaining materials\"."));

        DateTime? expiry = DateTime.TryParse(cmd.ExpiryDate, out var parsed) ? parsed.Date : null;

        // Close the order in memory first: that is what works out the unit cost the finished goods
        // are received at, and how much of each by-product came out. Nothing is saved unless the
        // receipt succeeds.
        order.Complete(cmd.ProducedQuantity, cmd.ScrappedQuantity, cmd.QualityNotes,
            cmd.CostScrapSeparately, cmd.BatchNumber, expiry?.ToString("yyyy-MM-dd"));

        var received = await stock.ReceiveAsync(order.ProductId, cmd.ProducedQuantity, order.UnitCost,
            order.WarehouseId, order.OrderNumber, order.BatchNumber, expiry, ct);
        if (received.IsFailure)
            return Result.Failure<ProductionOrderDto>(Error.Custom("ProductionOrder.Stock.Conflict",
                $"Could not receive the finished goods into stock: {received.Error.Description}"));

        // By-products carry no cost of their own — the whole cost stays on the main product — so
        // they are received at zero and leave their product's cost price untouched.
        foreach (var output in order.Outputs.Where(o => o.ReceivedQuantity > 0))
            await stock.ReceiveAsync(output.ProductId, output.ReceivedQuantity, 0, order.WarehouseId,
                order.OrderNumber, order.BatchNumber, expiry, ct);

        // The receipt above is already committed in Inventory. If this save fails the order
        // stays open with the goods in stock, and completing it again would receive them twice.
        await db.SaveChangesAsync(ct);
        return Result.Success(await ProductionOrderSupport.ToDtoAsync(db, order, stock, ct));
    }
}

internal sealed class RecordOperationHandler(ManufacturingDbContext db, IManufacturingStock stock)
    : ICommandHandler<RecordOperationCommand, ProductionOrderDto>
{
    public async Task<Result<ProductionOrderDto>> Handle(RecordOperationCommand cmd, CancellationToken ct)
    {
        var order = await ProductionOrderSupport.LoadAsync(db, cmd.Id, ct);
        if (order is null) return Result.Failure<ProductionOrderDto>(ProductionOrderSupport.NotFound(cmd.Id));

        if (!order.CanIssue)
            return Result.Failure<ProductionOrderDto>(ProductionOrderSupport.Transition(
                order.Status == ProductionOrderStatus.Planned
                    ? "Release the order before recording work on it."
                    : $"Time cannot be recorded on a {order.Status} order."));

        var operation = order.Operations.FirstOrDefault(o => o.Id == cmd.OperationId);
        if (operation is null)
            return Result.Failure<ProductionOrderDto>(Error.Custom("ProductionOrder.Operation.NotFound",
                "That operation is not on this production order."));

        order.RecordOperation(operation, cmd.ActualMinutes);
        await db.SaveChangesAsync(ct);
        return Result.Success(await ProductionOrderSupport.ToDtoAsync(db, order, stock, ct));
    }
}

internal sealed class LinkOrderJournalHandler(ManufacturingDbContext db) : ICommandHandler<LinkOrderJournalCommand>
{
    public async Task<Result> Handle(LinkOrderJournalCommand cmd, CancellationToken ct)
    {
        var order = await db.ProductionOrders.FirstOrDefaultAsync(o => o.Id == cmd.Id && !o.IsDeleted, ct);
        if (order is null) return Result.Failure(ProductionOrderSupport.NotFound(cmd.Id));

        if (order.Status != ProductionOrderStatus.Completed)
            return Result.Failure(Error.Custom("ProductionOrder.Conflict",
                "Only a completed order has a cost to post."));

        // One order, one posting: a second entry would count the same production twice.
        if (order.JournalEntryId is not null)
            return Result.Failure(Error.Custom("ProductionOrder.Conflict",
                $"This order is already posted to the ledger ({order.JournalEntryNumber})."));

        order.LinkJournalEntry(cmd.JournalEntryId, cmd.JournalEntryNumber);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class LinkOrderRequisitionHandler(ManufacturingDbContext db) : ICommandHandler<LinkOrderRequisitionCommand>
{
    public async Task<Result> Handle(LinkOrderRequisitionCommand cmd, CancellationToken ct)
    {
        var order = await db.ProductionOrders.FirstOrDefaultAsync(o => o.Id == cmd.Id && !o.IsDeleted, ct);
        if (order is null) return Result.Failure(ProductionOrderSupport.NotFound(cmd.Id));

        order.LinkRequisition(cmd.RequisitionNumber);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class CancelProductionOrderHandler(ManufacturingDbContext db, IManufacturingStock stock)
    : ICommandHandler<CancelProductionOrderCommand, ProductionOrderDto>
{
    public async Task<Result<ProductionOrderDto>> Handle(CancelProductionOrderCommand cmd, CancellationToken ct)
    {
        var order = await ProductionOrderSupport.LoadAsync(db, cmd.Id, ct);
        if (order is null) return Result.Failure<ProductionOrderDto>(ProductionOrderSupport.NotFound(cmd.Id));

        if (order.Status is ProductionOrderStatus.Completed or ProductionOrderStatus.Cancelled)
            return Result.Failure<ProductionOrderDto>(ProductionOrderSupport.Transition(
                $"This order is already {order.Status}."));

        // Issued stock has physically left the store; cancelling would strand it with no record.
        if (order.HasIssuedMaterials)
            return Result.Failure<ProductionOrderDto>(Error.Custom("ProductionOrder.Conflict",
                "Materials are still issued to this order. Return them to stock first, then cancel."));

        order.Cancel();
        await db.SaveChangesAsync(ct);
        return Result.Success(await ProductionOrderSupport.ToDtoAsync(db, order, stock, ct));
    }
}

internal sealed class DeleteProductionOrderHandler(ManufacturingDbContext db)
    : ICommandHandler<DeleteProductionOrderCommand>
{
    public async Task<Result> Handle(DeleteProductionOrderCommand cmd, CancellationToken ct)
    {
        var order = await db.ProductionOrders.FirstOrDefaultAsync(o => o.Id == cmd.Id && !o.IsDeleted, ct);
        if (order is null) return Result.Failure(ProductionOrderSupport.NotFound(cmd.Id));

        if (order.Status is not (ProductionOrderStatus.Planned or ProductionOrderStatus.Cancelled))
            return Result.Failure(Error.Custom("ProductionOrder.Conflict",
                "Only a planned or cancelled order can be deleted — the others are part of the stock history."));

        order.Delete();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal static class WarehouseResolver
{
    /// <summary>The warehouse's name, null when no warehouse was chosen, or a failure when it does not exist.</summary>
    public static async Task<Result<string?>> ResolveAsync(
        IManufacturingStock stock, Guid? warehouseId, CancellationToken ct)
    {
        if (warehouseId is null) return Result.Success<string?>(null);

        var warehouse = (await stock.GetWarehousesAsync(ct)).FirstOrDefault(w => w.Id == warehouseId);
        return warehouse is null
            ? Result.Failure<string?>(Error.Custom("ProductionOrder.Warehouse.NotFound", "The selected warehouse was not found."))
            : Result.Success<string?>(warehouse.Name);
    }
}
