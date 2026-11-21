using Microsoft.EntityFrameworkCore;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Handlers.GeneralLedger;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Services;

/// <summary>
/// The one place that works out and books the "put aside X% of this income" amounts. Opt-in: a
/// workspace with no rules, and an invoice with no set-asides, goes through here and changes nothing.
/// </summary>
internal static class SetAsideService
{
    /// <summary>The workspace's rules that apply to every new invoice (active + auto-apply).</summary>
    public static async Task<IReadOnlyList<SetAsideDef>> DefaultsAsync(FinanceDbContext db, CancellationToken ct)
        => (await db.SetAsideRules.AsNoTracking()
                .Where(r => !r.IsDeleted && r.IsActive && r.AutoApply)
                .OrderBy(r => r.CreatedAt)
                .ToListAsync(ct))
            .Select(r => r.ToDef()).ToList();

    /// <summary>
    /// Records what is now owed because <paramref name="amountPaid"/> of the invoice was received:
    /// one entry per set-aside, plus one ledger entry (Dr Set-Aside Contributions, Cr Set-Aside
    /// Payable). Money is NOT moved — it stays wherever the payment landed; paying it out is a
    /// separate, later step. A part-payment accrues its proportional share.
    /// </summary>
    public static async Task AccrueAsync(
        FinanceDbContext db, Invoice invoice, decimal amountPaid, string date, string sourceKey, CancellationToken ct)
    {
        var defs = invoice.SetAsides;
        if (defs.Count == 0 || amountPaid <= 0 || invoice.Total <= 0) return;

        var share = Math.Min(1m, amountPaid / invoice.Total);
        var rate  = await GlPoster.GetRateAsync(db, invoice.CurrencyCode, date, ct);
        var baseLedger = Math.Round(invoice.SubTotal * share * rate, 2, MidpointRounding.AwayFromZero);

        var eventId = Guid.NewGuid();
        var rows = new List<(SetAsideDef Def, decimal Amount, decimal Ledger)>();
        foreach (var d in defs)
        {
            var amount = d.AmountFor(invoice.SubTotal, share);
            if (amount <= 0) continue;
            rows.Add((d, amount, Math.Round(amount * rate, 2, MidpointRounding.AwayFromZero)));
        }
        if (rows.Count == 0) return;

        var lines = new List<GlPoster.Line>();
        foreach (var r in rows)
            lines.Add(new(GlPoster.SetAsideContributions, r.Ledger, 0, $"{r.Def.Name} - Invoice {invoice.InvoiceNumber}"));
        lines.Add(new(GlPoster.SetAsidePayable, 0, rows.Sum(r => r.Ledger), $"Set-aside owed - Invoice {invoice.InvoiceNumber}"));

        var journalId = await GlPoster.PostAsync(
            db, date, $"Set-aside on income - Invoice {invoice.InvoiceNumber}", invoice.InvoiceNumber, lines, ct);

        foreach (var r in rows)
            db.SetAsideEntries.Add(new SetAsideEntry(eventId, sourceKey, invoice.Id, invoice.InvoiceNumber,
                r.Def.Name, r.Amount, r.Ledger, baseLedger, invoice.CurrencyCode, date, journalId));
    }

    /// <summary>
    /// Takes back what a reversed payment had put aside: voids the ledger entry and removes the
    /// owed rows. Anything already paid out is left alone (that money has gone) and is counted so
    /// the caller can say so.
    /// </summary>
    public static async Task<int> ReverseAsync(
        FinanceDbContext db, Guid invoiceId, string? sourceKey, CancellationToken ct)
    {
        var q = db.SetAsideEntries.Where(e => !e.IsDeleted && e.InvoiceId == invoiceId);
        if (sourceKey is not null) q = q.Where(e => e.SourceKey == sourceKey);
        var entries = await q.ToListAsync(ct);

        // One ledger entry covers every row of a payment, so it can only be voided when none of
        // those rows has been paid out; otherwise the whole group is kept and reported.
        var kept = 0;
        foreach (var group in entries.GroupBy(e => e.EventId))
        {
            if (group.Any(e => e.IsPaid)) { kept += group.Count(); continue; }
            await GlPoster.VoidAsync(db, group.First().JournalEntryId, ct);
            foreach (var e in group) e.Remove();
        }

        return kept;
    }
}
