using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Trade.Application.Abstractions;
using Softaxis.Trade.Application.Reports;
using Softaxis.Trade.Domain.Entities;
using Softaxis.Trade.Infrastructure.Handlers.Shipments;
using Softaxis.Trade.Infrastructure.Persistence;

namespace Softaxis.Trade.Infrastructure.Handlers.Reports;

/// <summary>
/// The Trade reports for the central Reports hub. There is no separate "trade reports" permission:
/// each report needs the permission of the area it reads, so someone who may not see costs does not
/// get the landed-cost report either — the same rule the shipment screen applies.
/// </summary>
internal sealed class RunTradeReportHandler(TradeDbContext db, ICurrentUser user)
    : IQueryHandler<RunTradeReportQuery, TabularReportDto>
{
    private const int RowCap = 5000;

    /// <summary>Report id → the permission that opens it.</summary>
    private static readonly Dictionary<string, string> Required = new()
    {
        ["shipment-register"]  = "trade.shipments.view",
        ["delayed-shipments"]  = "trade.shipments.view",
        ["by-partner"]         = "trade.shipments.view",
        ["port-free-days"]     = "trade.shipments.view",
        ["landed-cost"]        = "trade.costs.view",
        ["cost-breakdown"]     = "trade.costs.view",
        ["payments-schedule"]  = "trade.payments.view",
        ["documents-expiring"] = "trade.documents.view",
    };

    public async Task<Result<TabularReportDto>> Handle(RunTradeReportQuery q, CancellationToken ct)
    {
        // The hub registers every report as "trade-<id>"; a direct caller may send the bare id.
        var id = q.ReportId.StartsWith("trade-", StringComparison.OrdinalIgnoreCase) ? q.ReportId[6..] : q.ReportId;

        if (!Required.TryGetValue(id, out var permission))
            return Result.Failure<TabularReportDto>(Error.Custom("Report.NotFound", $"There is no Trade report called \"{q.ReportId}\"."));
        if (!user.HasPermission(permission))
            return Result.Failure<TabularReportDto>(Error.Custom("Report.Forbidden", $"This report needs the {permission} permission."));

        var today = TradeDates.Today(q.Today);
        var to    = q.To ?? today;
        var from  = q.From ?? to.AddDays(-30);

        return id switch
        {
            "shipment-register"  => await ShipmentRegister(from, to, ct),
            "delayed-shipments"  => await Delayed(today, ct),
            "by-partner"         => await ByPartner(from, to, ct),
            "port-free-days"     => await PortFreeDays(today, ct),
            "landed-cost"        => await LandedCostReport(from, to, ct),
            "cost-breakdown"     => await CostBreakdown(from, to, ct),
            "payments-schedule"  => await PaymentsSchedule(today, ct),
            _                    => await DocumentsExpiring(today, ct),
        };
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    private static Result<TabularReportDto> Table(string[] columns, List<Dictionary<string, object?>> rows) =>
        Result.Success(new TabularReportDto(columns, rows.Take(RowCap).ToList(), rows.Count));

    private static string? D(DateOnly? d) => d?.ToString("yyyy-MM-dd");

    private IQueryable<Shipment> Live() => db.Shipments.AsNoTracking().Where(s => !s.IsDeleted);

    /// <summary>Booked in [from, to] — compared on the stored UTC timestamp, inclusive of the last day.</summary>
    private static IQueryable<Shipment> Booked(IQueryable<Shipment> q, DateOnly from, DateOnly to)
    {
        var start = from.ToDateTime(TimeOnly.MinValue);
        var end   = to.AddDays(1).ToDateTime(TimeOnly.MinValue);
        return q.Where(s => s.CreatedAt >= start && s.CreatedAt < end);
    }

    private async Task<Dictionary<Guid, string>> PartnerNames(IEnumerable<Guid?> ids, CancellationToken ct)
    {
        var list = ids.Where(i => i.HasValue).Select(i => i!.Value).Distinct().ToList();
        return list.Count == 0 ? [] : await db.Parties.AsNoTracking().Where(p => list.Contains(p.Id)).ToDictionaryAsync(p => p.Id, p => p.Name, ct);
    }

    private static string Name(Dictionary<Guid, string> names, Guid? id) => id.HasValue && names.TryGetValue(id.Value, out var n) ? n : "";

    private static string Route(Shipment s) =>
        string.Join(" → ", new[] { s.OriginPort ?? s.OriginCountry, s.DestinationPort ?? s.DestinationCountry }.Where(x => !string.IsNullOrWhiteSpace(x)));

    // ── reports ─────────────────────────────────────────────────────────────

    private async Task<Result<TabularReportDto>> ShipmentRegister(DateOnly from, DateOnly to, CancellationToken ct)
    {
        var list = await Booked(Live(), from, to).Include(s => s.Items).AsSplitQuery().OrderByDescending(s => s.CreatedAt).Take(RowCap + 1).ToListAsync(ct);
        var names = await PartnerNames(list.Select(s => s.PartnerId), ct);

        return Table(["Shipment", "Direction", "Status", "Supplier / Buyer", "Order Ref.", "B/L", "Route", "ETD", "ETA", "Arrived", "Currency", "Goods Value"],
            list.Select(s => new Dictionary<string, object?>
            {
                ["Shipment"] = s.ShipmentNumber, ["Direction"] = s.Direction, ["Status"] = s.Status, ["Supplier / Buyer"] = Name(names, s.PartnerId),
                ["Order Ref."] = s.OrderReference, ["B/L"] = s.BlNumber, ["Route"] = Route(s), ["ETD"] = D(s.Etd), ["ETA"] = D(s.Eta),
                ["Arrived"] = D(s.ArrivedOn), ["Currency"] = s.Currency, ["Goods Value"] = s.GoodsValue,
            }).ToList());
    }

    private async Task<Result<TabularReportDto>> Delayed(DateOnly today, CancellationToken ct)
    {
        var list = await Live().Where(s => (s.Status == ShipmentStatus.Booked || s.Status == ShipmentStatus.InTransit) && s.Eta != null && s.Eta < today)
            .Include(s => s.Items).AsSplitQuery().OrderBy(s => s.Eta).ToListAsync(ct);
        var names = await PartnerNames(list.Select(s => s.PartnerId), ct);

        return Table(["Shipment", "Direction", "Supplier / Buyer", "Status", "B/L", "Vessel / Flight", "Route", "ETA", "Days Late", "Goods Value", "Currency"],
            list.Select(s => new Dictionary<string, object?>
            {
                ["Shipment"] = s.ShipmentNumber, ["Direction"] = s.Direction, ["Supplier / Buyer"] = Name(names, s.PartnerId), ["Status"] = s.Status,
                ["B/L"] = s.BlNumber, ["Vessel / Flight"] = s.VesselOrFlight, ["Route"] = Route(s), ["ETA"] = D(s.Eta),
                ["Days Late"] = today.DayNumber - s.Eta!.Value.DayNumber, ["Goods Value"] = s.GoodsValue, ["Currency"] = s.Currency,
            }).ToList());
    }

    private async Task<Result<TabularReportDto>> ByPartner(DateOnly from, DateOnly to, CancellationToken ct)
    {
        var list = await Booked(Live(), from, to).Where(s => s.Status != ShipmentStatus.Cancelled).Include(s => s.Items).AsSplitQuery().ToListAsync(ct);
        var names = await PartnerNames(list.Select(s => s.PartnerId), ct);

        var rows = list.GroupBy(s => new { s.PartnerId, s.Direction }).Select(g => new Dictionary<string, object?>
        {
            ["Supplier / Buyer"] = g.Key.PartnerId is null ? "(none)" : Name(names, g.Key.PartnerId),
            ["Direction"]        = g.Key.Direction,
            ["Shipments"]        = g.Count(),
            ["Open"]             = g.Count(s => ShipmentStatus.IsOpen(s.Status)),
            // Mixed invoice currencies are brought to the workspace currency so the column can be added up.
            ["Goods Value"]      = Math.Round(g.Sum(s => s.GoodsValue * s.ExchangeRate), 2),
        }).OrderByDescending(r => (decimal)r["Goods Value"]!).ToList();

        return Table(["Supplier / Buyer", "Direction", "Shipments", "Open", "Goods Value"], rows);
    }

    private async Task<Result<TabularReportDto>> PortFreeDays(DateOnly today, CancellationToken ct)
    {
        var list = await Live().Where(s => s.ArrivedOn != null && s.FreeDays != null && (s.Status == ShipmentStatus.Arrived || s.Status == ShipmentStatus.Customs))
            .ToListAsync(ct);
        var names = await PartnerNames(list.Select(s => s.PartnerId), ct);

        return Table(["Shipment", "Direction", "Supplier / Buyer", "Status", "Port", "Arrived", "Free Days", "Free Time Ends", "Days Left"],
            list.Select(s => new { s, ends = s.FreeTimeEnds!.Value }).OrderBy(x => x.ends).Select(x => new Dictionary<string, object?>
            {
                ["Shipment"] = x.s.ShipmentNumber, ["Direction"] = x.s.Direction, ["Supplier / Buyer"] = Name(names, x.s.PartnerId), ["Status"] = x.s.Status,
                ["Port"] = x.s.DestinationPort ?? x.s.DestinationCountry, ["Arrived"] = D(x.s.ArrivedOn), ["Free Days"] = x.s.FreeDays,
                ["Free Time Ends"] = D(x.ends), ["Days Left"] = x.ends.DayNumber - today.DayNumber,
            }).ToList());
    }

    private async Task<Result<TabularReportDto>> LandedCostReport(DateOnly from, DateOnly to, CancellationToken ct)
    {
        var list = await Booked(Live(), from, to).Where(s => s.Status != ShipmentStatus.Cancelled)
            .Include(s => s.Items).Include(s => s.Costs).AsSplitQuery().OrderByDescending(s => s.CreatedAt).Take(500).ToListAsync(ct);

        var rows = new List<Dictionary<string, object?>>();
        foreach (var s in list)
        {
            var lines = LandedCost.Calculate(s.Items, s.Costs, s.ExchangeRate).ToDictionary(l => l.ItemId);
            foreach (var i in s.Items.OrderBy(i => i.Position))
            {
                var l = lines[i.Id];
                rows.Add(new()
                {
                    ["Shipment"] = s.ShipmentNumber, ["Item"] = i.Description, ["HS Code"] = i.HsCode, ["Qty"] = i.Quantity, ["Unit"] = i.Unit,
                    ["Goods (company currency)"] = l.GoodsValue, ["Added Costs"] = l.AllocatedCost, ["Landed Cost"] = l.LandedTotal, ["Landed Unit Cost"] = l.LandedUnitCost,
                });
            }
        }
        return Table(["Shipment", "Item", "HS Code", "Qty", "Unit", "Goods (company currency)", "Added Costs", "Landed Cost", "Landed Unit Cost"], rows);
    }

    private async Task<Result<TabularReportDto>> CostBreakdown(DateOnly from, DateOnly to, CancellationToken ct)
    {
        var start = from.ToDateTime(TimeOnly.MinValue);
        var end   = to.AddDays(1).ToDateTime(TimeOnly.MinValue);

        var costs = await db.Costs.AsNoTracking()
            .Join(db.Shipments.Where(s => !s.IsDeleted && s.Status != ShipmentStatus.Cancelled && s.CreatedAt >= start && s.CreatedAt < end),
                c => c.ShipmentId, s => s.Id, (c, s) => new { c.Type, c.Amount, s.Direction })
            .ToListAsync(ct);

        var total = costs.Sum(c => c.Amount);
        var rows = costs.GroupBy(c => c.Type).Select(g => new Dictionary<string, object?>
        {
            ["Cost"] = g.Key.Replace('_', ' '), ["Entries"] = g.Count(), ["Imports"] = g.Where(c => c.Direction == ShipmentDirection.Import).Sum(c => c.Amount),
            ["Exports"] = g.Where(c => c.Direction == ShipmentDirection.Export).Sum(c => c.Amount), ["Total"] = g.Sum(c => c.Amount),
            ["Share %"] = total == 0 ? 0m : Math.Round(g.Sum(c => c.Amount) / total * 100, 1),
        }).OrderByDescending(r => (decimal)r["Total"]!).ToList();

        return Table(["Cost", "Entries", "Imports", "Exports", "Total", "Share %"], rows);
    }

    private async Task<Result<TabularReportDto>> PaymentsSchedule(DateOnly today, CancellationToken ct)
    {
        var list = await db.Payments.AsNoTracking().Where(p => p.Status == PaymentStatus.Pending)
            .Join(db.Shipments.Where(s => !s.IsDeleted && s.Status != ShipmentStatus.Cancelled), p => p.ShipmentId, s => s.Id,
                (p, s) => new { p, s.ShipmentNumber, s.Direction, s.PartnerId, s.Currency })
            .ToListAsync(ct);
        var names = await PartnerNames(list.Select(x => x.PartnerId), ct);

        return Table(["Shipment", "Direction", "Supplier / Buyer", "Payment", "Amount", "Currency", "Due", "Days", "L/C No.", "Bank", "L/C Expiry"],
            list.OrderBy(x => x.p.DueDate ?? DateOnly.MaxValue).Select(x => new Dictionary<string, object?>
            {
                ["Shipment"] = x.ShipmentNumber, ["Direction"] = x.Direction, ["Supplier / Buyer"] = Name(names, x.PartnerId), ["Payment"] = x.p.Kind,
                ["Amount"] = x.p.Amount, ["Currency"] = x.Currency, ["Due"] = D(x.p.DueDate),
                // Negative = days still to go, positive = days overdue.
                ["Days"] = x.p.DueDate is { } d ? today.DayNumber - d.DayNumber : null,
                ["L/C No."] = x.p.LcNumber, ["Bank"] = x.p.BankName, ["L/C Expiry"] = D(x.p.LcExpiry),
            }).ToList());
    }

    private async Task<Result<TabularReportDto>> DocumentsExpiring(DateOnly today, CancellationToken ct)
    {
        var limit = today.AddDays(90);
        var list = await db.Documents.AsNoTracking().Where(d => !d.IsDeleted && d.ExpiryDate != null && d.ExpiryDate <= limit)
            .Join(db.Shipments.Where(s => !s.IsDeleted && s.Status != ShipmentStatus.Closed && s.Status != ShipmentStatus.Cancelled),
                d => d.ShipmentId, s => s.Id, (d, s) => new { d.Type, d.Number, d.IssueDate, d.ExpiryDate, d.FileName, s.ShipmentNumber, s.Direction })
            .ToListAsync(ct);

        return Table(["Shipment", "Direction", "Document", "Number", "Issued", "Expires", "Days Left", "State", "File"],
            list.OrderBy(x => x.ExpiryDate).Select(x => new Dictionary<string, object?>
            {
                ["Shipment"] = x.ShipmentNumber, ["Direction"] = x.Direction, ["Document"] = x.Type.Replace('_', ' '), ["Number"] = x.Number,
                ["Issued"] = D(x.IssueDate), ["Expires"] = D(x.ExpiryDate), ["Days Left"] = x.ExpiryDate!.Value.DayNumber - today.DayNumber,
                ["State"] = x.ExpiryDate < today ? "Expired" : "Expiring", ["File"] = x.FileName,
            }).ToList());
    }
}
