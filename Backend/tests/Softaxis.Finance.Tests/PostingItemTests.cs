using Softaxis.Finance.Domain.Entities;

namespace Softaxis.Finance.Tests;

public class PostingItemTests
{
    private static PostingItem New() =>
        new("pos.sale", "pos", Guid.NewGuid(), "TXN-1", "2026-10-01", "Sale", "AED", "{}", 105m);

    [Fact]
    public void A_new_item_is_pending_and_postable()
    {
        var item = New();
        Assert.Equal(PostingItem.Pending, item.Status);
        Assert.True(item.CanPost);
        Assert.False(item.CanReverse);
    }

    [Fact]
    public void A_failed_item_keeps_its_reason_and_can_be_retried()
    {
        var item = New();
        item.MarkFailed("No ledger account is set for 'Sales revenue'.");

        Assert.Equal(PostingItem.Failed, item.Status);
        Assert.Equal(1, item.Attempts);
        Assert.Contains("Sales revenue", item.LastError);
        Assert.True(item.CanPost);
    }

    [Fact]
    public void Posting_records_the_entry_and_clears_the_last_error()
    {
        var item = New();
        item.MarkFailed("first attempt");
        var entryId = Guid.NewGuid();
        item.MarkPosted(entryId, "JE-1", "Aisha");

        Assert.Equal(PostingItem.Posted, item.Status);
        Assert.Equal(2, item.Attempts);
        Assert.Null(item.LastError);
        Assert.Equal(entryId, item.JournalEntryId);
        Assert.Equal("JE-1", item.JournalEntryNumber);
        Assert.False(item.CanPost);      // a posted item can never be posted again
        Assert.False(item.CanSkip);
        Assert.True(item.CanReverse);
    }

    [Fact]
    public void A_posted_item_cannot_be_skipped_or_requeued()
    {
        var item = New();
        item.MarkPosted(Guid.NewGuid(), "JE-1", null);

        Assert.Throws<InvalidOperationException>(() => item.Skip("no"));
        Assert.Throws<InvalidOperationException>(() => item.Requeue());
    }

    [Fact]
    public void Skip_then_requeue_returns_to_pending()
    {
        var item = New();
        item.Skip("Test sale");
        Assert.Equal(PostingItem.Skipped, item.Status);
        Assert.False(item.CanPost);

        item.Requeue();
        Assert.Equal(PostingItem.Pending, item.Status);
        Assert.Null(item.LastError);
    }

    [Fact]
    public void A_reversed_item_cannot_be_reversed_again_or_posted_directly()
    {
        var item = New();
        item.MarkPosted(Guid.NewGuid(), "JE-1", null);
        item.MarkReversed("Wrong account");

        Assert.Equal(PostingItem.Reversed, item.Status);
        Assert.Equal("Wrong account", item.LastError);
        Assert.False(item.CanPost);
        Assert.Throws<InvalidOperationException>(() => item.MarkReversed());
    }

    [Fact]
    public void A_reversed_item_can_be_put_back_to_be_posted_again()
    {
        var item = New();
        item.Submit(Guid.NewGuid(), "Maker");
        item.MarkPosted(Guid.NewGuid(), "JE-1", null);
        item.MarkReversed("Wrong account");

        Assert.True(item.CanRequeue);
        item.Requeue();

        Assert.Equal(PostingItem.Pending, item.Status);
        Assert.Null(item.LastError);
        Assert.Null(item.SubmittedAt);
        Assert.True(item.CanPost);
    }

    [Fact]
    public void Only_a_posted_item_can_be_reversed()
    {
        Assert.Throws<InvalidOperationException>(() => New().MarkReversed());
    }

    [Fact]
    public void A_long_error_is_cut_to_fit_its_column()
    {
        var item = New();
        item.MarkFailed(new string('x', 5000));
        Assert.Equal(1000, item.LastError!.Length);
    }
}
