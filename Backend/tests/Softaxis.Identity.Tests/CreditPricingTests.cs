using Softaxis.Identity.Application.Billing.Credits;
using Softaxis.Identity.Domain.Entities;

namespace Softaxis.Identity.Tests;

public class CreditPricingTests
{
    private static CreditPricingSettings Settings(decimal seo = 0.05m, decimal lead = 0.10m, decimal fee = 0, decimal vat = 0, bool swap = true)
    {
        var s = new CreditPricingSettings();
        s.Update(new Dictionary<string, decimal> { ["seo"] = seo, ["leadgen"] = lead }, CreditPricingSettings.DefaultTiers(),
            20, 5m, 1000m, vat, swap, fee, 10, "test");
        return s;
    }

    [Fact]
    public void Module_without_a_price_is_not_for_sale()
    {
        var s = new CreditPricingSettings();
        Assert.True(CreditPricing.Quote(s, "seo", 100).IsFailure);
    }

    [Fact]
    public void Below_minimum_credits_is_refused()
    {
        Assert.True(CreditPricing.Quote(Settings(), "seo", 19).IsFailure);
    }

    [Fact]
    public void Below_minimum_order_value_is_refused_and_says_how_many_credits()
    {
        // 20 × $0.05 = $1.00 < $5
        var r = CreditPricing.Quote(Settings(), "seo", 20);
        Assert.True(r.IsFailure);
        Assert.Contains("$5.00", r.Error.Description);
    }

    [Fact]
    public void Above_maximum_order_asks_to_contact_us()
    {
        var r = CreditPricing.Quote(Settings(), "leadgen", 20000); // 2000 − 20% = 1600
        Assert.True(r.IsFailure);
        Assert.Contains("contact", r.Error.Description, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Volume_discount_applies_to_the_whole_order()
    {
        var q = CreditPricing.Quote(Settings(), "seo", 500).Value; // 25.00 gross, 10% off
        Assert.Equal(25m, q.GrossAmount);
        Assert.Equal(10m, q.DiscountPercent);
        Assert.Equal(22.5m, q.NetAmount);
        Assert.Equal(22.5m, q.TotalAmount);
    }

    [Fact]
    public void Vat_is_added_on_top_when_set()
    {
        var q = CreditPricing.Quote(Settings(vat: 5), "seo", 200).Value; // 10.00 - 5% = 9.50
        Assert.Equal(9.5m, q.NetAmount);
        Assert.Equal(0.48m, q.VatAmount);
        Assert.Equal(9.98m, q.TotalAmount);
    }

    [Fact]
    public void Swap_follows_the_written_example()
    {
        // 20 SEO @ $0.05 = $1.00 → Lead Gen @ $0.10 = 10 credits
        var q = CreditSwapPricing.Quote(Settings(), "seo", "leadgen", 20).Value;
        Assert.Equal(20, q.CreditsTaken);
        Assert.Equal(10, q.CreditsReceived);
    }

    [Fact]
    public void Swap_never_takes_more_than_needed()
    {
        // 25 SEO = $1.25 → floor(12.5) = 12 lead credits; 24 SEO is enough to make 12.
        var q = CreditSwapPricing.Quote(Settings(), "seo", "leadgen", 25).Value;
        Assert.Equal(12, q.CreditsReceived);
        Assert.Equal(24, q.CreditsTaken);
    }

    [Fact]
    public void Swap_fee_reduces_what_you_receive()
    {
        var q = CreditSwapPricing.Quote(Settings(fee: 10), "seo", "leadgen", 20).Value; // $1.00 × 0.9 = $0.90 → 9
        Assert.Equal(9, q.CreditsReceived);
    }

    [Fact]
    public void Swap_to_cheaper_module_gives_more_credits()
    {
        var q = CreditSwapPricing.Quote(Settings(), "leadgen", "seo", 10).Value; // $1.00 → 20
        Assert.Equal(20, q.CreditsReceived);
        Assert.Equal(10, q.CreditsTaken);
    }

    [Fact]
    public void Swap_rules_are_enforced()
    {
        Assert.True(CreditSwapPricing.Quote(Settings(swap: false), "seo", "leadgen", 20).IsFailure);
        Assert.True(CreditSwapPricing.Quote(Settings(), "seo", "seo", 20).IsFailure);
        Assert.True(CreditSwapPricing.Quote(Settings(), "seo", "leadgen", 9).IsFailure);
        Assert.True(CreditSwapPricing.Quote(Settings(), "seo", "nothing", 20).IsFailure);
    }

    [Fact]
    public void Swap_too_small_to_make_one_credit_is_refused()
    {
        // 10 SEO = $0.50 → at $1.00 per credit that's 0
        var s = Settings(seo: 0.05m, lead: 1m);
        Assert.True(CreditSwapPricing.Quote(s, "seo", "leadgen", 10).IsFailure);
    }

    [Fact]
    public void Swap_never_gives_more_value_than_it_takes()
    {
        var s = Settings(seo: 0.037m, lead: 0.091m);
        for (var c = 10; c <= 400; c++)
        {
            var r = CreditSwapPricing.Quote(s, "seo", "leadgen", c);
            if (r.IsFailure) continue;
            Assert.True(r.Value.ValueReceived <= r.Value.ValueMoved + 0.0001m);
            Assert.True(r.Value.CreditsTaken <= c);
        }
    }
}
