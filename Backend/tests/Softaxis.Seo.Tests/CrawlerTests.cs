using System.Net;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Softaxis.Seo.Infrastructure.Crawl;
using Softaxis.Seo.Infrastructure.Net;

namespace Softaxis.Seo.Tests;

/// <summary>A real crawl of a tiny local site with known flaws — nothing mocked below the HTTP listener.</summary>
public sealed class CrawlerTests : IDisposable
{
    private readonly HttpListener _listener = new();
    private readonly CancellationTokenSource _stop = new();
    private readonly int _port;
    private int _hits;

    private static string Html(string title, string body, string head = "") =>
        $"<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><title>{title}</title>" +
        $"<meta name=\"viewport\" content=\"width=device-width\"><meta name=\"description\" content=\"{title} — a description that is comfortably long enough for the rule.\">{head}</head><body>{body}</body></html>";

    public CrawlerTests()
    {
        // Pick a free port, then listen on it.
        var probe = new System.Net.Sockets.TcpListener(IPAddress.Loopback, 0); probe.Start();
        _port = ((IPEndPoint)probe.LocalEndpoint).Port; probe.Stop();
        _listener.Prefixes.Add($"http://127.0.0.1:{_port}/"); _listener.Start();
        _ = Task.Run(async () =>
        {
            while (!_stop.IsCancellationRequested)
            {
                HttpListenerContext c;
                try { c = await _listener.GetContextAsync(); } catch { return; }
                _ = Task.Run(() => Handle(c));
            }
        });
    }

    private void Handle(HttpListenerContext c)
    {
        Interlocked.Increment(ref _hits);
        var path = c.Request.Url!.AbsolutePath; var res = c.Response;
        string? body = null; var status = 200; var type = "text/html; charset=utf-8";
        switch (path)
        {
            case "/":
                body = Html("Home page of the test site", "<h1>Home</h1><a href='/a'>a</a><a href='/b'>b</a><a href='/missing'>gone</a><a href='/old'>old</a><a href='https://example.invalid/x'>ext</a>" + new string('w', 10) + string.Join(" ", Enumerable.Repeat("word", 200)));
                break;
            case "/a": body = Html("Duplicate title of two pages", "<h1>A</h1>" + string.Join(" ", Enumerable.Repeat("word", 200))); break;
            case "/b": body = Html("Duplicate title of two pages", "<h1>B</h1>" + string.Join(" ", Enumerable.Repeat("word", 200))); break;
            case "/old": res.StatusCode = 301; res.RedirectLocation = "/hop"; break;
            case "/hop": res.StatusCode = 302; res.RedirectLocation = "/a"; break;
            case "/robots.txt": body = $"User-agent: *\nDisallow: /secret\nSitemap: http://127.0.0.1:{_port}/sitemap.xml\n"; type = "text/plain"; break;
            case "/sitemap.xml":
                body = $"<?xml version=\"1.0\"?><urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\"><url><loc>http://127.0.0.1:{_port}/</loc></url><url><loc>http://127.0.0.1:{_port}/orphan</loc></url></urlset>";
                type = "application/xml"; break;
            case "/orphan": body = Html("A page nothing links to at all", "<h1>Orphan</h1>" + string.Join(" ", Enumerable.Repeat("word", 200))); break;
            case "/secret": body = Html("Never fetched because of robots", "<h1>no</h1>"); break;
            default: status = 404; body = "<html><body>not found</body></html>"; break;
        }
        if (res.StatusCode is 301 or 302) { res.Close(); return; }
        res.StatusCode = status; res.ContentType = type;
        var bytes = Encoding.UTF8.GetBytes(body ?? ""); res.OutputStream.Write(bytes); res.Close();
    }

    private SiteCrawler NewCrawler()
    {
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["ASPNETCORE_ENVIRONMENT"] = "Development", ["Seo:AllowPrivateAddresses"] = "true",
        }).Build();
        var services = new ServiceCollection();
        services.AddHttpClient(SafeFetcher.ClientName).ConfigurePrimaryHttpMessageHandler(() => SsrfGuard.CreateHandler(true));
        var sp = services.BuildServiceProvider();
        return new SiteCrawler(new SafeFetcher(sp.GetRequiredService<IHttpClientFactory>(), config), NullLogger<SiteCrawler>.Instance);
    }

    [Fact]
    public async Task Crawl_finds_the_known_flaws_and_respects_robots()
    {
        var result = await NewCrawler().CrawlSiteAsync($"127.0.0.1:{_port}", new CrawlLimits(50, 2, 0), CancellationToken.None);

        Assert.True(result.Robots.Found);
        Assert.True(result.Sitemap.Found);
        Assert.Contains(result.Pages, p => p.Url.EndsWith("/a") && p.Ok);
        Assert.Contains(result.Pages, p => p.Url.EndsWith("/orphan") && p.Ok);          // found through the sitemap
        Assert.DoesNotContain(result.Pages, p => p.Url.EndsWith("/secret") && p.StatusCode != 0);   // robots-blocked: listed, never fetched

        var findings = SeoIssueDetector.Detect(result);
        Assert.Contains(findings, f => f.Code == "dup.title" && f.Affected == 2);
        Assert.Contains(findings, f => f.Code == "link.broken-internal" && f.PageUrl!.EndsWith("/missing"));
        Assert.Contains(findings, f => f.Code == "redirect.chain" && f.PageUrl!.EndsWith("/old"));
        Assert.Contains(findings, f => f.Code == "page.orphan" && f.PageUrl!.EndsWith("/orphan"));
        Assert.DoesNotContain(findings, f => f.Code == "robots.missing" || f.Code == "sitemap.missing");
    }

    [Fact]
    public async Task Crawl_never_goes_past_its_page_limit()
    {
        var before = _hits;
        var result = await NewCrawler().CrawlSiteAsync($"127.0.0.1:{_port}", new CrawlLimits(2, 1, 0), CancellationToken.None);
        Assert.Equal(2, result.Pages.Count(p => !p.BlockedByRobots));
        Assert.True(result.Truncated);
        Assert.True(_hits - before < 15);
    }

    [Fact]
    public async Task Private_addresses_are_refused_in_production_mode()
    {
        var config = new ConfigurationBuilder().Build();     // not Development, no override
        var services = new ServiceCollection();
        services.AddHttpClient(SafeFetcher.ClientName).ConfigurePrimaryHttpMessageHandler(() => SsrfGuard.CreateHandler(false));
        var fetcher = new SafeFetcher(services.BuildServiceProvider().GetRequiredService<IHttpClientFactory>(), config);
        var before = _hits;

        foreach (var url in new[] { $"http://127.0.0.1:{_port}/", "http://169.254.169.254/latest/meta-data/", "http://localhost/", "http://10.0.0.5/" })
        {
            var r = await fetcher.FetchAsync(url, CancellationToken.None);
            Assert.NotNull(r.Error);
            Assert.Equal(0, r.StatusCode);
        }
        Assert.Equal(before, _hits);        // the local server never saw a request
    }

    public void Dispose() { _stop.Cancel(); try { _listener.Close(); } catch { } }
}
