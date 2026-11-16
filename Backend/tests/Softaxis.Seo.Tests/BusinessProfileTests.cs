using Softaxis.Seo.Application.Profile;
using Softaxis.Seo.Domain.Entities;
using Softaxis.Seo.Infrastructure.Competitors;
using Softaxis.Seo.Infrastructure.Profile;

namespace Softaxis.Seo.Tests;

public class BusinessProfileTests
{
    private static BusinessContext Dental(IReadOnlyList<string>? avoid = null) => new(
        "Smile Dental", "Dental clinic",
        "Smile Dental is a family dental clinic offering teeth whitening, braces, implants and check-ups.",
        ["teeth whitening", "dental implants", "braces"], "Families and professionals in Islamabad", "Islamabad", avoid ?? []);

    private static PlanSlot Slot(string keyword, string source = "keyword") =>
        new("2026-12-01", keyword, keyword, "reason", 500, 30, source);

    // ── Readiness ────────────────────────────────────────────────────────────

    [Fact]
    public void Profile_needs_a_real_description_and_either_offers_or_industry()
    {
        Assert.False(SeoBusinessProfile.IsReadyFor("short", ["x"], "Retail"));
        Assert.False(SeoBusinessProfile.IsReadyFor("A long enough description of the business here.", [], ""));
        Assert.True(SeoBusinessProfile.IsReadyFor("A long enough description of the business here.", [], "Retail"));
        Assert.True(SeoBusinessProfile.IsReadyFor("A long enough description of the business here.", ["shoes"], ""));
    }

    [Fact]
    public void Profile_cleans_lists_and_limits_them()
    {
        var p = new SeoBusinessProfile(Guid.NewGuid());
        p.Update("Acme", "Retail", "Acme sells running shoes online to athletes.", ["Shoes", " shoes ", "", "Socks"], null, null, ["Politics", "politics"], ProfileSources.Manual);
        Assert.Equal(["Shoes", "Socks"], p.Offers);
        Assert.Equal(["Politics"], p.AvoidTopics);
        Assert.True(p.IsReady);
    }

    [Fact]
    public void Older_niche_hint_is_accepted_only_when_it_is_a_real_sentence()
    {
        Assert.NotNull(BusinessContext.From(null, "a boutique real-estate agency in Dubai focused on off-plan apartments", "site"));
        Assert.Null(BusinessContext.From(null, "real estate", "site"));
        Assert.Null(BusinessContext.From(null, null, "site"));
        Assert.Null(BusinessContext.From(new SeoBusinessProfile(Guid.NewGuid()), null, "site"));   // empty profile is not usable
    }

    // ── Relevance filter ─────────────────────────────────────────────────────

    [Theory]
    [InlineData("teeth whitening cost", Fit.Fits)]
    [InlineData("dental implant aftercare", Fit.Fits)]          // plural/singular handled
    [InlineData("best crm software", Fit.Unclear)]
    [InlineData("islamabad weather", Fit.Unclear)]              // a city is context, not a topic
    public void Classifies_by_what_the_business_says_it_does(string phrase, Fit expected) =>
        Assert.Equal(expected, RelevanceFilter.Classify(phrase, Dental()));

    [Fact]
    public void Avoid_list_beats_a_match()
    {
        var ctx = Dental(["teeth whitening"]);
        Assert.Equal(Fit.Avoid, RelevanceFilter.Classify("teeth whitening kits", ctx));
        Assert.Equal(Fit.Fits, RelevanceFilter.Classify("dental implants", ctx));
    }

    [Fact]
    public void Generic_business_words_do_not_make_something_fit()
    {
        var ctx = new BusinessContext("Acme", null, "Acme is a leading company providing quality solutions to customers.", [], null, null, []);
        Assert.Equal(Fit.Unclear, RelevanceFilter.Classify("quality solutions", ctx));
    }

    // ── Plan curation ────────────────────────────────────────────────────────

    [Fact]
    public void Without_ai_only_clear_matches_are_kept_and_the_rest_counted_as_left_out()
    {
        var plan = PlanCurator.Curate(Dental(), [Slot("teeth whitening cost"), Slot("crm software pricing"), Slot("braces for adults")], null, new DateOnly(2026, 12, 1));
        Assert.Equal(2, plan.Kept.Count);
        Assert.Equal(1, plan.Dropped);
        Assert.False(plan.UsedAi);
        Assert.All(plan.Kept, k => Assert.False(string.IsNullOrWhiteSpace(k.Summary)));
        Assert.All(plan.Kept, k => Assert.Contains("Matches what your profile says", k.FitReason));
    }

    [Fact]
    public void Ai_verdict_decides_unclear_ideas_and_supplies_the_headline_and_description()
    {
        var cands = new[] { Slot("clear aligners"), Slot("crm software pricing") };
        var verdicts = new Dictionary<int, JudgedSlot>
        {
            [0] = new(true, "Clear Aligners vs Braces: Which Is Right for You?", "Explains how each works, cost and who suits which.", "Aligners are a service Smile Dental offers."),
            [1] = new(false, null, null, null),
        };
        var plan = PlanCurator.Curate(Dental(), cands, verdicts, new DateOnly(2026, 12, 1));
        Assert.Single(plan.Kept);
        Assert.Equal(1, plan.Dropped);
        Assert.True(plan.UsedAi);
        Assert.Equal("Clear Aligners vs Braces: Which Is Right for You?", plan.Kept[0].Slot.Title);
        Assert.Equal("Explains how each works, cost and who suits which.", plan.Kept[0].Summary);
    }

    [Fact]
    public void The_avoid_list_still_wins_over_an_ai_yes()
    {
        var plan = PlanCurator.Curate(Dental(["braces"]), [Slot("braces for adults")], new Dictionary<int, JudgedSlot> { [0] = new(true, "t", "s", "r") }, new DateOnly(2026, 12, 1));
        Assert.Empty(plan.Kept);
        Assert.Equal(1, plan.Dropped);
    }

    [Fact]
    public void An_idea_the_ai_did_not_mention_falls_back_to_the_word_match()
    {
        var plan = PlanCurator.Curate(Dental(), [Slot("teeth whitening"), Slot("random thing")], new Dictionary<int, JudgedSlot>(), new DateOnly(2026, 12, 1));
        Assert.Single(plan.Kept);
    }

    [Fact]
    public void Dates_are_reassigned_every_two_days_with_no_gaps_after_dropping_and_capped()
    {
        var cands = Enumerable.Range(0, 20).Select(i => Slot(i % 2 == 0 ? $"teeth whitening {i}" : $"crm thing {i}")).ToList();
        var plan = PlanCurator.Curate(Dental(), cands, null, new DateOnly(2026, 12, 1), max: 4);
        Assert.Equal(["2026-12-02", "2026-12-04", "2026-12-06", "2026-12-08"], plan.Kept.Select(k => k.Slot.PlannedDate));
    }

    [Fact]
    public void Headline_is_trimmed_to_a_readable_length()
    {
        var plan = PlanCurator.Curate(Dental(), [Slot("braces")],
            new Dictionary<int, JudgedSlot> { [0] = new(true, "\"" + new string('x', 200) + "\"", "s", "r") }, new DateOnly(2026, 12, 1));
        Assert.True(plan.Kept[0].Slot.Title.Length <= PlanCurator.MaxTitle);
        Assert.DoesNotContain('"', plan.Kept[0].Slot.Title);
    }

    // ── AI reply parsing ─────────────────────────────────────────────────────

    [Fact]
    public void Parses_the_ai_reply_even_with_fences_and_ignores_bad_ids()
    {
        var raw = "```json\n[{\"id\":0,\"verdict\":\"fit\",\"title\":\"T\",\"summary\":\"S\",\"fitReason\":\"R\"},{\"id\":9,\"verdict\":\"fit\"},{\"id\":1,\"verdict\":\"off\"}]\n```";
        var parsed = PlanEditor.Parse(raw, 3)!;
        Assert.True(parsed[0].Fits);
        Assert.Equal("T", parsed[0].Title);
        Assert.False(parsed[1].Fits);
        Assert.False(parsed.ContainsKey(9));
    }

    [Fact]
    public void Unreadable_ai_reply_returns_null_so_the_fallback_is_used()
    {
        Assert.Null(PlanEditor.Parse("sorry, I cannot do that", 3));
        Assert.Null(PlanEditor.Parse("[]", 3));
    }

    // ── Importing from the workspace ─────────────────────────────────────────

    [Fact]
    public void Workspace_import_needs_a_name_and_an_industry()
    {
        var none = TenantProfileMapper.Propose(new TenantBusinessDetails("Acme", null, "PK", null, null, null));
        Assert.False(none.Enough);
        Assert.Equal(["industry"], none.Missing);

        var nothing = TenantProfileMapper.Propose(null);
        Assert.False(nothing.Enough);
        Assert.Equal(["business name", "industry"], nothing.Missing);
    }

    [Fact]
    public void Workspace_import_builds_only_what_the_workspace_actually_knows()
    {
        var p = TenantProfileMapper.Propose(new TenantBusinessDetails("Acme Traders", "import_export", "PK", "https://acme.pk", null, null));
        Assert.True(p.Enough);
        Assert.Equal("Import export", p.Industry);
        Assert.Equal("Pakistan", p.ServiceAreas);
        Assert.Equal("Acme Traders operates in the import export industry, based in Pakistan.", p.Summary);
        Assert.Contains("what you sell", p.NotInWorkspace);   // not invented
        Assert.True(SeoBusinessProfile.IsReadyFor(p.Summary, [], p.Industry));
    }

    [Theory]
    [InlineData("https://www.acme.pk/", "acme.pk", true)]
    [InlineData("acme.pk", "shop.acme.pk", true)]
    [InlineData("https://other.com", "acme.pk", false)]
    [InlineData(null, "acme.pk", null)]
    public void Website_match_ignores_scheme_www_and_subdomains(string? tenant, string site, bool? expected) =>
        Assert.Equal(expected, TenantProfileMapper.WebsiteMatches(tenant, site));

    // ── Competitor suggestions ───────────────────────────────────────────────

    [Fact]
    public void Suggestions_drop_self_existing_networks_and_thin_overlap()
    {
        var rows = new[]
        {
            new CompetitorDomainRow("me.com", 90, 5),
            new CompetitorDomainRow("www.rival.com", 60, 4),
            new CompetitorDomainRow("already.com", 50, 4),
            new CompetitorDomainRow("facebook.com", 80, 2),
            new CompetitorDomainRow("en.wikipedia.org", 70, 3),
            new CompetitorDomainRow("thin.com", 1, 9),
            new CompetitorDomainRow("good.pk", 40, 7),
            new CompetitorDomainRow("health.gov.pk", 40, 7),
        };
        var picked = CompetitorSuggestions.Filter(rows, "me.com", ["already.com"]);
        Assert.Equal(["rival.com", "good.pk"], picked.Select(r => r.Domain));
    }

    [Fact]
    public void Parses_a_competitors_domain_reply()
    {
        const string json = """
            {"tasks":[{"status_code":20000,"result":[{"items":[
              {"domain":"Rival.com","avg_position":7.4,"intersections":120},
              {"domain":"","intersections":5},
              {"domain":"other.com","intersections":33}]}]}]}
            """;
        var rows = DataForSeoClient.ParseCompetitors(json, "me.com");
        Assert.Equal(2, rows.Count);
        Assert.Equal(new CompetitorDomainRow("rival.com", 120, 7), rows[0]);
        Assert.Null(rows[1].AveragePosition);
    }

    [Fact]
    public void An_account_problem_is_reported_in_safe_words()
    {
        var ex = Assert.Throws<KeywordProviderException>(() =>
            DataForSeoClient.ParseCompetitors("""{"tasks":[{"status_code":40200,"status_message":"secret internal text"}]}""", "me.com"));
        Assert.DoesNotContain("secret", ex.Message);
    }

    // ── Automatic fill-in ────────────────────────────────────────────────────

    private static TenantProposal Workspace(string name = "Acme Traders", string industry = "Retail") =>
        TenantProfileMapper.Propose(new TenantBusinessDetails(name, industry, "PK", "https://acme.pk", null, null));

    private static BusinessProfileDraftDto Read(string summary = "Acme sells running shoes and sportswear online to athletes across Pakistan.") =>
        new("Online sportswear store", summary, ["running shoes", "sportswear"], "Athletes", "Pakistan", 3);

    [Fact]
    public void Autofill_prefers_the_websites_own_words_and_adds_workspace_details()
    {
        var r = ProfileAutofillComposer.Compose("acme.pk", Workspace(), true, Read(), "Acme | Shoes");
        Assert.True(r.Filled);
        Assert.Equal("Acme Traders", r.Name);
        Assert.Equal("Online sportswear store", r.Industry);
        Assert.Equal(["running shoes", "sportswear"], r.Offers);
        Assert.Equal(ProfileSources.Website, r.Source);
        Assert.Contains("website", r.Note);
        Assert.Contains("workspace", r.Note);
    }

    [Fact]
    public void Autofill_falls_back_to_workspace_details_when_the_site_could_not_be_read()
    {
        var r = ProfileAutofillComposer.Compose("acme.pk", Workspace(), null, null, null);
        Assert.True(r.Filled);
        Assert.Equal(ProfileSources.Tenant, r.Source);
        Assert.Empty(r.Offers);                       // never invented
        Assert.Equal("Retail", r.Industry);
    }

    [Fact]
    public void Autofill_ignores_workspace_details_that_belong_to_a_different_website()
    {
        // The workspace's recorded website is another site: its name and industry describe another business.
        var r = ProfileAutofillComposer.Compose("other.com", Workspace(), false, Read("Other sells garden furniture to homeowners."), "Other Garden | Furniture");
        Assert.Equal("Other Garden", r.Name);
        Assert.Equal("Online sportswear store", r.Industry);   // the AI's reading of THIS site, not the workspace's
        Assert.DoesNotContain("workspace", r.Note);

        var none = ProfileAutofillComposer.Compose("other.com", Workspace(), false, null, null);
        Assert.False(none.Filled);                    // nothing trustworthy to say
    }

    [Fact]
    public void Autofill_reports_not_filled_when_there_is_nothing_to_go_on()
    {
        Assert.False(ProfileAutofillComposer.Compose("x.com", TenantProfileMapper.Propose(null), null, null, null).Filled);
        Assert.False(ProfileAutofillComposer.Compose("x.com", TenantProfileMapper.Propose(null), null, Read("too short"), null).Filled);
    }

    [Theory]
    [InlineData("Smile Dental | Family dentist in Islamabad", "Smile Dental")]
    [InlineData("Smile Dental - Home", "Smile Dental")]
    [InlineData("Smile Dental", "Smile Dental")]
    [InlineData("", null)]
    public void Business_name_is_taken_from_the_front_of_the_page_title(string title, string? expected) =>
        Assert.Equal(expected, ProfileAutofillComposer.TitleName(title));

    [Fact]
    public void An_automatic_draft_does_not_steer_content_until_a_person_confirms_it()
    {
        var p = SeoBusinessProfile.CreatePending(Guid.NewGuid(), "Acme");
        Assert.Equal(AutofillStatuses.Pending, p.AutofillStatus);
        Assert.Null(BusinessContext.From(p, null, "Acme"));

        p.ApplyAutofill("Acme", "Retail", "Acme sells running shoes online to athletes.", ["shoes"], null, null, ProfileSources.Website, "note");
        Assert.True(p.IsReady);
        Assert.True(p.IsDraft);
        Assert.Null(BusinessContext.From(p, null, "Acme"));      // ready, but still only a draft

        p.Update("Acme", "Retail", "Acme sells running shoes online to athletes.", ["shoes"], null, null, null, ProfileSources.Manual);
        Assert.False(p.IsDraft);
        Assert.NotNull(BusinessContext.From(p, null, "Acme"));   // confirmed
    }

    [Fact]
    public void Autofill_keeps_the_never_write_list_a_person_set()
    {
        var p = new SeoBusinessProfile(Guid.NewGuid());
        p.Update("Acme", "Retail", "Acme sells running shoes online to athletes.", ["shoes"], null, null, ["politics"], ProfileSources.Manual);
        p.RequestAutofill();
        p.ApplyAutofill("Acme", "Retail", "Acme sells running shoes online to athletes.", ["shoes"], null, null, ProfileSources.Website, null);
        Assert.Equal(["politics"], p.AvoidTopics);
    }
}
