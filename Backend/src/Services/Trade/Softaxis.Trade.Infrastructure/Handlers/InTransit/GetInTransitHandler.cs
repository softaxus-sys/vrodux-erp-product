using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Trade.Application.InTransit;
using Softaxis.Trade.Domain.Entities;
using Softaxis.Trade.Infrastructure.Handlers.Shipments;
using Softaxis.Trade.Infrastructure.Persistence;

namespace Softaxis.Trade.Infrastructure.Handlers.InTransit;

internal sealed class GetInTransitHandler(TradeDbContext db) : IQueryHandler<GetInTransitQuery, IReadOnlyList<InTransitProductDto>>
{
    private const int LineCap = 5000;

    public async Task<Result<IReadOnlyList<InTransitProductDto>>> Handle(GetInTransitQuery q, CancellationToken ct)
    {
        var today = TradeDates.Today(q.Today);

        // "On its way" = booked up to cleared. Delivered cargo is in the warehouse (Inventory's
        // business), closed and cancelled shipments carry nothing.
        var query = db.Items.AsNoTracking()
            .Join(db.Shipments.Where(s => !s.IsDeleted && s.Status != ShipmentStatus.Delivered
                                          && s.Status != ShipmentStatus.Closed && s.Status != ShipmentStatus.Cancelled),
                i => i.ShipmentId, s => s.Id,
                (i, s) => new { i.ProductId, i.Sku, i.Description, i.Unit, i.Quantity, s.Id, s.ShipmentNumber, s.Direction, s.Status, s.Eta });

        if (q.ProductId.HasValue) query = query.Where(x => x.ProductId == q.ProductId);
        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var term = q.Search.Trim();
            query = query.Where(x => x.Description.Contains(term) || (x.Sku != null && x.Sku.Contains(term)));
        }

        var lines = await query.Take(LineCap).ToListAsync(ct);

        // A linked product is one row however it is worded on each shipment; an unlinked line can
        // only be told apart by what it says, so equal wording (ignoring case) is the same goods.
        var rows = lines
            .GroupBy(x => x.ProductId.HasValue ? $"p:{x.ProductId}" : $"d:{x.Description.Trim().ToLowerInvariant()}|{x.Unit.ToLowerInvariant()}")
            .Select(g =>
            {
                var first = g.First();
                var imports = g.Where(x => x.Direction == ShipmentDirection.Import).ToList();
                return new InTransitProductDto(
                    first.ProductId, g.Select(x => x.Sku).FirstOrDefault(s => !string.IsNullOrWhiteSpace(s)), first.Description, first.Unit,
                    imports.Sum(x => x.Quantity), g.Where(x => x.Direction == ShipmentDirection.Export).Sum(x => x.Quantity),
                    g.Select(x => x.Id).Distinct().Count(),
                    imports.Where(x => x.Eta.HasValue).Select(x => x.Eta).OrderBy(e => e).FirstOrDefault(),
                    imports.Any(x => x.Status is ShipmentStatus.Booked or ShipmentStatus.InTransit && x.Eta is { } e && e < today),
                    g.OrderBy(x => x.Eta ?? DateOnly.MaxValue)
                     .Select(x => new InTransitShipmentDto(x.Id, x.ShipmentNumber, x.Direction, x.Status, x.Quantity, x.Eta)).ToList());
            })
            .OrderByDescending(r => r.Delayed).ThenBy(r => r.NextEta ?? DateOnly.MaxValue).ThenBy(r => r.Description)
            .ToList();

        return Result.Success<IReadOnlyList<InTransitProductDto>>(rows);
    }
}
