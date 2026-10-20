using Microsoft.EntityFrameworkCore;
using Softaxis.Trade.Application.Dashboard;
using Softaxis.Trade.Domain.Entities;
using Softaxis.Trade.Infrastructure.Persistence;

namespace Softaxis.Trade.Infrastructure.Handlers.Dashboard;

/// <summary>What needs attention, with the figures the dashboard tiles and the daily alert both need.</summary>
internal sealed record AttentionResult(
    IReadOnlyList<AttentionDto> Items, decimal PaymentsDue, int PaymentsOverdue, int DocumentsExpiring, int DocumentsExpired);

/// <summary>
/// The single place "what is late, running out or about to lapse" is decided. The dashboard shows
/// it and the daily alert counts it; keeping one copy means they can never disagree about whether
/// a shipment is late.
/// </summary>
internal static class AttentionCalculator
{
    public const int SoonDays = 14, DocumentDays = 30, DemurrageWarnDays = 3;

    private static bool Moving(string status) => status is ShipmentStatus.Booked or ShipmentStatus.InTransit;

    /// <param name="includePayments">False for a caller who may not see payments: they get no payment or L/C items at all.</param>
    /// <param name="includeDocuments">False for a caller who may not see documents.</param>
    public static async Task<AttentionResult> BuildAsync(
        TradeDbContext db, DateOnly today, bool includePayments, bool includeDocuments, CancellationToken ct)
    {
        var soon = today.AddDays(SoonDays);

        var open = await db.Shipments.AsNoTracking()
            .Where(s => !s.IsDeleted && s.Status != ShipmentStatus.Delivered && s.Status != ShipmentStatus.Closed
                     && s.Status != ShipmentStatus.Cancelled)
            .Select(s => new { s.Id, s.ShipmentNumber, s.Direction, s.Status, s.Eta, s.ArrivedOn, s.FreeDays })
            .ToListAsync(ct);

        var items = new List<AttentionDto>();

        // Cargo that should have arrived by now.
        foreach (var s in open.Where(s => Moving(s.Status) && s.Eta is { } e && e < today))
            items.Add(new("delayed", s.Id, s.ShipmentNumber, s.Direction, "Expected arrival has passed", s.Eta, today.DayNumber - s.Eta!.Value.DayNumber));

        // Free days at the port running out, or already out.
        foreach (var s in open.Where(s => s.ArrivedOn is not null && s.FreeDays is not null
                                          && s.Status is ShipmentStatus.Arrived or ShipmentStatus.Customs))
        {
            var ends = s.ArrivedOn!.Value.AddDays(s.FreeDays!.Value);
            var left = ends.DayNumber - today.DayNumber;
            if (left <= DemurrageWarnDays)
                items.Add(new(left < 0 ? "demurrage" : "free_time", s.Id, s.ShipmentNumber, s.Direction,
                    left < 0 ? "Free days at the port have run out" : "Free days at the port are running out", ends, left));
        }

        decimal dueAmount = 0; var overdue = 0;
        if (includePayments)
        {
            var pay = await db.Payments.AsNoTracking()
                .Where(p => p.Status == PaymentStatus.Pending)
                .Join(db.Shipments.Where(s => !s.IsDeleted && s.Status != ShipmentStatus.Cancelled),
                    p => p.ShipmentId, s => s.Id,
                    (p, s) => new { p.Kind, p.Amount, p.DueDate, p.LcExpiry, p.LcNumber, ShipmentId = s.Id, s.ShipmentNumber, s.Direction, s.ExchangeRate })
                .ToListAsync(ct);

            foreach (var p in pay)
            {
                if (p.DueDate is { } due && due <= soon)
                {
                    dueAmount += Math.Round(p.Amount * p.ExchangeRate, 2);
                    if (due < today) overdue++;
                    items.Add(new(due < today ? "payment_overdue" : "payment_due", p.ShipmentId, p.ShipmentNumber, p.Direction,
                        $"{p.Kind.ToUpperInvariant()} payment {(due < today ? "is overdue" : "is due")}", due, today.DayNumber - due.DayNumber));
                }
                // A letter of credit that lapses before it is used is money that cannot be drawn.
                if (p.Kind == PaymentKind.LetterOfCredit && p.LcExpiry is { } lc && lc <= soon)
                    items.Add(new(lc < today ? "lc_expired" : "lc_expiring", p.ShipmentId, p.ShipmentNumber, p.Direction,
                        $"Letter of credit {p.LcNumber ?? ""} {(lc < today ? "has expired" : "expires soon")}".Replace("  ", " "), lc, today.DayNumber - lc.DayNumber));
            }
        }

        int docsExpiring = 0, docsExpired = 0;
        if (includeDocuments)
        {
            var limit = today.AddDays(DocumentDays);
            var docs = await db.Documents.AsNoTracking()
                .Where(d => !d.IsDeleted && d.ExpiryDate != null && d.ExpiryDate <= limit)
                .Join(db.Shipments.Where(s => !s.IsDeleted && s.Status != ShipmentStatus.Closed && s.Status != ShipmentStatus.Cancelled),
                    d => d.ShipmentId, s => s.Id,
                    (d, s) => new { d.Type, d.Number, d.ExpiryDate, ShipmentId = s.Id, s.ShipmentNumber, s.Direction })
                .ToListAsync(ct);

            foreach (var d in docs)
            {
                var exp = d.ExpiryDate!.Value;
                if (exp < today) docsExpired++; else docsExpiring++;
                items.Add(new(exp < today ? "document_expired" : "document_expiring", d.ShipmentId, d.ShipmentNumber, d.Direction,
                    $"{d.Type.Replace('_', ' ')} {(string.IsNullOrWhiteSpace(d.Number) ? "" : d.Number + " ")}{(exp < today ? "has expired" : "expires soon")}",
                    exp, today.DayNumber - exp.DayNumber));
            }
        }

        return new AttentionResult(items.OrderBy(a => a.Date ?? DateOnly.MaxValue).ToList(), dueAmount, overdue, docsExpiring, docsExpired);
    }
}
