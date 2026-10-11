using Softaxis.Finance.Infrastructure.Integrations;

namespace Softaxis.Finance.Tests;

public class PostingLineBuilderTests
{
    private static readonly IntegrationDefinition Sale = IntegrationCatalogue.Find("pos.sale")!;

    private static Dictionary<string, ResolvedAccount> Accounts(IntegrationDefinition def, params string[] without) =>
        def.Roles.Where(r => !without.Contains(r.Role))
            .ToDictionary(r => r.Role, r => new ResolvedAccount(Guid.NewGuid(), r.DefaultAccountNumber, r.Label, true));

    [Fact]
    public void A_cash_sale_with_tax_posts_three_balanced_lines()
    {
        var entry = PostingLineBuilder.Build(Sale,
            new Dictionary<string, decimal> { ["cash"] = 105m, ["bank"] = 0m, ["revenue"] = 100m, ["tax"] = 5m },
            Accounts(Sale), rate: 1m);

        Assert.True(entry.CanPost);
        Assert.Equal(3, entry.Lines.Count);               // the zero bank line is dropped
        Assert.Equal(105m, entry.TotalDebit);
        Assert.Equal(105m, entry.TotalCredit);
        Assert.Equal(105m, entry.Lines.Single(l => l.Role == "cash").Debit);
        Assert.Equal(100m, entry.Lines.Single(l => l.Role == "revenue").Credit);
        Assert.Equal(5m,   entry.Lines.Single(l => l.Role == "tax").Credit);
    }

    [Fact]
    public void A_role_with_an_amount_and_no_account_blocks_posting_and_is_named()
    {
        var entry = PostingLineBuilder.Build(Sale,
            new Dictionary<string, decimal> { ["cash"] = 105m, ["revenue"] = 100m, ["tax"] = 5m },
            Accounts(Sale, without: "tax"), rate: 1m);

        Assert.False(entry.CanPost);
        Assert.Contains(entry.Problems, p => p.Contains("Sales tax collected"));
    }

    [Fact]
    public void A_missing_account_for_a_role_with_no_amount_does_not_block_posting()
    {
        var entry = PostingLineBuilder.Build(Sale,
            new Dictionary<string, decimal> { ["cash"] = 100m, ["revenue"] = 100m, ["tax"] = 0m },
            Accounts(Sale, without: "tax"), rate: 1m);

        Assert.True(entry.CanPost);
    }

    [Fact]
    public void An_inactive_account_blocks_posting()
    {
        var accounts = Accounts(Sale);
        accounts["revenue"] = accounts["revenue"] with { IsActive = false };

        var entry = PostingLineBuilder.Build(Sale,
            new Dictionary<string, decimal> { ["cash"] = 50m, ["revenue"] = 50m }, accounts, 1m);

        Assert.False(entry.CanPost);
        Assert.Contains(entry.Problems, p => p.Contains("inactive"));
    }

    [Fact]
    public void An_unbalanced_document_is_refused_not_plugged()
    {
        var entry = PostingLineBuilder.Build(Sale,
            new Dictionary<string, decimal> { ["cash"] = 105m, ["revenue"] = 90m, ["tax"] = 5m },
            Accounts(Sale), 1m);

        Assert.False(entry.CanPost);
        Assert.Contains(entry.Problems, p => p.Contains("does not balance"));
        Assert.NotEqual(entry.TotalDebit, entry.TotalCredit);   // nothing was quietly adjusted
    }

    [Fact]
    public void Rounding_after_currency_conversion_is_absorbed_so_the_entry_balances()
    {
        // 100.00 on each side of the document; at 3.6725 every line rounds on its own.
        var entry = PostingLineBuilder.Build(Sale,
            new Dictionary<string, decimal> { ["cash"] = 33.33m, ["bank"] = 66.67m, ["revenue"] = 95.24m, ["tax"] = 4.76m },
            Accounts(Sale), rate: 3.6725m);

        Assert.True(entry.CanPost);
        Assert.Equal(entry.TotalDebit, entry.TotalCredit);
        Assert.All(entry.Lines, l => Assert.Equal(Math.Round(l.Debit + l.Credit, 2), l.Debit + l.Credit));
        Assert.InRange(entry.TotalDebit, 367.24m, 367.26m);
    }

    [Fact]
    public void A_negative_amount_lands_on_the_opposite_side()
    {
        var entry = PostingLineBuilder.Build(Sale,
            new Dictionary<string, decimal> { ["cash"] = -20m, ["revenue"] = -20m }, Accounts(Sale), 1m);

        Assert.True(entry.CanPost);
        Assert.Equal(20m, entry.Lines.Single(l => l.Role == "cash").Credit);
        Assert.Equal(20m, entry.Lines.Single(l => l.Role == "revenue").Debit);
    }

    [Fact]
    public void An_amount_for_a_role_the_integration_does_not_have_is_reported()
    {
        var entry = PostingLineBuilder.Build(Sale,
            new Dictionary<string, decimal> { ["cash"] = 10m, ["revenue"] = 10m, ["service_charge"] = 3m },
            Accounts(Sale), 1m);

        Assert.False(entry.CanPost);
        Assert.Contains(entry.Problems, p => p.Contains("service_charge"));
    }

    [Fact]
    public void A_document_with_no_amounts_cannot_be_posted()
    {
        var entry = PostingLineBuilder.Build(Sale, new Dictionary<string, decimal>(), Accounts(Sale), 1m);

        Assert.False(entry.CanPost);
        Assert.Empty(entry.Lines);
    }

    [Fact]
    public void No_line_ever_carries_both_a_debit_and_a_credit()
    {
        var entry = PostingLineBuilder.Build(Sale,
            new Dictionary<string, decimal> { ["cash"] = 40m, ["bank"] = 65m, ["revenue"] = 100m, ["tax"] = 5m },
            Accounts(Sale), 1m);

        Assert.All(entry.Lines, l => Assert.True(l.Debit == 0 || l.Credit == 0));
        Assert.All(entry.Lines, l => Assert.True(l.Debit > 0 || l.Credit > 0));
    }
}
