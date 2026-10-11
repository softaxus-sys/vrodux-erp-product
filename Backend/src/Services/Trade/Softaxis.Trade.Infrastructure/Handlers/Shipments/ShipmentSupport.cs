using Microsoft.EntityFrameworkCore;
using Softaxis.Trade.Application.Abstractions;
using Softaxis.Trade.Application.Shipments;
using Softaxis.Trade.Domain.Entities;
using Softaxis.Trade.Infrastructure.Persistence;

namespace Softaxis.Trade.Infrastructure.Handlers.Shipments;

internal static class TradeDates
{
    /// <summary>
    /// "Today" as the caller sees it. The server clock is UTC, so a user east of Greenwich is
    /// already on tomorrow for several hours each night — the client's date is used when it is
    /// within a day of the server's, and ignored otherwise.
    /// </summary>
    public static DateOnly Today(DateOnly? clientToday)
    {
        var utc = DateOnly.FromDateTime(DateTime.UtcNow);
        return clientToday is { } d && Math.Abs(d.DayNumber - utc.DayNumber) <= 1 ? d : utc;
    }
}

internal static class ShipmentSupport
{
    public const string ViewCosts = "trade.costs.view", ViewPayments = "trade.payments.view", ViewDocuments = "trade.documents.view";

    /// <summary>A shipment with everything under it. Split into several queries to avoid a cartesian product.</summary>
    public static Task<Shipment?> LoadAsync(TradeDbContext db, Guid id, CancellationToken ct, bool tracking = true)
    {
        var q = db.Shipments
            .Include(s => s.Items).Include(s => s.Containers).Include(s => s.Milestones)
            .Include(s => s.Costs).Include(s => s.Payments)
            .AsSplitQuery()
            .Where(s => s.Id == id && !s.IsDeleted);
        if (!tracking) q = q.AsNoTracking();
        return q.FirstOrDefaultAsync(ct);
    }

    public static async Task<ShipmentDto> ToDtoAsync(TradeDbContext db, Shipment s, ICurrentUser user, CancellationToken ct)
    {
        var canCosts    = user.HasPermission(ViewCosts);
        var canPayments = user.HasPermission(ViewPayments);
        var canDocs     = user.HasPermission(ViewDocuments);

        var ids = new[] { s.PartnerId, s.ForwarderId, s.AgentId }.Where(i => i.HasValue).Select(i => i!.Value).Distinct().ToList();
        var names = ids.Count == 0
            ? new Dictionary<Guid, string>()
            : await db.Parties.AsNoTracking().Where(p => ids.Contains(p.Id)).ToDictionaryAsync(p => p.Id, p => p.Name, ct);
        string? Name(Guid? id) => id.HasValue && names.TryGetValue(id.Value, out var n) ? n : null;

        var documents = canDocs
            ? (await db.Documents.AsNoTracking().Where(d => d.ShipmentId == s.Id && !d.IsDeleted)
                .OrderByDescending(d => d.CreatedAt)
                .Select(d => new { d.Id, d.Type, d.Number, d.IssueDate, d.ExpiryDate, d.Notes, d.FileName, d.ContentType, d.SizeBytes, d.CreatedAt })
                .ToListAsync(ct))
                .Select(d => new DocumentDto(d.Id, s.Id, null, d.Type, d.Number, d.IssueDate, d.ExpiryDate, d.Notes,
                    d.FileName, d.ContentType, d.SizeBytes, d.FileName != null, d.CreatedAt)).ToList()
            : new List<DocumentDto>();

        var landed = canCosts ? LandedCost.Calculate(s.Items, s.Costs, s.ExchangeRate).ToDictionary(l => l.ItemId) : null;

        var items = s.Items.OrderBy(i => i.Position).Select(i =>
        {
            LandedLine? l = null;
            landed?.TryGetValue(i.Id, out l);
            return new ItemDto(i.Id, i.Description, i.HsCode, i.OriginCountry, i.Quantity, i.Unit, i.UnitPrice, i.LineValue,
                i.WeightKg, i.VolumeCbm, i.Packages, i.ProductId, i.Sku,
                l?.GoodsValue, l?.AllocatedCost, l?.LandedTotal, l?.LandedUnitCost);
        }).ToList();

        var goodsBase  = Math.Round(s.GoodsValue * s.ExchangeRate, 2);
        var totalCosts = canCosts ? s.Costs.Sum(c => c.Amount) : (decimal?)null;

        return new ShipmentDto(
            s.Id, s.ShipmentNumber, s.Direction, s.Status, s.Mode,
            s.PartnerId, Name(s.PartnerId), s.ForwarderId, Name(s.ForwarderId), s.AgentId, Name(s.AgentId),
            s.OrderReference, s.Incoterm, s.BlNumber, s.CarrierName, s.VesselOrFlight,
            s.OriginCountry, s.OriginPort, s.DestinationCountry, s.DestinationPort,
            s.Etd, s.Eta, s.DepartedOn, s.ArrivedOn, s.ClearedOn, s.DeliveredOn,
            s.FreeDays, s.FreeTimeEnds, s.Currency, s.ExchangeRate, s.Notes, s.LinkedOrderType, s.LinkedOrderId,
            s.GoodsValue, goodsBase, totalCosts, totalCosts is null ? null : goodsBase + totalCosts,
            canPayments ? s.Payments.Where(p => p.Status == PaymentStatus.Paid).Sum(p => p.Amount) : null,
            canPayments ? s.Payments.Where(p => p.Status == PaymentStatus.Pending).Sum(p => p.Amount) : null,
            items,
            s.Containers.Select(c => new ContainerDto(c.Id, c.Number, c.Type, c.SealNumber, c.GrossWeightKg)).ToList(),
            s.Milestones.OrderBy(m => m.OccurredOn).ThenBy(m => m.RecordedAt)
                .Select(m => new MilestoneDto(m.Id, m.Status, m.OccurredOn, m.Note, m.RecordedBy, m.RecordedAt)).ToList(),
            canCosts
                ? s.Costs.OrderBy(c => c.CreatedAt).Select(c => new CostDto(c.Id, c.Type, c.Description, c.Amount, c.Basis,
                    c.VendorName, c.InvoiceReference, c.PaidOn)).ToList()
                : null,
            canPayments
                ? s.Payments.OrderBy(p => p.DueDate ?? DateOnly.MaxValue).ThenBy(p => p.CreatedAt).Select(p => new PaymentDto(p.Id, p.Kind, p.Amount,
                    p.DueDate, p.PaidOn, p.Status, p.Reference, p.LcNumber, p.BankName, p.LcExpiry, p.Notes)).ToList()
                : null,
            documents, s.CreatedAt, s.UpdatedAt);
    }

    public static IEnumerable<ShipmentItem> BuildItems(IEnumerable<ItemInput> items) => items.Select(i => new ShipmentItem(
        i.Description, i.HsCode, i.OriginCountry, i.Quantity, i.Unit ?? "pcs", i.UnitPrice, i.WeightKg, i.VolumeCbm,
        i.Packages, i.ProductId, i.Sku));

    public static IEnumerable<ShipmentContainer> BuildContainers(IEnumerable<ContainerInput> containers) =>
        containers.Select(c => new ShipmentContainer(c.Number, c.Type, c.SealNumber, c.GrossWeightKg));
}
