using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Manufacturing.Application.Abstractions;
using Softaxis.Manufacturing.Application.Planning;
using Softaxis.Manufacturing.Domain.Entities;
using Softaxis.Manufacturing.Infrastructure.Persistence;

namespace Softaxis.Manufacturing.Infrastructure.Handlers.Planning;

/// <summary>
/// Material requirements: every component still to be issued across open orders, set against
/// what Inventory holds. Shortage is against total stock, so two orders needing the same
/// component are counted together rather than each seeing the full quantity.
/// </summary>
internal sealed class GetMaterialRequirementsHandler(ManufacturingDbContext db, IManufacturingStock stock)
    : IQueryHandler<GetMaterialRequirementsQuery, IReadOnlyList<MaterialRequirementDto>>
{
    private static readonly string[] OpenStatuses =
        [ProductionOrderStatus.Planned, ProductionOrderStatus.Released, ProductionOrderStatus.InProgress];

    public async Task<Result<IReadOnlyList<MaterialRequirementDto>>> Handle(
        GetMaterialRequirementsQuery q, CancellationToken ct)
    {
        var rows = await (
            from c in db.ProductionOrderComponents.AsNoTracking()
            join o in db.ProductionOrders.AsNoTracking() on c.ProductionOrderId equals o.Id
            where !o.IsDeleted && OpenStatuses.Contains(o.Status) && c.RequiredQuantity > c.IssuedQuantity
            select new { c.ProductId, c.Name, c.Sku, c.Unit, c.UnitCost, Remaining = c.RequiredQuantity - c.IssuedQuantity, OrderId = o.Id })
            .ToListAsync(ct);

        var result = new List<MaterialRequirementDto>();
        foreach (var g in rows.GroupBy(r => r.ProductId))
        {
            var first    = g.First();
            var required = g.Sum(r => r.Remaining);
            var item     = await stock.GetItemAsync(g.Key, ct);
            var onHand   = item?.StockQuantity;   // total stock: orders in different warehouses share this row

            result.Add(new MaterialRequirementDto(
                g.Key, item?.Name ?? first.Name, item?.Sku ?? first.Sku, first.Unit, required, onHand,
                Math.Max(0, required - (onHand ?? 0)), item?.CostPrice ?? first.UnitCost,
                g.Select(r => r.OrderId).Distinct().Count()));
        }

        return Result.Success<IReadOnlyList<MaterialRequirementDto>>(
            result.OrderByDescending(r => r.Shortage).ThenBy(r => r.Name).ToList());
    }
}

internal sealed class GetProductionYieldHandler(ManufacturingDbContext db)
    : IQueryHandler<GetProductionYieldQuery, IReadOnlyList<ProductionYieldDto>>
{
    public async Task<Result<IReadOnlyList<ProductionYieldDto>>> Handle(GetProductionYieldQuery q, CancellationToken ct)
    {
        var query = db.ProductionOrders.AsNoTracking()
            .Where(o => !o.IsDeleted && o.Status == ProductionOrderStatus.Completed && o.CompletedAt != null);

        if (DateTime.TryParse(q.From, out var from)) query = query.Where(o => o.CompletedAt >= from.Date);
        if (DateTime.TryParse(q.To, out var to))     query = query.Where(o => o.CompletedAt < to.Date.AddDays(1));

        var orders = await query
            .Select(o => new
            {
                o.ProductId, o.ProductName, o.Unit, o.PlannedQuantity, o.ProducedQuantity, o.ScrappedQuantity,
                o.MaterialCost, o.LabourCost, o.OverheadCost, o.ScrapCost,
            })
            .ToListAsync(ct);

        var rows = orders.GroupBy(o => o.ProductId).Select(g =>
        {
            var produced = g.Sum(o => o.ProducedQuantity);
            var scrapped = g.Sum(o => o.ScrappedQuantity);
            var material = g.Sum(o => o.MaterialCost);
            var labour   = g.Sum(o => o.LabourCost);
            var overhead = g.Sum(o => o.OverheadCost);
            var made     = produced + scrapped;

            return new ProductionYieldDto(
                g.Key, g.First().ProductName, g.First().Unit, g.Count(), g.Sum(o => o.PlannedQuantity),
                produced, scrapped,
                made > 0 ? Math.Round(produced / made * 100, 1) : 0,
                material, labour, overhead,
                produced > 0 ? Math.Round((material + labour + overhead - g.Sum(o => o.ScrapCost)) / produced, 4) : 0,
                g.Sum(o => o.ScrapCost));
        })
        .OrderBy(r => r.ProductName)
        .ToList();

        return Result.Success<IReadOnlyList<ProductionYieldDto>>(rows);
    }
}

internal sealed class GetWipHandler(ManufacturingDbContext db) : IQueryHandler<GetWipQuery, IReadOnlyList<WipRowDto>>
{
    public async Task<Result<IReadOnlyList<WipRowDto>>> Handle(GetWipQuery q, CancellationToken ct)
    {
        var rows = await db.ProductionOrders.AsNoTracking()
            .Where(o => !o.IsDeleted
                        && (o.Status == ProductionOrderStatus.Released || o.Status == ProductionOrderStatus.InProgress)
                        && (o.MaterialCost > 0 || o.LabourCost > 0 || o.OverheadCost > 0))
            .OrderBy(o => o.DueDate == null).ThenBy(o => o.DueDate)
            .Select(o => new WipRowDto(o.Id, o.OrderNumber, o.ProductName, o.Status, o.PlannedQuantity, o.Unit,
                o.MaterialCost, o.LabourCost, o.OverheadCost, o.MaterialCost + o.LabourCost + o.OverheadCost, o.DueDate))
            .ToListAsync(ct);

        return Result.Success<IReadOnlyList<WipRowDto>>(rows);
    }
}

internal static class OpenOperations
{
    private static readonly string[] OpenStatuses =
        [ProductionOrderStatus.Planned, ProductionOrderStatus.Released, ProductionOrderStatus.InProgress];

    public sealed record Row(Guid OrderId, string OrderNumber, string ProductName, string Status, string? PlannedStartDate,
        string? DueDate, Guid WorkCentreId, string WorkCentreName, string OperationName, int Sequence, decimal PlannedMinutes);

    /// <summary>Every operation not yet done on an order that is still open.</summary>
    public static Task<List<Row>> LoadAsync(ManufacturingDbContext db, CancellationToken ct) => (
        from op in db.ProductionOrderOperations.AsNoTracking()
        join o in db.ProductionOrders.AsNoTracking() on op.ProductionOrderId equals o.Id
        where !o.IsDeleted && OpenStatuses.Contains(o.Status) && !op.IsDone
        select new Row(o.Id, o.OrderNumber, o.ProductName, o.Status, o.PlannedStartDate, o.DueDate,
            op.WorkCentreId, op.WorkCentreName, op.Name, op.Sequence, op.PlannedMinutes)).ToListAsync(ct);
}

internal sealed class GetWorkCentreLoadHandler(ManufacturingDbContext db)
    : IQueryHandler<GetWorkCentreLoadQuery, IReadOnlyList<WorkCentreLoadDto>>
{
    public async Task<Result<IReadOnlyList<WorkCentreLoadDto>>> Handle(GetWorkCentreLoadQuery q, CancellationToken ct)
    {
        var centres = await db.WorkCentres.AsNoTracking().Where(w => !w.IsDeleted && w.IsActive).ToListAsync(ct);
        var open    = await OpenOperations.LoadAsync(db, ct);
        var today   = DateTime.UtcNow.Date;

        var rows = centres.Select(c =>
        {
            var mine     = open.Where(o => o.WorkCentreId == c.Id).ToList();
            var minutes  = mine.Sum(o => o.PlannedMinutes);
            var capacity = c.CapacityHoursPerDay > 0 ? c.CapacityHoursPerDay : 8;
            var days     = Math.Round(minutes / 60m / capacity, 1);
            var earliest = mine.Where(o => o.DueDate != null).Select(o => o.DueDate!).OrderBy(d => d, StringComparer.Ordinal).FirstOrDefault();

            // Calendar days to the earliest due date, counted inclusively. A queue longer than that
            // cannot all be done in time — a rough signal, since it ignores weekends.
            var late = earliest is not null && DateTime.TryParse(earliest, out var due)
                       && days > Math.Max(0, (due.Date - today).Days + 1);

            return new WorkCentreLoadDto(c.Id, c.Name, mine.Count, mine.Select(o => o.OrderId).Distinct().Count(),
                minutes, capacity, days, earliest, late);
        })
        .OrderByDescending(r => r.DaysQueued).ThenBy(r => r.Name)
        .ToList();

        return Result.Success<IReadOnlyList<WorkCentreLoadDto>>(rows);
    }
}

internal sealed class GetScheduleHandler(ManufacturingDbContext db)
    : IQueryHandler<GetScheduleQuery, IReadOnlyList<ScheduleRowDto>>
{
    public async Task<Result<IReadOnlyList<ScheduleRowDto>>> Handle(GetScheduleQuery q, CancellationToken ct)
    {
        var open = await OpenOperations.LoadAsync(db, ct);

        var rows = open
            .OrderBy(o => o.DueDate is null).ThenBy(o => o.DueDate, StringComparer.Ordinal)
            .ThenBy(o => o.OrderNumber, StringComparer.Ordinal).ThenBy(o => o.Sequence)
            .Take(200)
            .Select(o => new ScheduleRowDto(o.OrderId, o.OrderNumber, o.ProductName, o.OperationName,
                o.WorkCentreName, o.PlannedMinutes, o.PlannedStartDate, o.DueDate, o.Status))
            .ToList();

        return Result.Success<IReadOnlyList<ScheduleRowDto>>(rows);
    }
}
