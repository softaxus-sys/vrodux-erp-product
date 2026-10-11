using Softaxis.Finance.Infrastructure.Integrations;
using Softaxis.Finance.Infrastructure.Persistence.Seed;

namespace Softaxis.Finance.Tests;

public class IntegrationCatalogueTests
{
    private static readonly HashSet<string> ChartNumbers =
        ChartOfAccountsCatalogue.Accounts.Select(a => a.Number).ToHashSet();

    [Fact]
    public void Keys_are_unique()
    {
        var keys = IntegrationCatalogue.All.Select(d => d.Key).ToList();
        Assert.Equal(keys.Count, keys.Distinct(StringComparer.OrdinalIgnoreCase).Count());
    }

    [Fact]
    public void Every_default_account_exists_in_the_standard_chart()
    {
        // A default that is not in the chart every workspace starts with would fail the first
        // posting of every workspace that had not mapped the role by hand.
        var missing = IntegrationCatalogue.All
            .SelectMany(d => d.Roles.Select(r => (d.Key, r.Role, r.DefaultAccountNumber)))
            .Where(x => !ChartNumbers.Contains(x.DefaultAccountNumber))
            .ToList();

        Assert.True(missing.Count == 0, "Not in the chart: " + string.Join(", ", missing));
    }

    [Fact]
    public void Every_queue_integration_has_a_source_and_both_sides()
    {
        foreach (var def in IntegrationCatalogue.All.Where(d => d.Kind == IntegrationKind.Queue))
        {
            Assert.NotNull(PostingSources.Find(def.Key));
            Assert.Contains(def.Roles, r => r.IsDebit);
            Assert.Contains(def.Roles, r => !r.IsDebit);
            Assert.Equal(def.Roles.Count, def.Roles.Select(r => r.Role).Distinct().Count());
        }
    }

    [Fact]
    public void Every_source_belongs_to_a_queue_integration()
    {
        foreach (var source in PostingSources.All)
            Assert.Equal(IntegrationKind.Queue, IntegrationCatalogue.Find(source.Key)?.Kind);
    }

    [Fact]
    public void Integrations_that_do_not_post_declare_no_posting_rules()
    {
        // Showing accounts for something that posts nothing would read as "this is wired up".
        foreach (var def in IntegrationCatalogue.All.Where(d => d.Kind is IntegrationKind.Client or IntegrationKind.None))
            Assert.Empty(def.Roles);
    }

    [Fact]
    public void Every_source_query_is_scoped_to_the_workspace_and_bounded_by_date()
    {
        // Raw SQL is outside EF's tenant filter. A source that forgot its tenant comparison would
        // read every workspace's documents into one workspace's ledger.
        foreach (var source in PostingSources.All)
        {
            Assert.Matches(@"TenantId\]\s*=\s*\{0\}", source.FromWhere);
            Assert.Contains("{1}", source.FromWhere);
            Assert.DoesNotContain("{2}", source.FromWhere);
        }
    }
}

public class PostingSourceAmountTests
{
    // A1..A7 per source — see PostingSources. Every sample here is a document that may be posted.
    public static IEnumerable<object[]> Samples() =>
    [
        ["pos.sale",          new SourceRow { A1 = 105m, A2 = 5m, A6 = 105m }],                       // all cash
        ["pos.sale",          new SourceRow { A1 = 105m, A2 = 5m, A6 = 200m }],                       // cash over-tendered, change given
        ["pos.sale",          new SourceRow { A1 = 105m, A2 = 5m, A3 = 60m, A6 = 105m }],             // cash + card
        ["pos.sale",          new SourceRow { A1 = 80m,  A2 = 0m, A3 = 80m, A6 = 80m }],              // no tax, all card
        ["pos.sale",          new SourceRow { A1 = 80m,  A2 = 4m, A4 = 80m, A6 = 80m }],              // all store credit
        ["pos.sale",          new SourceRow { A1 = 90m,  A2 = 0m, A3 = 30m, A4 = 30m, A6 = 90m }],    // three ways
        ["pos.refund",        new SourceRow { A1 = 52.5m, A2 = 2.5m, A6 = 52.5m }],                   // cash
        ["pos.refund",        new SourceRow { A1 = 52.5m, A2 = 2.5m, A3 = 52.5m, A6 = 52.5m }],       // back to card
        ["pos.refund",        new SourceRow { A1 = 52.5m, A2 = 0m,   A4 = 52.5m, A6 = 52.5m }],       // back to store credit
        ["restaurant.order",  new SourceRow { A1 = 230m, A2 = 30m, A3 = 20m, A7 = 250m }],
        ["restaurant.order",  new SourceRow { A1 = 230m, A2 = 30m, A3 = 20m, A4 = 100m, A7 = 250m }],
        ["restaurant.order",  new SourceRow { A1 = 230m, A2 = 0m,  A3 = 0m,  A5 = 230m, A7 = 230m }], // house account
        ["restaurant.order",  new SourceRow { A1 = 230m, A2 = 0m,  A3 = 0m,  A4 = 100m, A5 = 50m, A7 = 300m }],
        ["restaurant.refund", new SourceRow { A1 = 40m, A2 = 1m }],
        ["restaurant.refund", new SourceRow { A1 = 40m, A2 = 2m }],
        ["restaurant.refund", new SourceRow { A1 = 40m, A2 = 3m }],
        ["realestate.rent",   new SourceRow { A1 = 8333.37m, A2 = 2m }],
        ["realestate.rent",   new SourceRow { A1 = 8333.33m, A2 = 1m }],
        ["library.fine",      new SourceRow { A1 = 15m, A2 = 1m }],
        ["library.fine",      new SourceRow { A1 = 15m, A2 = 2m }],
        ["hr.payroll",        new SourceRow { A1 = 9000m, A2 = 1500m, A3 = 500m, A4 = 10000m }],
        ["hr.payroll",        new SourceRow { A1 = 9000m, A2 = 0m,    A3 = 0m,   A4 = 9000m }],
        ["hr.payroll",        new SourceRow { A1 = 9000m, A2 = 0m,    A3 = 0.4m, A4 = 8999.5m }],    // slip rounding
        ["sales.return",      new SourceRow { A1 = 250m }],
        ["pos.wallet",        new SourceRow { A1 = 500m, A2 = 1m }],
        ["pos.wallet",        new SourceRow { A1 = 500m, A2 = 2m }],
        ["pos.cash",          new SourceRow { A1 = 300m, A2 = 1m }],
        ["pos.cash",          new SourceRow { A1 = 300m, A2 = 2m }],
        ["pos.cash",          new SourceRow { A1 = 300m, A2 = 3m }],
        ["pos.cash",          new SourceRow { A1 = 300m, A2 = 4m }],
        ["pos.cash",          new SourceRow { A1 = 300m, A2 = 5m }],
    ];

    // Documents that must never reach the ledger from the queue, and a word of the reason given.
    public static IEnumerable<object[]> Held() =>
    [
        ["pos.sale",          new SourceRow { A1 = 0m,   A6 = 0m },                              "total"],
        ["pos.sale",          new SourceRow { A1 = -50m, A6 = 0m },                              "total"],
        ["pos.sale",          new SourceRow { A1 = 100m, A2 = 120m, A6 = 100m },                 "Tax"],
        ["pos.sale",          new SourceRow { A1 = 100m, A2 = -1m,  A6 = 100m },                 "Tax"],
        ["pos.sale",          new SourceRow { A1 = 100m, A5 = 100m, A6 = 100m },                 "no posting rule"],
        ["pos.sale",          new SourceRow { A1 = 105m, A3 = 500m, A6 = 500m },                 "more than the sale"],
        ["pos.sale",          new SourceRow { A1 = 105m, A6 = 60m },                             "do not cover"],
        ["pos.sale",          new SourceRow { A1 = 105m },                                       "do not cover"],
        ["pos.refund",        new SourceRow { A1 = 0m },                                         "no amount"],
        ["pos.refund",        new SourceRow { A1 = 50m, A2 = 60m, A6 = 50m },                    "Tax"],
        ["pos.refund",        new SourceRow { A1 = 50m, A5 = 50m, A6 = 50m },                    "no posting rule"],
        ["pos.refund",        new SourceRow { A1 = 50m, A3 = 80m, A6 = 80m },                    "more than the refund"],
        ["pos.refund",        new SourceRow { A1 = 50m },                                        "does not say how"],
        ["restaurant.order",  new SourceRow { A1 = 230m, A2 = 300m, A7 = 230m },                 "Tax"],
        ["restaurant.order",  new SourceRow { A1 = 230m, A3 = -5m,  A7 = 230m },                 "tip"],
        ["restaurant.order",  new SourceRow { A1 = 230m, A6 = 30m,  A7 = 230m },                 "no posting rule"],
        ["restaurant.order",  new SourceRow { A1 = 230m, A4 = 999m, A7 = 999m },                 "more than the bill"],
        ["restaurant.order",  new SourceRow { A1 = 230m, A3 = 20m, A7 = 230m },                  "do not cover"],
        ["restaurant.order",  new SourceRow { A1 = 230m },                                       "do not cover"],
        ["restaurant.refund", new SourceRow { A1 = 40m, A2 = 0m },                               "no posting rule"],
        ["realestate.rent",   new SourceRow { A1 = 8000m, A2 = 0m },                             "not known"],
        ["library.fine",      new SourceRow { A1 = 15m,   A2 = 0m },                             "not known"],
        ["hr.payroll",        new SourceRow { A1 = 9000m, A2 = 0m, A3 = 0m, A4 = 9000.01m },     "more than gross"],
        ["hr.payroll",        new SourceRow { A1 = 9000m, A2 = 1500m, A3 = 500m, A4 = 9000m },   "do not agree"],
        ["hr.payroll",        new SourceRow { A1 = 9000m, A2 = -100m, A3 = 0m, A4 = 8900m },     "negative"],
        ["sales.return",      new SourceRow { A1 = 0m },                                         "no items"],
        ["pos.wallet",        new SourceRow { A1 = 500m, A2 = 0m },                              "not recorded"],
        ["pos.cash",          new SourceRow { A1 = 300m, A2 = 0m },                              "was for"],
    ];

    [Fact]
    public void Sales_returns_are_never_posted_automatically()
    {
        Assert.False(IntegrationCatalogue.Find("sales.return")!.AutoAllowed);
        Assert.All(IntegrationCatalogue.All.Where(d => d.Key != "sales.return"), d => Assert.True(d.AutoAllowed));
    }

    [Theory]
    [MemberData(nameof(Held))]
    internal void A_document_whose_figures_do_not_stand_up_is_held(string key, SourceRow row, string reasonContains)
    {
        var problem = PostingSources.Find(key)!.Check?.Invoke(row);

        Assert.NotNull(problem);
        Assert.Contains(reasonContains, problem);
    }

    [Fact]
    public void Every_source_has_a_check()
    {
        // A source with no check posts whatever it reads.
        Assert.All(PostingSources.All, s => Assert.NotNull(s.Check));
    }

    [Fact]
    public void Money_that_is_neither_cash_nor_bank_is_not_posted_as_either()
    {
        var sale = PostingSources.Find("pos.sale")!.Amounts(new SourceRow { A1 = 100m, A2 = 0m, A4 = 100m, A6 = 100m });
        Assert.Equal(0m, sale["cash"]);
        Assert.Equal(0m, sale["bank"]);
        Assert.Equal(100m, sale["customer"]);

        var order = PostingSources.Find("restaurant.order")!.Amounts(new SourceRow { A1 = 100m, A5 = 40m, A4 = 10m, A7 = 100m });
        Assert.Equal(50m, order["cash"]);
        Assert.Equal(10m, order["bank"]);
        Assert.Equal(40m, order["customer"]);
    }

    [Fact]
    public void Collected_figures_are_never_repaired()
    {
        // The old rules capped an over-keyed card payment at the sale total and posted it. The
        // amounts now say what the document says, and the check is what stops it.
        var source  = PostingSources.Find("pos.sale")!;
        var row     = new SourceRow { A1 = 105m, A2 = 5m, A3 = 500m, A6 = 500m };

        Assert.Equal(500m, source.Amounts(row)["bank"]);
        Assert.NotNull(source.Check!(row));
    }

    [Fact]
    public void Documents_with_their_own_posting_screen_are_read_only_while_unposted()
    {
        // The library and payroll each have a posting screen over the same rows; this condition
        // is what keeps one document out of two journal entries.
        var fines = PostingSources.Find("library.fine")!;
        Assert.Contains("[library].[fine_payments]", fines.FromWhere);
        Assert.Contains("[JournalEntryId] IS NULL", fines.FromWhere);
        Assert.Contains("[JournalEntryId] IS NULL", PostingSources.Find("hr.payroll")!.FromWhere);
    }

    [Theory]
    [MemberData(nameof(Samples))]
    internal void Collected_amounts_use_only_known_roles_and_balance(string key, SourceRow row)
    {
        var def     = IntegrationCatalogue.Find(key)!;
        var source  = PostingSources.Find(key)!;
        var amounts = source.Amounts(row);

        Assert.Null(source.Check?.Invoke(row));

        Assert.All(amounts.Keys, role => Assert.Contains(def.Roles, r => r.Role == role));
        Assert.All(amounts.Values, v => Assert.True(v >= 0, "amounts are collected unsigned"));

        var debit  = amounts.Where(a => def.Roles.Single(r => r.Role == a.Key).IsDebit).Sum(a => a.Value);
        var credit = amounts.Where(a => !def.Roles.Single(r => r.Role == a.Key).IsDebit).Sum(a => a.Value);
        Assert.Equal(debit, credit);
        Assert.True(debit > 0);

        var accounts = def.Roles.ToDictionary(r => r.Role, r => new ResolvedAccount(Guid.NewGuid(), r.DefaultAccountNumber, r.Label, true));
        Assert.True(PostingLineBuilder.Build(def, amounts, accounts, 1m).CanPost);
    }

    [Fact]
    public void Tips_are_kept_out_of_restaurant_revenue()
    {
        var amounts = PostingSources.Find("restaurant.order")!.Amounts(new SourceRow { A1 = 230m, A2 = 30m, A3 = 20m, A7 = 250m });

        Assert.Equal(200m, amounts["revenue"]);
        Assert.Equal(20m,  amounts["tips"]);
        Assert.Equal(250m, amounts["cash"]);
    }

    [Fact]
    public void Payroll_expense_is_gross_and_the_difference_from_net_is_withheld()
    {
        var amounts = PostingSources.Find("hr.payroll")!.Amounts(new SourceRow { A1 = 9000m, A2 = 1500m, A3 = 500m, A4 = 10000m });

        Assert.Equal(10500m, amounts["expense"]);
        Assert.Equal(10000m, amounts["payable"]);
        Assert.Equal(500m,   amounts["deductions"]);
    }
}
