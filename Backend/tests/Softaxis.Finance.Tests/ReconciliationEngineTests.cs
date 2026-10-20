using Softaxis.Finance.Application.Banking.Reconciliation;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Handlers.Banking;
using Xunit;

namespace Softaxis.Finance.Tests;

public class ReconciliationEngineTests
{
    private static BankTransaction Txn(string date, decimal amount, string type) =>
        new(Guid.NewGuid(), date, "t", "r", amount, type, "x");

    private static ReconBookItemDto Line(string date, decimal amount, bool isIn) =>
        new(Guid.NewGuid(), Guid.NewGuid(), "JE", date, "d", amount, isIn);

    [Fact]
    public void Money_in_pairs_with_a_debit_and_money_out_with_a_credit()
    {
        var inTxn = Txn("2026-10-11", 100, "credit");
        var outTxn = Txn("2026-10-11", 100, "debit");
        var debit = Line("2026-10-11", 100, true);
        var credit = Line("2026-10-11", 100, false);

        var s = ReconciliationEngine.Suggest([inTxn, outTxn], [debit, credit], 5);

        Assert.Equal([debit.JournalLineId], s[inTxn.Id]);
        Assert.Equal([credit.JournalLineId], s[outTxn.Id]);
    }

    [Fact]
    public void Amount_must_agree_exactly_and_direction_must_agree()
    {
        var t = Txn("2026-10-11", 100, "credit");
        Assert.Empty(ReconciliationEngine.Suggest([t], [Line("2026-10-11", 100.01m, true)], 5));
        Assert.Empty(ReconciliationEngine.Suggest([t], [Line("2026-10-11", 100, false)], 5));
    }

    [Fact]
    public void Date_window_is_inclusive_and_closest_date_is_listed_first()
    {
        var t = Txn("2026-10-10", 50, "credit");
        var far = Line("2026-10-15", 50, true);    // 5 days
        var near = Line("2026-10-11", 50, true);   // 1 day
        var outside = Line("2026-10-16", 50, true); // 6 days

        var s = ReconciliationEngine.Suggest([t], [far, outside, near], 5);

        Assert.Equal([near.JournalLineId, far.JournalLineId], s[t.Id]);
    }

    [Fact]
    public void A_zero_day_window_requires_the_same_day()
    {
        var t = Txn("2026-10-10", 50, "credit");
        Assert.Empty(ReconciliationEngine.Suggest([t], [Line("2026-10-11", 50, true)], 0));
        Assert.Single(ReconciliationEngine.Suggest([t], [Line("2026-10-10", 50, true)], 0));
    }

    [Fact]
    public void An_unreadable_date_never_produces_a_suggestion()
    {
        var t = Txn("not a date", 50, "credit");
        Assert.Empty(ReconciliationEngine.Suggest([t], [Line("2026-10-10", 50, true)], 60));
    }

    [Theory]
    [InlineData(-5, 0)]
    [InlineData(5, 5)]
    [InlineData(500, 60)]
    public void Window_is_clamped(int asked, int expected) =>
        Assert.Equal(expected, ReconciliationEngine.ClampWindow(asked));

    [Fact]
    public void Matching_a_statement_line_records_the_entry_and_unmatching_clears_it()
    {
        var t = Txn("2026-10-10", 50, "credit");
        var line = Guid.NewGuid();
        var entry = Guid.NewGuid();

        t.Match(line, entry, "JE-1", "Asha");
        Assert.True(t.Reconciled);
        Assert.Equal(line, t.MatchedJournalLineId);
        Assert.Equal("JE-1", t.MatchedEntryNumber);

        t.Unmatch();
        Assert.False(t.Reconciled);
        Assert.Null(t.MatchedJournalLineId);
        Assert.Null(t.MatchedEntryNumber);
    }
}
