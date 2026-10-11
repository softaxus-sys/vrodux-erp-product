using Softaxis.POS.Application.Customers.Credit;

namespace Softaxis.POS.Tests;

public class CreditAgeingTests
{
    private static readonly DateTime Today = new(2026, 10, 11, 12, 0, 0, DateTimeKind.Utc);

    private static CreditLedgerRow Charge(Guid sale, decimal amt, int daysAgo, int? dueInDays = null) =>
        new(Guid.NewGuid(), CreditAgeing.Charge, amt, Today.AddDays(-daysAgo), dueInDays is null ? null : Today.Date.AddDays(dueInDays.Value), sale, null, null);

    private static CreditLedgerRow Pay(decimal amt, int daysAgo = 0) =>
        new(Guid.NewGuid(), CreditAgeing.Payment, amt, Today.AddDays(-daysAgo), null, null, null, "cash");

    private static CreditLedgerRow Return(Guid sale, decimal amt) =>
        new(Guid.NewGuid(), CreditAgeing.Return, amt, Today, null, sale, null, null);

    [Fact]
    public void A_charge_is_not_late_until_its_due_date_has_passed()
    {
        var p = CreditAgeing.Build([Charge(Guid.NewGuid(), 100, 5, dueInDays: 0)], 100, 30, Today);
        Assert.Equal(100, p.Ageing.Current);
        Assert.Equal(0, p.Ageing.Overdue);
    }

    [Theory]
    [InlineData(1, "d1")] [InlineData(30, "d1")] [InlineData(31, "d2")] [InlineData(60, "d2")]
    [InlineData(61, "d3")] [InlineData(90, "d3")] [InlineData(91, "d4")]
    public void Days_late_fall_in_the_right_band(int late, string band)
    {
        var p = CreditAgeing.Build([Charge(Guid.NewGuid(), 100, 200, dueInDays: -late)], 100, 30, Today);
        var a = p.Ageing;
        var got = a.Days1To30 > 0 ? "d1" : a.Days31To60 > 0 ? "d2" : a.Days61To90 > 0 ? "d3" : a.Over90 > 0 ? "d4" : "none";
        Assert.Equal(band, got);
        Assert.Equal(late, p.Open[0].DaysOverdue);
    }

    [Fact]
    public void Payments_settle_the_oldest_charge_first()
    {
        var old = Charge(Guid.NewGuid(), 100, 60, dueInDays: -30);
        var recent = Charge(Guid.NewGuid(), 50, 2, dueInDays: 28);
        var p = CreditAgeing.Build([old, recent, Pay(70)], 80, 30, Today);
        Assert.Equal(2, p.Open.Count);
        Assert.Equal(30, p.Open[0].Outstanding);
        Assert.Equal(50, p.Open[1].Outstanding);
        Assert.Equal(30, p.Ageing.Days1To30);
        Assert.Equal(50, p.Ageing.Current);
    }

    [Fact]
    public void A_return_offsets_its_own_sale_not_the_oldest()
    {
        var oldSale = Guid.NewGuid(); var newSale = Guid.NewGuid();
        var p = CreditAgeing.Build([Charge(oldSale, 100, 60, dueInDays: -30), Charge(newSale, 40, 1, dueInDays: 29), Return(newSale, 40)], 100, 30, Today);
        Assert.Single(p.Open);
        Assert.Equal(oldSale, p.Open[0].Row.OrderId);
        Assert.Equal(100, p.Open[0].Outstanding);
    }

    [Fact]
    public void A_return_larger_than_its_sale_spills_over_like_a_payment()
    {
        var a = Guid.NewGuid(); var b = Guid.NewGuid();
        var p = CreditAgeing.Build([Charge(a, 100, 50, dueInDays: -20), Charge(b, 30, 1, dueInDays: 29), Return(b, 50)], 80, 30, Today);
        Assert.Equal(80, p.Open.Sum(o => o.Outstanding));
        Assert.Equal(80, p.Open[0].Outstanding); // 100 - 20 spilled
    }

    [Fact]
    public void Charges_without_a_due_date_use_the_customers_terms()
    {
        var p = CreditAgeing.Build([Charge(Guid.NewGuid(), 100, 40)], 100, 30, Today); // bought 40 days ago, 30-day terms
        Assert.Equal(10, p.Open[0].DaysOverdue);
    }

    [Fact]
    public void A_balance_the_ledger_cannot_explain_is_brought_forward_and_not_late()
    {
        var p = CreditAgeing.Build([], 250, 30, Today);
        Assert.Equal(250, p.BroughtForward);
        Assert.Equal(250, p.Ageing.Current);
        Assert.Equal(0, p.Ageing.Overdue);
    }

    [Fact]
    public void Fully_paid_charges_disappear()
    {
        var p = CreditAgeing.Build([Charge(Guid.NewGuid(), 100, 10), Pay(100)], 0, 30, Today);
        Assert.Empty(p.Open);
        Assert.Equal(0, p.Ageing.Total);
    }
}
