namespace Softaxis.POS.Application.Customers.Credit;

/// <summary>One credit-account ledger row, as stored.</summary>
public sealed record CreditLedgerRow(
    Guid Id, string Type, decimal Amount, DateTime CreatedAt, DateTime? DueOn, Guid? OrderId, string? Notes, string? Method);

/// <summary>What is still owed, charge by charge, and how overdue each part is.</summary>
public sealed record CreditPosition(
    IReadOnlyList<OpenCharge> Open, decimal BroughtForward, CreditAgeingDto Ageing);

public sealed record OpenCharge(CreditLedgerRow Row, DateTime Due, decimal Outstanding, int DaysOverdue);

/// <summary>
/// Works out ageing from the account ledger. Money returned for a sale (a refund or void) is taken off
/// THAT sale's charge first; payments, and anything left over from a return, are applied to the OLDEST
/// charge first, which is how a house account is normally settled and means nothing extra has to be
/// stored per charge. Pure — no database — so every rule here is unit-tested.
/// </summary>
public static class CreditAgeing
{
    public const string Charge = "house_charge", Payment = "house_payment", Return = "house_refund";

    public static bool IsCreditRow(string type) => type is Charge or Payment or Return;

    public static CreditPosition Build(IReadOnlyList<CreditLedgerRow> rows, decimal creditBalance, int termsDays, DateTime todayUtc)
    {
        var today = todayUtc.Date;
        var charges = rows.Where(r => r.Type == Charge).OrderBy(r => r.CreatedAt).ThenBy(r => r.Id).ToList();
        var remaining = charges.ToDictionary(c => c.Id, c => c.Amount);

        // 1) A return goes against the sale it came from.
        decimal pool = rows.Where(r => r.Type == Payment).Sum(r => r.Amount);
        foreach (var ret in rows.Where(r => r.Type == Return))
        {
            var left = ret.Amount;
            foreach (var c in charges.Where(c => ret.OrderId != null && c.OrderId == ret.OrderId))
            {
                var take = Math.Min(left, remaining[c.Id]);
                remaining[c.Id] -= take;
                left -= take;
            }
            pool += left; // nothing (or not enough) to offset: treat the rest like a payment
        }

        // 2) Payments, and any leftover, settle the oldest charge first.
        var open = new List<OpenCharge>();
        foreach (var c in charges)
        {
            var take = Math.Min(pool, remaining[c.Id]);
            pool -= take;
            var left = remaining[c.Id] - take;
            if (left <= 0.004m) continue;

            var due = (c.DueOn ?? c.CreatedAt.Date.AddDays(termsDays)).Date;
            open.Add(new OpenCharge(c, due, left, Math.Max(0, (today - due).Days)));
        }

        // The account balance can hold more than the ledger explains (a balance from before the ledger
        // existed). It is shown as brought forward and treated as not yet due: nothing says it is late.
        var explained = open.Sum(o => o.Outstanding);
        var broughtForward = Math.Max(0, Math.Round(creditBalance - explained, 2));
        if (broughtForward < 0.01m) broughtForward = 0;

        decimal cur = broughtForward, b1 = 0, b2 = 0, b3 = 0, b4 = 0;
        foreach (var o in open)
        {
            if (o.DaysOverdue == 0) cur += o.Outstanding;
            else if (o.DaysOverdue <= 30) b1 += o.Outstanding;
            else if (o.DaysOverdue <= 60) b2 += o.Outstanding;
            else if (o.DaysOverdue <= 90) b3 += o.Outstanding;
            else b4 += o.Outstanding;
        }
        return new CreditPosition(open, broughtForward, new CreditAgeingDto(cur, b1, b2, b3, b4));
    }
}
