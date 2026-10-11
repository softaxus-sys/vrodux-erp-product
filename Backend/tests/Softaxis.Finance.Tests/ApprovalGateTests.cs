using Softaxis.Finance.Application.Integrations.Dtos;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Integrations;

namespace Softaxis.Finance.Tests;

public class ApprovalGateTests
{
    private static readonly Guid Maker = Guid.NewGuid();
    private static readonly Guid Checker = Guid.NewGuid();

    private static PostingItem Item(decimal total = 500m, string module = "pos") =>
        new("pos.sale", module, Guid.NewGuid(), "TXN-1", "2026-10-01", "Sale", "PKR", "{}", total);

    private static IntegrationSetting Setting(decimal? limit = null, bool separate = false)
    {
        var s = new IntegrationSetting("pos.sale");
        s.SetApprovalRules(limit, separate, "tester");
        return s;
    }

    private static PostingCaller Caller(Guid? id = null, bool high = false, params string[] modules) =>
        new(id ?? Checker, high, modules.Length == 0 ? null : modules);

    [Fact]
    public void No_rules_means_no_extra_checks()
        => Assert.Null(ApprovalGate.Evaluate(Item(), null, Caller(), "PKR"));

    [Fact]
    public void A_document_above_the_limit_needs_high_value_approval()
    {
        var item = Item(1000m);
        var why = ApprovalGate.Evaluate(item, Setting(limit: 999m), Caller(), "PKR");
        Assert.Contains("approval limit", why);
        Assert.Null(ApprovalGate.Evaluate(item, Setting(limit: 999m), Caller(high: true), "PKR"));
    }

    [Fact]
    public void A_document_at_the_limit_is_not_above_it()
        => Assert.Null(ApprovalGate.Evaluate(Item(1000m), Setting(limit: 1000m), Caller(), "PKR"));

    [Fact]
    public void A_second_person_rule_needs_a_submission()
        => Assert.Contains("not been submitted", ApprovalGate.Evaluate(Item(), Setting(separate: true), Caller(), "PKR"));

    [Fact]
    public void The_submitter_cannot_approve_their_own_document()
    {
        var item = Item();
        item.Submit(Maker, "Maker");
        Assert.Contains("Someone else", ApprovalGate.Evaluate(item, Setting(separate: true), Caller(Maker), "PKR"));
        Assert.Null(ApprovalGate.Evaluate(item, Setting(separate: true), Caller(Checker), "PKR"));
    }

    [Fact]
    public void An_unknown_approver_is_refused_when_a_second_person_is_required()
    {
        var item = Item();
        item.Submit(Maker, "Maker");
        var unknown = new PostingCaller(null, false, null);
        Assert.NotNull(ApprovalGate.Evaluate(item, Setting(separate: true), unknown, "PKR"));
    }

    [Fact]
    public void A_submission_with_no_recorded_submitter_is_refused()
    {
        var item = Item();
        item.Submit(null, "Someone");
        Assert.NotNull(ApprovalGate.Evaluate(item, Setting(separate: true), Caller(), "PKR"));
    }

    [Fact]
    public void Changed_figures_void_the_submission()
    {
        var item = Item();
        item.Submit(Maker, "Maker");
        item.Refresh("2026-10-02", "{}", 10m);
        Assert.Null(item.SubmittedAt);
        Assert.Contains("not been submitted", ApprovalGate.Evaluate(item, Setting(separate: true), Caller(), "PKR"));
    }

    [Fact]
    public void A_held_document_loses_its_submission()
    {
        var item = Item();
        item.Submit(Maker, "Maker");
        item.Hold("x");
        Assert.Null(item.SubmittedByUserId);
    }

    [Fact]
    public void Only_a_waiting_document_can_be_submitted()
    {
        var item = Item();
        item.MarkFailed("x");
        Assert.Throws<InvalidOperationException>(() => item.Submit(Maker, "Maker"));
    }

    [Fact]
    public void A_module_the_workspace_does_not_have_is_never_postable()
    {
        var why = ApprovalGate.Evaluate(Item(module: "hospitality"), null, Caller(null, true, "pos", "inventory"), "PKR");
        Assert.Contains("does not have", why);
    }

    [Theory]
    [InlineData("purchase", "purchasing", true)]
    [InlineData("purchasing", "purchase", true)]
    [InlineData("POS", "pos", true)]
    [InlineData("finance", "pos", true)]
    [InlineData("library", "pos", false)]
    public void Module_licence_codes_are_matched_by_meaning(string document, string licensed, bool allowed)
        => Assert.Equal(allowed, ModuleAccess.Allows([licensed], document));

    [Fact]
    public void No_licence_list_means_unrestricted()
        => Assert.True(ModuleAccess.Allows(null, "anything"));

    [Fact]
    public void An_approval_limit_of_zero_or_less_is_no_limit()
    {
        Assert.Null(Setting(limit: 0m).ApprovalLimit);
        Assert.Null(Setting(limit: -5m).ApprovalLimit);
        Assert.Equal(100.12m, Setting(limit: 100.123m).ApprovalLimit);
    }
}
