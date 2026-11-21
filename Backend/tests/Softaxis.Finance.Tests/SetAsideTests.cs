using Softaxis.Finance.Domain.Entities;

namespace Softaxis.Finance.Tests;

public class SetAsideTests
{
    private static Invoice InvoiceOf(decimal price, decimal taxRate = 5m)
    {
        var inv = new Invoice("Acme", null, "2026-11-01", "2026-12-01", taxRate, null);
        inv.Items.Add(new InvoiceItem(inv.Id, "Service", 1, price));
        return inv;
    }

    [Fact]
    public void Percent_is_taken_on_the_amount_before_VAT()
    {
        var inv = InvoiceOf(1000m); // total 1050
        var charity = new SetAsideDef("Charity", "percent", 5m);
        Assert.Equal(50m, charity.AmountFor(inv.SubTotal, 1m));
    }

    [Fact]
    public void A_part_payment_sets_aside_its_proportional_share()
    {
        var inv = InvoiceOf(1000m);
        var charity = new SetAsideDef("Charity", "percent", 5m);
        var share = 525m / inv.Total; // half of 1050
        Assert.Equal(25m, charity.AmountFor(inv.SubTotal, share));
    }

    [Fact]
    public void A_fixed_amount_is_spread_across_payments()
    {
        var fixedAmount = new SetAsideDef("Zakat", "fixed", 200m);
        Assert.Equal(200m, fixedAmount.AmountFor(1000m, 1m));
        Assert.Equal(80m, fixedAmount.AmountFor(1000m, 0.4m));
    }

    [Fact]
    public void Json_round_trips_and_drops_invalid_rows()
    {
        var json = SetAsideDef.Serialise([
            new SetAsideDef(" Charity ", "percent", 5m),
            new SetAsideDef("", "percent", 5m),          // no name
            new SetAsideDef("Bad", "percent", 150m),      // over 100%
            new SetAsideDef("Zero", "fixed", 0m),         // nothing to set aside
        ]);

        var back = SetAsideDef.Parse(json);
        var only = Assert.Single(back);
        Assert.Equal("Charity", only.Name);
    }

    [Fact]
    public void Empty_or_garbage_json_means_no_set_asides()
    {
        Assert.Empty(SetAsideDef.Parse(null));
        Assert.Empty(SetAsideDef.Parse("not json"));
        Assert.Null(SetAsideDef.Serialise([]));
    }

    [Fact]
    public void A_template_can_say_none_explicitly_which_differs_from_unset()
    {
        var unset = new RecurringInvoice("T", "Acme", null, "monthly", DateTime.UtcNow, null, 30, 5m, null);
        Assert.Null(unset.SetAsidesJson);

        var none = new RecurringInvoice("T", "Acme", null, "monthly", DateTime.UtcNow, null, 30, 5m, null);
        none.SetSetAsides([]);
        Assert.Equal("[]", none.SetAsidesJson);          // "no set-asides", not "use the defaults"
        Assert.Empty(SetAsideDef.Parse(none.SetAsidesJson));
    }

    [Fact]
    public void An_invoice_reports_the_set_asides_it_was_given()
    {
        var inv = InvoiceOf(1000m);
        inv.SetSetAsides([new SetAsideDef("Charity", "percent", 5m)]);
        Assert.Single(inv.SetAsides);

        inv.SetSetAsides(null);
        Assert.Empty(inv.SetAsides);
    }
}
