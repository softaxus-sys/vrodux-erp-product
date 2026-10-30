using Softaxis.Seo.Application.Competitors;
using Softaxis.Seo.Domain.Entities;
using Softaxis.Seo.Infrastructure.Competitors;

namespace Softaxis.Seo.Tests;

public class CompetitorTests
{
    private static PageText P(string url, string title) => new(url, title, null);

    [Fact]
    public void Normalize_strips_scheme_www_and_path()
    {
        Assert.Equal("example.com", SeoCompetitor.Normalize("https://www.Example.com/shop/x"));
        Assert.Equal("example.com", SeoCompetitor.Normalize(" example.com "));
    }

    [Fact]
    public void Topic_gap_is_a_phrase_competitors_cover_and_the_site_does_not()
    {
        var own = new[] { P("https://me.com/", "Wedding Photography Dubai") };
        var comp = new Dictionary<string, IReadOnlyList<PageText>>
        {
            ["rival.com"] = [P("https://rival.com/a", "Corporate Event Videography | Rival"), P("https://rival.com/b", "Corporate Event Videography Packages")],
            ["other.com"] = [P("https://other.com/a", "Wedding Photography Dubai")],
        };
        var gaps = CompetitorAnalysis.TopicGaps(own, comp);
        Assert.Contains(gaps, g => g.Phrase == "corporate event");
        Assert.Contains(gaps, g => g.Phrase == "event videography");
        // already covered by the site
        Assert.DoesNotContain(gaps, g => g.Phrase == "wedding photography");
    }

    [Fact]
    public void Topic_needs_at_least_two_competitor_pages_and_ignores_brand_names()
    {
        var comp = new Dictionary<string, IReadOnlyList<PageText>>
        {
            ["acme-widgets.com"] = [P("https://acme-widgets.com/a", "Acme Widgets Home"), P("https://acme-widgets.com/b", "Acme Widgets About"), P("https://acme-widgets.com/c", "Titanium Hinges")],
        };
        var gaps = CompetitorAnalysis.TopicGaps([], comp);
        Assert.DoesNotContain(gaps, g => g.Phrase.Contains("acme"));
        Assert.DoesNotContain(gaps, g => g.Phrase == "titanium hinges"); // only one page
    }

    [Fact]
    public void Keyword_gap_excludes_what_the_site_already_ranks_for_low_volume_and_brand_terms()
    {
        var own = new[] { new KeywordRow("running shoes", 5000, 40, 8, null) };
        var comp = new Dictionary<string, IReadOnlyList<KeywordRow>>
        {
            ["rival.com"] =
            [
                new KeywordRow("running shoes", 5000, 40, 2, null),          // we already rank
                new KeywordRow("trail running shoes", 900, 30, 4, null),     // gap
                new KeywordRow("tiny term", 5, 10, 1, null),                 // too little demand
                new KeywordRow("rival store", 3000, 5, 1, null),             // their brand
                new KeywordRow("far away", 3000, 30, 55, null),              // they barely rank
            ],
        };
        var gaps = CompetitorAnalysis.KeywordGaps(own, comp);
        Assert.Single(gaps);
        Assert.Equal("trail running shoes", gaps[0].Keyword);
    }

    [Fact]
    public void Keyword_gap_prefers_terms_several_competitors_share()
    {
        var comp = new Dictionary<string, IReadOnlyList<KeywordRow>>
        {
            ["a.com"] = [new KeywordRow("foo bar", 1000, 30, 3, null), new KeywordRow("solo term", 1000, 30, 3, null)],
            ["b.com"] = [new KeywordRow("foo bar", 1000, 30, 5, null)],
        };
        var gaps = CompetitorAnalysis.KeywordGaps([], comp);
        Assert.Equal("foo bar", gaps[0].Keyword);
        Assert.Equal(2, gaps[0].CompetitorCount);
        Assert.Equal(3, gaps[0].Position);
    }

    [Fact]
    public void Plan_is_dated_two_days_apart_has_no_duplicate_ground_and_caps_at_fifteen()
    {
        var kw = Enumerable.Range(0, 30).Select(i => new KeywordGapDto($"widget{i} guide", 1000 - i, 30, "a.com", 3, 1)).ToList();
        kw.Insert(1, new KeywordGapDto("widget0 guide tips", 900, 30, "a.com", 3, 1)); // overlaps the first
        var plan = CompetitorAnalysis.BuildPlan(kw, [], new DateOnly(2026, 1, 1));
        Assert.Equal(15, plan.Count);
        Assert.Equal("2026-01-02", plan[0].PlannedDate);
        Assert.Equal("2026-01-04", plan[1].PlannedDate);
        Assert.Equal("2026-01-30", plan[^1].PlannedDate);
        Assert.DoesNotContain(plan, p => p.TargetKeyword == "widget0 guide tips");
    }

    [Fact]
    public void Plan_mixes_in_topics_when_there_are_some()
    {
        var kw = Enumerable.Range(0, 30).Select(i => new KeywordGapDto($"alpha{i} keyword", 500, 30, "a.com", 3, 1)).ToList();
        var topics = new[] { new TopicGapDto("corporate videography", 4, 2, "Corporate Videography", "https://x.com/a") };
        var plan = CompetitorAnalysis.BuildPlan(kw, topics, new DateOnly(2026, 1, 1));
        Assert.Contains(plan, p => p.Source == "topic");
        Assert.Contains(plan, p => p.Source == "keyword");
    }

    [Fact]
    public void Plan_is_empty_when_there_is_nothing_to_close()
    {
        Assert.Empty(CompetitorAnalysis.BuildPlan([], [], new DateOnly(2026, 1, 1)));
    }

    [Fact]
    public void Provider_response_is_read()
    {
        const string json = """
        {"status_code":20000,"tasks":[{"status_code":20000,"result":[{"items":[
          {"keyword_data":{"keyword":"Trail Shoes","keyword_info":{"search_volume":900},"keyword_properties":{"keyword_difficulty":33}},
           "ranked_serps_element":{"serp_item":{"rank_group":4,"url":"https://x.com/t"}}},
          {"keyword_data":{"keyword":"no volume"},"ranked_serps_element":{"serp_item":{"rank_group":9}}}
        ]}]}]}
        """;
        var rows = DataForSeoClient.Parse(json, "x.com");
        Assert.Equal(2, rows.Count);
        Assert.Equal(new KeywordRow("trail shoes", 900, 33, 4, "https://x.com/t"), rows[0]);
        Assert.Equal(0, rows[1].Volume);
    }

    [Theory]
    [InlineData(40200)]
    [InlineData(40101)]
    [InlineData(50000)]
    public void Provider_errors_become_safe_messages(int code)
    {
        var json = $$"""{"tasks":[{"status_code":{{code}},"status_message":"secret internal text"}]}""";
        var ex = Assert.Throws<KeywordProviderException>(() => DataForSeoClient.Parse(json, "x.com"));
        Assert.DoesNotContain("secret", ex.Message);
    }

    [Fact]
    public void Garbage_response_is_a_safe_error()
    {
        Assert.Throws<KeywordProviderException>(() => DataForSeoClient.Parse("<html>", "x.com"));
    }

    [Fact]
    public void Locations_include_the_default()
    {
        Assert.True(CompetitorLocations.IsKnown(CompetitorLocations.Default));
        Assert.False(CompetitorLocations.IsKnown(1));
    }
}
