using System.Net;
using Softaxis.Seo.Infrastructure.Crawl;
using Softaxis.Seo.Infrastructure.Net;

namespace Softaxis.Seo.Tests;

public class SsrfGuardTests
{
    [Theory]
    [InlineData("127.0.0.1")]
    [InlineData("127.5.5.5")]
    [InlineData("10.0.0.1")]
    [InlineData("172.16.0.1")]
    [InlineData("172.31.255.255")]
    [InlineData("192.168.1.10")]
    [InlineData("169.254.169.254")]      // cloud metadata
    [InlineData("100.64.0.1")]           // carrier-grade NAT
    [InlineData("0.0.0.0")]
    [InlineData("224.0.0.1")]
    [InlineData("::1")]
    [InlineData("fe80::1")]
    [InlineData("fc00::1")]
    [InlineData("::ffff:127.0.0.1")]     // v4-mapped loopback
    [InlineData("::ffff:10.1.2.3")]
    public void Internal_addresses_are_blocked(string ip) => Assert.True(SsrfGuard.IsBlocked(IPAddress.Parse(ip)));

    [Theory]
    [InlineData("8.8.8.8")]
    [InlineData("1.1.1.1")]
    [InlineData("93.184.216.34")]
    [InlineData("172.15.0.1")]           // just outside 172.16/12
    [InlineData("172.32.0.1")]
    [InlineData("2606:4700:4700::1111")]
    public void Public_addresses_are_allowed(string ip) => Assert.False(SsrfGuard.IsBlocked(IPAddress.Parse(ip)));

    [Theory]
    [InlineData("example.com", true)]
    [InlineData("shop.example.co.uk", true)]
    [InlineData("localhost", false)]
    [InlineData("foo.local", false)]
    [InlineData("db.internal", false)]
    [InlineData("127.0.0.1", false)]
    [InlineData("169.254.169.254", false)]
    [InlineData("intranet", false)]
    [InlineData("exa mple.com", false)]
    [InlineData("example.com/path", false)]
    [InlineData("", false)]
    public void Only_plausible_public_hosts_are_accepted(string host, bool expected) =>
        Assert.Equal(expected, SsrfGuard.IsPlausiblePublicHost(host));

    [Fact]
    public void Private_hosts_are_accepted_only_when_explicitly_allowed()
    {
        Assert.True(SsrfGuard.IsPlausiblePublicHost("127.0.0.1", allowPrivate: true));
        Assert.True(SsrfGuard.IsPlausiblePublicHost("localhost", allowPrivate: true));
    }
}

public class RobotsRulesTests
{
    [Fact]
    public void Disallow_and_allow_use_the_longest_match()
    {
        var r = RobotsRules.Parse("User-agent: *\nDisallow: /private/\nAllow: /private/public/\n");
        Assert.True(r.IsAllowed("/"));
        Assert.False(r.IsAllowed("/private/x"));
        Assert.True(r.IsAllowed("/private/public/page"));
    }

    [Fact]
    public void Disallow_everything_is_detected()
    {
        var r = RobotsRules.Parse("User-agent: *\nDisallow: /\n");
        Assert.True(r.BlocksEverything);
        Assert.False(r.IsAllowed("/anything"));
    }

    [Fact]
    public void An_empty_disallow_allows_everything()
    {
        var r = RobotsRules.Parse("User-agent: *\nDisallow:\n");
        Assert.False(r.BlocksEverything);
        Assert.True(r.IsAllowed("/x"));
    }

    [Fact]
    public void Our_own_group_wins_over_the_star_group()
    {
        var r = RobotsRules.Parse("User-agent: *\nDisallow: /\n\nUser-agent: VroduxSEOBot\nDisallow: /admin\n");
        Assert.True(r.IsAllowed("/shop"));
        Assert.False(r.IsAllowed("/admin/users"));
    }

    [Fact]
    public void Wildcards_and_end_anchors_work_and_sitemaps_are_listed()
    {
        var r = RobotsRules.Parse("User-agent: *\nDisallow: /*.pdf$\nSitemap: https://example.com/sitemap.xml\n");
        Assert.False(r.IsAllowed("/a/b.pdf"));
        Assert.True(r.IsAllowed("/a/b.pdf.html"));
        Assert.Equal(["https://example.com/sitemap.xml"], r.Sitemaps);
    }

    [Fact]
    public void Comments_and_garbage_lines_are_ignored()
    {
        var r = RobotsRules.Parse("# hello\nUser-agent: *   # everyone\nnonsense\nDisallow: /x # no\n");
        Assert.False(r.IsAllowed("/x"));
        Assert.True(r.IsAllowed("/y"));
    }
}

public class OptionsTests
{
    [Theory]
    [InlineData(1, 1)]
    [InlineData(25, 1)]
    [InlineData(26, 2)]
    [InlineData(500, 20)]
    [InlineData(0, 1)]       // a charge is never zero
    public void Credits_round_up_by_the_page(int pages, int credits) => Assert.Equal(credits, new SeoOptions().CreditsFor(pages));
}

public class DetectorTests
{
    private static CrawledPage Page(string url, string? title = "A good descriptive page title here", string? desc = "A meta description that is long enough to be useful to a search engine reader, around a hundred chars.",
        int status = 200, int words = 400, int depth = 1, int ms = 200, IEnumerable<string>? links = null, string? canonical = "same", bool schema = true,
        IEnumerable<string>? h1 = null, bool viewport = true, string? lang = "en", string? og = "x", IEnumerable<string>? missingAlt = null, int mixed = 0, string? robotsMeta = null) =>
        new(url, url, status, [new RedirectStep(url, status)], ms, 5000, "text/html", depth, true,
            title, title is null ? 0 : 1, desc, desc is null ? 0 : 1, canonical == "same" ? url : canonical, robotsMeta, null,
            lang, viewport, (h1 ?? ["Heading"]).ToList(), 2, words, 3, (missingAlt ?? []).ToList(), schema ? ["Product"] : [], og, og, [],
            (links ?? []).ToList(), [], mixed, false, null);

    private static CrawlResult Crawl(params CrawledPage[] pages) =>
        new("example.com", "https://example.com", "example.com", pages, new RobotsInfo(true, 200, false, [], null),
            new SitemapInfo(true, [], [], 1), [], true, true, false, pages.Length, 100);

    [Fact]
    public void A_clean_page_has_no_findings()
    {
        var found = SeoIssueDetector.Detect(Crawl(Page("https://example.com/", depth: 0)));
        Assert.True(found.Count == 0, string.Join(",", found.Select(x => x.Code)));
        Assert.Equal(100, SeoScore.Compute(found, 1));
    }

    [Fact]
    public void Missing_metadata_is_found_on_the_right_page()
    {
        var found = SeoIssueDetector.Detect(Crawl(Page("https://example.com/", title: null, desc: null)));
        Assert.Contains(found, f => f.Code == "title.missing" && f.PageUrl == "https://example.com/");
        Assert.Contains(found, f => f.Code == "desc.missing");
    }

    [Fact]
    public void Duplicate_titles_are_one_finding_covering_all_pages()
    {
        var found = SeoIssueDetector.Detect(Crawl(
            Page("https://example.com/a", title: "Same title on two pages here"),
            Page("https://example.com/b", title: "Same title on two pages here"),
            Page("https://example.com/c", title: "A different title for this one")));
        var dup = Assert.Single(found, f => f.Code == "dup.title");
        Assert.Equal(2, dup.Affected);
    }

    [Fact]
    public void A_broken_internal_link_names_the_pages_that_link_to_it()
    {
        var found = SeoIssueDetector.Detect(Crawl(
            Page("https://example.com/", links: ["https://example.com/gone"]),
            Page("https://example.com/gone", status: 404)));
        var broken = Assert.Single(found, f => f.Code == "link.broken-internal");
        Assert.Equal(1, broken.Affected);
        Assert.Contains("https://example.com/", broken.Details);
    }

    [Fact]
    public void Noindex_pages_are_not_judged_on_their_metadata()
    {
        var found = SeoIssueDetector.Detect(Crawl(Page("https://example.com/x", title: null, robotsMeta: "noindex")));
        Assert.DoesNotContain(found, f => f.Code == "title.missing");
    }

    [Fact]
    public void Missing_site_files_are_reported_once()
    {
        var crawl = new CrawlResult("example.com", "https://example.com", "example.com", [Page("https://example.com/")],
            new RobotsInfo(false, 404, false, [], null), new SitemapInfo(false, [], [], 1), [], false, true, false, 1, 10);
        var found = SeoIssueDetector.Detect(crawl);
        Assert.Single(found, f => f.Code == "robots.missing");
        Assert.Single(found, f => f.Code == "sitemap.missing");
        Assert.Single(found, f => f.Code == "https.not-enforced");
    }

    [Fact]
    public void The_same_problem_has_the_same_fingerprint_every_scan()
    {
        var a = SeoIssueDetector.Detect(Crawl(Page("https://example.com/", title: null))).Single(f => f.Code == "title.missing");
        var b = SeoIssueDetector.Detect(Crawl(Page("https://example.com/", title: null), Page("https://example.com/other"))).Single(f => f.Code == "title.missing");
        Assert.Equal(a.Fingerprint, b.Fingerprint);
    }

    [Fact]
    public void Fingerprints_of_long_keys_stay_short()
    {
        Assert.True(SeoIssueDetector.Fp("dup.title", new string('x', 5000)).Length < 100);
    }

    [Fact]
    public void Score_falls_with_severity_and_spread_and_stays_in_range()
    {
        var few = SeoIssueDetector.Detect(Crawl(Page("https://example.com/", title: null), Page("https://example.com/b", title: "Second distinct page title text"), Page("https://example.com/c", title: "Third distinct page title text"), Page("https://example.com/d", title: "Fourth distinct page title text")));
        var all = SeoIssueDetector.Detect(Crawl(Page("https://example.com/", title: null), Page("https://example.com/b", title: null), Page("https://example.com/c", title: null), Page("https://example.com/d", title: null)));
        var scoreFew = SeoScore.Compute(few, 4);
        var scoreAll = SeoScore.Compute(all, 4);
        Assert.True(scoreAll < scoreFew);
        Assert.InRange(scoreAll, 0, 100);
        Assert.Equal(0, SeoScore.Compute(Enumerable.Range(0, 60).Select(i => new SeoIssueDetector.Finding($"c{i}", "technical", "critical", "t", "d", null, 1, [], $"c{i}")), 1));
    }

    [Fact]
    public void Informational_findings_do_not_cost_points()
    {
        var f = new SeoIssueDetector.Finding("crawl.limit", "technical", "low", "t", "d", null, 1, [], "crawl.limit");
        Assert.Equal(100, SeoScore.Compute([f], 10));
    }
}
