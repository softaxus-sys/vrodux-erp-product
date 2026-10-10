using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Manufacturing.Application.Abstractions;
using Softaxis.Manufacturing.Application.ProductionOrders.Dtos;
using Softaxis.Manufacturing.Application.ProductionOrders.Queries;
using Softaxis.Manufacturing.Domain.Entities;
using Softaxis.Manufacturing.Infrastructure.Persistence;

namespace Softaxis.Manufacturing.Infrastructure.Handlers.ProductionOrders;

internal sealed class GetProductionOrdersHandler(ManufacturingDbContext db)
    : IQueryHandler<GetProductionOrdersQuery, IReadOnlyList<ProductionOrderSummaryDto>>
{
    public async Task<Result<IReadOnlyList<ProductionOrderSummaryDto>>> Handle(
        GetProductionOrdersQuery q, CancellationToken ct)
    {
        var query = db.ProductionOrders.AsNoTracking().Where(o => !o.IsDeleted);

        if (!string.IsNullOrWhiteSpace(q.Status))
            query = query.Where(o => o.Status == q.Status);

        if (!string.IsNullOrWhiteSpace(q.Reference))
        {
            var reference = q.Reference.Trim();
            query = query.Where(o => o.Reference == reference);
        }

        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var s = q.Search.Trim();
            query = query.Where(o => o.OrderNumber.Contains(s) || o.ProductName.Contains(s)
                                     || (o.Reference != null && o.Reference.Contains(s)));
        }

        var orders = await query.OrderByDescending(o => o.CreatedAt).ToListAsync(ct);
        return Result.Success<IReadOnlyList<ProductionOrderSummaryDto>>(
            orders.Select(ProductionOrderSupport.ToSummary).ToList());
    }
}

internal sealed class GetProductionOrderByIdHandler(ManufacturingDbContext db, IManufacturingStock stock)
    : IQueryHandler<GetProductionOrderByIdQuery, ProductionOrderDto>
{
    public async Task<Result<ProductionOrderDto>> Handle(GetProductionOrderByIdQuery q, CancellationToken ct)
    {
        var order = await ProductionOrderSupport.WithDetail(db.ProductionOrders.AsNoTracking())
            .FirstOrDefaultAsync(o => o.Id == q.Id && !o.IsDeleted, ct);

        return order is null
            ? Result.Failure<ProductionOrderDto>(ProductionOrderSupport.NotFound(q.Id))
            : Result.Success(await ProductionOrderSupport.ToDtoAsync(db, order, stock, ct));
    }
}

internal sealed class GetProductionSummaryHandler(ManufacturingDbContext db)
    : IQueryHandler<GetProductionSummaryQuery, ProductionSummaryDto>
{
    public async Task<Result<ProductionSummaryDto>> Handle(GetProductionSummaryQuery q, CancellationToken ct)
    {
        var rows = await db.ProductionOrders.AsNoTracking().Where(o => !o.IsDeleted)
            .Select(o => new { o.Status, o.DueDate, o.MaterialCost })
            .ToListAsync(ct);

        // Due dates are calendar days stored as yyyy-MM-dd, so an ordinal compare is a date compare.
        var today = DateTime.UtcNow.ToString("yyyy-MM-dd");
        int Count(string status) => rows.Count(r => r.Status == status);

        var overdue = rows.Count(r =>
            r.Status is ProductionOrderStatus.Planned or ProductionOrderStatus.Released or ProductionOrderStatus.InProgress
            && r.DueDate is not null && string.CompareOrdinal(r.DueDate, today) < 0);

        var activeBoms = await db.Boms.CountAsync(b => !b.IsDeleted && b.Status == BomStatus.Active, ct);

        return Result.Success(new ProductionSummaryDto(
            Count(ProductionOrderStatus.Planned), Count(ProductionOrderStatus.Released),
            Count(ProductionOrderStatus.InProgress), Count(ProductionOrderStatus.Completed),
            Count(ProductionOrderStatus.Cancelled), overdue, activeBoms,
            rows.Where(r => r.Status == ProductionOrderStatus.Completed).Sum(r => r.MaterialCost)));
    }
}
