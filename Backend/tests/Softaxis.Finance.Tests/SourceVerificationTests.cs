using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Integrations;

namespace Softaxis.Finance.Tests;

public class SourceVerificationTests
{
    private static PostingItem Item() =>
        new("pos.sale", "pos", Guid.NewGuid(), "TXN-1", "2026-10-01", "Sale", "PKR", """{"cash":100,"revenue":100}""", 100m);

    [Fact]
    public void Amounts_are_the_same_when_only_zero_roles_differ()
    {
        var a = new Dictionary<string, decimal> { ["cash"] = 100m, ["revenue"] = 100m };
        var b = new Dictionary<string, decimal> { ["cash"] = 100m, ["bank"] = 0m, ["revenue"] = 100m, ["tax"] = 0m };
        Assert.True(PostingEngine.SameAmounts(a, b));
    }

    [Theory]
    [InlineData(100.01)]
    [InlineData(99)]
    public void A_changed_amount_is_noticed(decimal cash)
    {
        var a = new Dictionary<string, decimal> { ["cash"] = 100m, ["revenue"] = 100m };
        var b = new Dictionary<string, decimal> { ["cash"] = cash, ["revenue"] = 100m };
        Assert.False(PostingEngine.SameAmounts(a, b));
    }

    [Fact]
    public void Money_moving_between_cash_and_bank_is_a_change()
    {
        var a = new Dictionary<string, decimal> { ["cash"] = 100m, ["revenue"] = 100m };
        var b = new Dictionary<string, decimal> { ["bank"] = 100m, ["revenue"] = 100m };
        Assert.False(PostingEngine.SameAmounts(a, b));
    }

    [Fact]
    public void A_held_item_is_not_pending_so_automatic_posting_never_picks_it_up()
    {
        var item = Item();
        item.Hold(PostingEngine.HeldPrefix + "Tax does not fit.");

        Assert.Equal(PostingItem.Failed, item.Status);
        Assert.Equal(0, item.Attempts);
        Assert.StartsWith(PostingEngine.HeldPrefix, item.LastError);
    }

    [Fact]
    public void A_hold_is_released_only_for_a_held_item()
    {
        var held = Item();
        held.Hold(PostingEngine.HeldPrefix + "x");
        held.ReleaseHold(PostingEngine.HeldPrefix);
        Assert.Equal(PostingItem.Pending, held.Status);
        Assert.Null(held.LastError);

        // Failed for another reason (closed period, missing account): stays failed.
        var failed = Item();
        failed.MarkFailed("The fiscal period is closed.");
        failed.ReleaseHold(PostingEngine.HeldPrefix);
        Assert.Equal(PostingItem.Failed, failed.Status);
    }

    [Fact]
    public void Figures_of_a_posted_item_cannot_be_changed()
    {
        var item = Item();
        item.MarkPosted(Guid.NewGuid(), "JE-1", "tester");

        Assert.Throws<InvalidOperationException>(() => item.Refresh("2026-10-02", "{}", 0m));
        item.Hold("x");
        Assert.Equal(PostingItem.Posted, item.Status);
    }

    [Fact]
    public void Figures_of_an_open_item_can_be_refreshed()
    {
        var item = Item();
        item.Refresh("2026-10-02", """{"bank":80,"revenue":80}""", 80m);

        Assert.Equal("2026-10-02", item.SourceDate);
        Assert.Equal(80m, item.TotalAmount);
        Assert.Equal(80m, PostingEngine.ReadAmounts(item)["bank"]);
        Assert.Equal(PostingItem.Pending, item.Status);
    }

    [Fact]
    public void Only_a_posted_item_is_flagged_as_cancelled_and_only_once()
    {
        var open = Item();
        open.FlagCancelled("cancelled");
        Assert.Null(open.LastError);

        var posted = Item();
        posted.MarkPosted(Guid.NewGuid(), "JE-1", "tester");
        posted.FlagCancelled("first");
        posted.FlagCancelled("second");
        Assert.Equal("first", posted.LastError);
        Assert.Equal(PostingItem.Posted, posted.Status);
    }
}
