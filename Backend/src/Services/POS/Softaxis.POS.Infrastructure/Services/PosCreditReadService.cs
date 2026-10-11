using Microsoft.EntityFrameworkCore;
using Softaxis.POS.Application.Abstractions;
using Softaxis.POS.Application.Customers.Credit;
using Softaxis.POS.Infrastructure.Persistence;

namespace Softaxis.POS.Infrastructure.Services;

/// <summary>
/// Reads the house-account ledger. Tenant scoping is the DbContext's global filter; soft-delete is
/// applied by hand because that filter replaces any entity-level one.
/// </summary>
public sealed class PosCreditReadService(POSDbContext db) : IPosCreditReadService
{
    private const int MaxCustomers = 1000;
    private const int MaxEntries = 200;
    private const decimal NearLimitShare = 0.8m;

    private static readonly string[] CreditTypes = [CreditAgeing.Charge, CreditAgeing.Payment, CreditAgeing.Return];

    private static string Day(DateTime d) => d.ToString("yyyy-MM-dd");

    public async Task<CustomerCreditDto?> GetCustomerAsync(Guid customerId, DateTime todayUtc, CancellationToken ct = default)
    {
        var c = await db.Customers.AsNoTracking().FirstOrDefaultAsync(x => x.Id == customerId && !x.IsDeleted, ct);
        if (c is null) return null;

        var rows = await db.CustomerWalletTransactions.AsNoTracking()
            .Where(t => t.CustomerId == customerId && CreditTypes.Contains(t.Type))
            .OrderBy(t => t.CreatedAt)
            .Select(t => new CreditLedgerRow(t.Id, t.Type, t.Amount, t.CreatedAt, t.DueOn, t.OrderId, t.Notes, t.PaymentMethod))
            .ToListAsync(ct);

        var pos = CreditAgeing.Build(rows, c.CreditBalance, c.CreditTermsDays, todayUtc);

        // Sale numbers for the rows that came from a till sale. A restaurant charge has no row here and
        // keeps its own note.
        var ids = rows.Where(r => r.OrderId != null).Select(r => r.OrderId!.Value).Distinct().ToList();
        var saleNumbers = ids.Count == 0
            ? new Dictionary<Guid, string>()
            : await db.Transactions.AsNoTracking().Where(t => ids.Contains(t.Id))
                .Select(t => new { t.Id, t.TransactionNumber }).ToDictionaryAsync(t => t.Id, t => t.TransactionNumber, ct);

        // A return keeps its own note ("Refund … of sale …"); a charge shows its sale number.
        string Ref(CreditLedgerRow r) =>
            r.Type != CreditAgeing.Return && r.OrderId is Guid o && saleNumbers.TryGetValue(o, out var n) ? n : (r.Notes ?? "");

        var open = pos.Open.Select(o => new CreditItemDto(o.Row.Id, Day(o.Row.CreatedAt), Day(o.Due), Ref(o.Row),
            o.Row.OrderId, o.Row.Amount, o.Outstanding, o.DaysOverdue)).ToList();

        decimal running = 0;
        var entries = new List<CreditEntryDto>();
        foreach (var r in rows)
        {
            running += r.Type == CreditAgeing.Charge ? r.Amount : -r.Amount;
            entries.Add(new CreditEntryDto(r.Id, r.CreatedAt, r.Type switch
            {
                CreditAgeing.Charge => "charge", CreditAgeing.Payment => "payment", _ => "returned",
            }, r.Amount, Ref(r), r.Method, Math.Max(0, running)));
        }
        entries.Reverse();

        var overdue = pos.Ageing.Overdue;
        var oldest = open.Count == 0 ? 0 : open.Max(o => o.DaysOverdue);
        var next = pos.Open.Where(o => o.DaysOverdue == 0).OrderBy(o => o.Due).FirstOrDefault();
        var lastPay = rows.Where(r => r.Type == CreditAgeing.Payment).OrderByDescending(r => r.CreatedAt).FirstOrDefault();

        return new CustomerCreditDto(c.Id, c.Name, c.Phone, c.Email, c.Address,
            c.CreditLimit, c.CreditBalance, c.AvailableCredit, c.CreditTermsDays, c.CreditHold, c.CreditHoldReason,
            overdue, oldest, next is null ? null : Day(next.Due), next?.Outstanding ?? 0,
            lastPay is null ? null : Day(lastPay.CreatedAt), lastPay?.Amount ?? 0,
            rows.Where(r => r.Type == CreditAgeing.Charge).Sum(r => r.Amount),
            rows.Where(r => r.Type == CreditAgeing.Payment).Sum(r => r.Amount),
            pos.Ageing, open, entries.Take(MaxEntries).ToList());
    }

    public async Task<CreditOverviewDto> GetOverviewAsync(DateTime todayUtc, CancellationToken ct = default)
    {
        var customers = await db.Customers.AsNoTracking()
            .Where(c => !c.IsDeleted && (c.CreditBalance > 0 || c.CreditLimit > 0 || c.CreditHold))
            .OrderByDescending(c => c.CreditBalance).ThenBy(c => c.Name)
            .Take(MaxCustomers + 1).ToListAsync(ct);
        var truncated = customers.Count > MaxCustomers;
        if (truncated) customers = customers.Take(MaxCustomers).ToList();

        var ids = customers.Select(c => c.Id).ToList();
        var ledger = ids.Count == 0
            ? []
            : await db.CustomerWalletTransactions.AsNoTracking()
                .Where(t => ids.Contains(t.CustomerId) && CreditTypes.Contains(t.Type))
                .Select(t => new { t.CustomerId, Row = new CreditLedgerRow(t.Id, t.Type, t.Amount, t.CreatedAt, t.DueOn, t.OrderId, t.Notes, t.PaymentMethod) })
                .ToListAsync(ct);
        var byCustomer = ledger.GroupBy(x => x.CustomerId).ToDictionary(g => g.Key, g => g.Select(x => x.Row).ToList());

        var rows = new List<CreditCustomerRowDto>();
        decimal cur = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, dueWeek = 0;
        var weekEnd = todayUtc.Date.AddDays(7);
        foreach (var c in customers)
        {
            var l = byCustomer.GetValueOrDefault(c.Id) ?? [];
            var pos = CreditAgeing.Build(l, c.CreditBalance, c.CreditTermsDays, todayUtc);
            cur += pos.Ageing.Current; b1 += pos.Ageing.Days1To30; b2 += pos.Ageing.Days31To60;
            b3 += pos.Ageing.Days61To90; b4 += pos.Ageing.Over90;
            dueWeek += pos.Open.Where(o => o.DaysOverdue == 0 && o.Due <= weekEnd).Sum(o => o.Outstanding);

            var next = pos.Open.Where(o => o.DaysOverdue == 0).OrderBy(o => o.Due).FirstOrDefault();
            var lastPay = l.Where(r => r.Type == CreditAgeing.Payment).OrderByDescending(r => r.CreatedAt).FirstOrDefault();
            rows.Add(new CreditCustomerRowDto(c.Id, c.Name, c.Phone, c.CreditLimit, c.CreditBalance, c.AvailableCredit,
                c.CreditTermsDays, c.CreditHold, pos.Ageing.Overdue, pos.Open.Count == 0 ? 0 : pos.Open.Max(o => o.DaysOverdue),
                next is null ? null : Day(next.Due), lastPay is null ? null : Day(lastPay.CreatedAt)));
        }

        var monthStart = new DateTime(todayUtc.Year, todayUtc.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var collected = await db.CustomerWalletTransactions.AsNoTracking()
            .Where(t => t.Type == CreditAgeing.Payment && t.CreatedAt >= monthStart)
            .SumAsync(t => (decimal?)t.Amount, ct) ?? 0;

        var ageing = new CreditAgeingDto(cur, b1, b2, b3, b4);
        return new CreditOverviewDto(
            rows.Sum(r => r.CreditBalance), ageing.Overdue, rows.Sum(r => r.CreditLimit), collected,
            rows.Count(r => r.CreditBalance > 0), rows.Count(r => r.Overdue > 0),
            rows.Count(r => r.CreditLimit > 0 && r.CreditBalance >= r.CreditLimit * NearLimitShare && r.CreditBalance > 0),
            rows.Count(r => r.OnHold), dueWeek, ageing,
            rows.OrderByDescending(r => r.Overdue).ThenByDescending(r => r.CreditBalance).ToList(), truncated);
    }
}
