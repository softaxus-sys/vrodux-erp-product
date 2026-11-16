using System.Text.Json;
using System.Text.RegularExpressions;
using AngleSharp;
using AngleSharp.Dom;
using Softaxis.AiAssistant.Application.Abstractions;
using Softaxis.Seo.Application.Profile;
using Softaxis.Seo.Infrastructure.Net;

namespace Softaxis.Seo.Infrastructure.Profile;

/// <summary>The readable text of one page of the site: what a visitor would read, not the markup.</summary>
public sealed record SiteText(string Url, string? Title, string? MetaDescription, IReadOnlyList<string> Headings, string Body);

/// <summary>
/// Reads the home page plus the few pages most likely to say what the business does (about, services, products), so the business profile can
/// be drafted from the site itself. The audit crawler records only titles and counts, never body text, so this is the one place the words
/// of a page are read. Every request goes through <see cref="SafeFetcher"/>.
/// </summary>
public sealed class SiteTextReader(SafeFetcher fetcher)
{
    private const int MaxExtraPages = 4;
    private const int BodyChars = 1800;
    private static readonly Regex Interesting = new(
        @"about|who-we-are|our-story|company|service|solution|product|what-we|offer|treatment|program|course|collection|menu|pricing|industr|specialt",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    public async Task<IReadOnlyList<SiteText>> ReadAsync(string domain, CancellationToken ct)
    {
        var scheme = fetcher.AllowPrivate ? "http" : "https";
        var home = await fetcher.FetchAsync($"{scheme}://{domain}/", ct);
        if (!home.Ok || !home.IsHtml || string.IsNullOrEmpty(home.Body)) return [];

        var pages = new List<SiteText>();
        var homeUri = new Uri(home.FinalUrl);
        var (homeText, links) = await ExtractAsync(home.FinalUrl, home.Body, homeUri, ct);
        pages.Add(homeText);

        var wanted = links.Where(l => Interesting.IsMatch(l.Href) || Interesting.IsMatch(l.Label))
            .Select(l => l.Href).Distinct(StringComparer.Ordinal)
            .Where(h => !string.Equals(h.TrimEnd('/'), home.FinalUrl.TrimEnd('/'), StringComparison.OrdinalIgnoreCase))
            .Take(MaxExtraPages).ToList();

        foreach (var url in wanted)
        {
            ct.ThrowIfCancellationRequested();
            var r = await fetcher.FetchAsync(url, ct, maxBytes: 1_000_000);
            if (!r.Ok || !r.IsHtml || string.IsNullOrEmpty(r.Body)) continue;
            var (text, _) = await ExtractAsync(r.FinalUrl, r.Body, homeUri, ct);
            if (text.Body.Length > 0) pages.Add(text);
        }
        return pages;
    }

    private sealed record Link(string Href, string Label);

    private static async Task<(SiteText Text, List<Link> Links)> ExtractAsync(string url, string html, Uri home, CancellationToken ct)
    {
        using var doc = await BrowsingContext.New(Configuration.Default).OpenAsync(req => req.Content(html), ct);
        static string Clean(string? s) => Regex.Replace(s ?? "", @"\s+", " ").Trim();

        var links = new List<Link>();
        foreach (var a in doc.QuerySelectorAll("a[href]"))
        {
            var href = a.GetAttribute("href")?.Trim();
            if (string.IsNullOrEmpty(href) || href.StartsWith('#') || !Uri.TryCreate(home, href, out var u)) continue;
            if (u.Scheme is not ("http" or "https")) continue;
            if (!string.Equals(TenantProfileMapper.Host(u.Authority), TenantProfileMapper.Host(home.Authority), StringComparison.OrdinalIgnoreCase)) continue;
            links.Add(new Link(u.GetLeftPart(UriPartial.Path), Clean(a.TextContent)));
        }

        var title = Clean(doc.QuerySelector("title")?.TextContent);
        var desc = Clean(doc.QuerySelector("meta[name='description' i]")?.GetAttribute("content"));
        var headings = doc.QuerySelectorAll("h1, h2, h3").Select(h => Clean(h.TextContent)).Where(h => h.Length is > 2 and < 150).Distinct().Take(14).ToList();

        foreach (var junk in doc.QuerySelectorAll("script, style, noscript, template, nav, footer, header, form, svg").ToList()) junk.Remove();
        var body = Clean(doc.Body?.TextContent);
        if (body.Length > BodyChars) body = body[..BodyChars];

        return (new SiteText(url, title.Length > 0 ? title : null, desc.Length > 0 ? desc : null, headings, body), links);
    }
}

public interface IBusinessProfileDrafter
{
    /// <summary>A profile proposed from the site's own words. Throws <see cref="InvalidOperationException"/> with a customer-safe reason if no AI is available.</summary>
    Task<BusinessProfileDraftDto> DraftAsync(IReadOnlyList<SiteText> pages, CancellationToken ct);
}

public sealed class BusinessProfileDrafter(IAiCompletionService completion) : IBusinessProfileDrafter
{
    private const string System = """
        You read text taken from a business's own website and describe the business, so an SEO tool can keep its content on topic.
        Use ONLY what the text says. If something is not clear from the text, leave that field empty — do not guess, and never invent
        names, prices, addresses or claims.

        Respond with ONLY a JSON object, no prose, no markdown fences:
        {
          "industry": "<2-4 words, e.g. 'Dental clinic', 'Online fashion store'>",
          "summary": "<2-4 plain sentences: what the business does and who it is for>",
          "offers": ["<a product or service it actually sells, 2-5 words>", ... up to 10],
          "audience": "<who its customers are, one sentence>",
          "serviceAreas": "<where it operates, if the text says; else empty>"
        }
        """;

    public async Task<BusinessProfileDraftDto> DraftAsync(IReadOnlyList<SiteText> pages, CancellationToken ct)
    {
        var user = JsonSerializer.Serialize(pages.Select(p => new { p.Url, p.Title, description = p.MetaDescription, p.Headings, text = p.Body }));

        string raw;
        try { raw = await completion.CompleteAsync(System, user, ct); }
        catch (Exception ex) { throw new InvalidOperationException(ex.Message); }

        var s = raw.Trim();
        var start = s.IndexOf('{'); var end = s.LastIndexOf('}');
        if (start < 0 || end <= start) throw new InvalidOperationException("The AI answered in a way we could not read. Try again.");

        try
        {
            using var doc = JsonDocument.Parse(s[start..(end + 1)]);
            var root = doc.RootElement;
            string Str(string n) => root.TryGetProperty(n, out var p) && p.ValueKind == JsonValueKind.String ? p.GetString()!.Trim() : "";
            var offers = root.TryGetProperty("offers", out var o) && o.ValueKind == JsonValueKind.Array
                ? o.EnumerateArray().Where(x => x.ValueKind == JsonValueKind.String).Select(x => x.GetString()!.Trim()).Where(x => x.Length > 0).Take(10).ToList()
                : [];
            return new BusinessProfileDraftDto(Str("industry") is { Length: > 0 } i ? i : null, Str("summary"), offers, Str("audience"), Str("serviceAreas"), pages.Count);
        }
        catch (JsonException) { throw new InvalidOperationException("The AI answered in a way we could not read. Try again."); }
    }
}
