using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Trade.Application.Abstractions;
using Softaxis.Trade.Application.Dashboard;
using Softaxis.Trade.Application.Shipments;
using Softaxis.Trade.Domain.Entities;
using Softaxis.Trade.Infrastructure.Handlers.Shipments;
using Softaxis.Trade.Infrastructure.Persistence;

namespace Softaxis.Trade.Infrastructure.Handlers.Dashboard;

internal sealed class GetTradeDashboardHandler(TradeDbContext db, ICurrentUser user)
    : IQueryHandler<GetTradeDashboardQuery, TradeDashboardDto>
{
    public async Task<Result<TradeDashboardDto>> Handle(GetTradeDashboardQuery q, CancellationToken ct)
    {
        var today   = TradeDates.Today(q.Today);
        var soon    = today.AddDays(AttentionCalculator.SoonDays);
        var canPay  = user.HasPermission(ShipmentSupport.ViewPayments);
        var canDocs = user.HasPermission(ShipmentSupport.ViewDocuments);

        var open = await db.Shipments.AsNoTracking()
            .Where(s => !s.IsDeleted && s.Status != ShipmentStatus.Delivered && s.Status != ShipmentStatus.Closed
                     && s.Status != ShipmentStatus.Cancelled)
            .Select(s => new
            {
                s.Direction, s.Status, s.Eta, s.ExchangeRate,
                Goods = s.Items.Sum(i => (decimal?)(i.Quantity * i.UnitPrice)) ?? 0m,
            })
            .ToListAsync(ct);

        var byStatus = await db.Shipments.AsNoTracking().Where(s => !s.IsDeleted)
            .GroupBy(s => s.Status).Select(g => new StatusCountDto(g.Key, g.Count())).ToListAsync(ct);

        bool Moving(string st) => st is ShipmentStatus.Booked or ShipmentStatus.InTransit;

        var attention = await AttentionCalculator.BuildAsync(db, today, canPay, canDocs, ct);
        var recent    = await new GetShipmentsHandler(db).Handle(new GetShipmentsQuery(PageSize: 6), ct);

        return Result.Success(new TradeDashboardDto(
            OpenImports: open.Count(s => s.Direction == ShipmentDirection.Import),
            OpenExports: open.Count(s => s.Direction == ShipmentDirection.Export),
            ArrivingSoon: open.Count(s => Moving(s.Status) && s.Eta is { } e && e >= today && e <= soon),
            Delayed: open.Count(s => Moving(s.Status) && s.Eta is { } e && e < today),
            AtCustoms: open.Count(s => s.Status is ShipmentStatus.Arrived or ShipmentStatus.Customs),
            OpenGoodsValue: Math.Round(open.Sum(s => s.Goods * s.ExchangeRate), 2),
            PaymentsDue: attention.PaymentsDue, PaymentsOverdue: attention.PaymentsOverdue,
            DocumentsExpiring: attention.DocumentsExpiring, DocumentsExpired: attention.DocumentsExpired,
            ByStatus: byStatus.OrderBy(s => Array.IndexOf(ShipmentStatus.Journey, s.Status) is var i && i < 0 ? 99 : i).ToList(),
            Attention: attention.Items.Take(30).ToList(),
            Recent: recent.IsSuccess ? recent.Value.Items : [],
            CanSeePayments: canPay));
    }
}
