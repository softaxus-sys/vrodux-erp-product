using System.Net;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Logging;
using PhoneNumbers;

namespace Softaxis.LeadGen.Infrastructure.Providers;

public sealed record WebsiteFindings(
    bool Reachable, string? FinalUrl, string? Title, IReadOnlyList<string> Emails, IReadOnlyList<string> Phones,
    IReadOnlyDictionary<string, string> Social, string? Note);

/// <summary>
/// Reads a business's own public website for the contact details it chose to publish: email
/// addresses, phone and WhatsApp numbers, social profiles. It is a polite reader — it identifies
/// itself, honours robots.txt, fetches at most three pages, never follows a link off the site,
/// reads a capped amount of each page, and will not connect to a private address.
/// </summary>
public interface IWebsiteEnricher
{
    Task<WebsiteFindings> FetchAsync(string website, string defaultRegion, CancellationToken ct);
}

internal sealed partial class WebsiteEnricher(IHttpClientFactory http, ILogger<WebsiteEnricher> logger) : IWebsiteEnricher
{
    public const string UserAgent = "VroduxLeadBot/1.0 (+https://vrodux.com/bot)";
    private const int MaxBytes = 600_000;
    private static readonly string[] ContactHints = ["contact", "about", "get-in-touch", "reach-us", "enquir", "inquir", "connect", "call-us", "اتصل"];

    [GeneratedRegex(@"[A-Za-z0-9._%+\-]+@[A-Za-z0-9\-]+(?:\.[A-Za-z0-9\-]+)*\.[A-Za-z]{2,24}")]
    private static partial Regex EmailRx();
    [GeneratedRegex(@"<a\b[^>]*?href\s*=\s*[""']([^""']+)[""']", RegexOptions.IgnoreCase)]
    private static partial Regex HrefRx();
    [GeneratedRegex(@"data-cfemail\s*=\s*[""']([0-9a-fA-F]{6,})[""']")]
    private static partial Regex CfEmailRx();
    [GeneratedRegex(@"<title[^>]*>(.*?)</title>", RegexOptions.IgnoreCase | RegexOptions.Singleline)]
    private static partial Regex TitleRx();
    [GeneratedRegex(@"(?:wa\.me/|api\.whatsapp\.com/send\?phone=|whatsapp\.com/send/?\?phone=)\+?(\d{8,15})", RegexOptions.IgnoreCase)]
    private static partial Regex WhatsAppRx();
    [GeneratedRegex(@"<(script|style|noscript)\b.*?</\1>", RegexOptions.IgnoreCase | RegexOptions.Singleline)]
    private static partial Regex StripBlocksRx();
    [GeneratedRegex(@"<[^>]+>")]
    private static partial Regex StripTagsRx();

    public async Task<WebsiteFindings> FetchAsync(string website, string defaultRegion, CancellationToken ct)
    {
        var start = SafeHttp.ParseWebsite(website);
        if (start is null) return Empty("Not a usable website address");

        using var budget = CancellationTokenSource.CreateLinkedTokenSource(ct);
        budget.CancelAfter(TimeSpan.FromSeconds(18));

        try
        {
            var client = http.CreateClient("leadgen-web");
            var robots = await LoadRobotsAsync(client, start, budget.Token);
            if (!robots.Allowed("/")) return Empty("The site asks robots not to read it", reachable: true);

            var first = await GetPageAsync(client, start, budget.Token);
            if (first is null) return Empty("The site could not be reached");

            var final = first.Value.finalUri;
            var pages = new List<(Uri uri, string html)> { (final, first.Value.html) };

            // Up to two contact-ish pages on the same host.
            foreach (var next in CandidatePages(final, first.Value.html).Take(2))
            {
                if (!robots.Allowed(next.AbsolutePath)) continue;
                var page = await GetPageAsync(client, next, budget.Token);
                if (page is not null) pages.Add((page.Value.finalUri, page.Value.html));
            }

            var emails = new List<string>(); var phones = new List<string>();
            var social = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            string? title = null;
            foreach (var (uri, html) in pages)
            {
                title ??= Title(html);
                foreach (var e in ExtractEmails(html)) if (!emails.Contains(e)) emails.Add(e);
                foreach (var p in ExtractPhones(html, defaultRegion)) if (!phones.Contains(p)) phones.Add(p);
                foreach (var kv in ExtractSocial(html)) social.TryAdd(kv.Key, kv.Value);
            }

            var domain = SafeHttp.Domain(start);
            emails = emails.OrderBy(e => Rank(e, domain)).Take(8).ToList();
            return new WebsiteFindings(true, final.ToString(), title, emails, phones.Take(5).ToList(), social, null);
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested) { return Empty("The site took too long to answer"); }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or IOException or UriFormatException)
        {
            logger.LogDebug(ex, "Website fetch failed for {Site}", website);
            return Empty("The site could not be reached");
        }
    }

    private static WebsiteFindings Empty(string note, bool reachable = false) =>
        new(reachable, null, null, [], [], new Dictionary<string, string>(), note);

    // ── Fetching ─────────────────────────────────────────────────────────────────────────────

    private static async Task<(Uri finalUri, string html)?> GetPageAsync(HttpClient client, Uri uri, CancellationToken ct)
    {
        using var req = new HttpRequestMessage(HttpMethod.Get, uri);
        req.Headers.UserAgent.ParseAdd(UserAgent);
        req.Headers.Accept.ParseAdd("text/html,application/xhtml+xml");
        using var res = await client.SendAsync(req, HttpCompletionOption.ResponseHeadersRead, ct);
        if (!res.IsSuccessStatusCode) return null;
        var type = res.Content.Headers.ContentType?.MediaType ?? "";
        if (type.Length > 0 && !type.Contains("html", StringComparison.OrdinalIgnoreCase) && !type.Contains("text", StringComparison.OrdinalIgnoreCase)) return null;

        await using var stream = await res.Content.ReadAsStreamAsync(ct);
        var buffer = new byte[MaxBytes]; var total = 0;
        while (total < MaxBytes)
        {
            var read = await stream.ReadAsync(buffer.AsMemory(total, MaxBytes - total), ct);
            if (read == 0) break;
            total += read;
        }
        var encoding = Encoding.UTF8;
        try { if (res.Content.Headers.ContentType?.CharSet is { } cs) encoding = Encoding.GetEncoding(cs.Trim('"')); } catch { }
        return (res.RequestMessage?.RequestUri ?? uri, encoding.GetString(buffer, 0, total));
    }

    private sealed class Robots(List<(bool allow, string path)> rules)
    {
        public bool Allowed(string path)
        {
            // The longest matching rule wins, as in the robots.txt standard.
            var best = rules.Where(r => path.StartsWith(r.path, StringComparison.Ordinal)).OrderByDescending(r => r.path.Length).FirstOrDefault();
            return best == default || best.allow;
        }
    }

    private static async Task<Robots> LoadRobotsAsync(HttpClient client, Uri site, CancellationToken ct)
    {
        try
        {
            using var req = new HttpRequestMessage(HttpMethod.Get, new Uri(site, "/robots.txt"));
            req.Headers.UserAgent.ParseAdd(UserAgent);
            using var res = await client.SendAsync(req, ct);
            if (!res.IsSuccessStatusCode) return new Robots([]);
            var text = await res.Content.ReadAsStringAsync(ct);
            if (text.Length > 64_000) text = text[..64_000];

            var rules = new List<(bool, string)>(); var applies = false; var inGroupHeader = false;
            foreach (var raw in text.Split('\n'))
            {
                var line = raw.Split('#')[0].Trim();
                var i = line.IndexOf(':'); if (i < 0) continue;
                var key = line[..i].Trim().ToLowerInvariant(); var value = line[(i + 1)..].Trim();
                if (key == "user-agent")
                {
                    var match = value == "*" || value.Contains("vroduxleadbot", StringComparison.OrdinalIgnoreCase);
                    applies = inGroupHeader ? applies || match : match;
                    inGroupHeader = true;
                }
                else
                {
                    inGroupHeader = false;
                    if (!applies) continue;
                    if (key == "disallow" && value.Length > 0) rules.Add((false, value));
                    else if (key == "allow" && value.Length > 0) rules.Add((true, value));
                }
            }
            return new Robots(rules);
        }
        catch (Exception ex) when (ex is not OperationCanceledException) { return new Robots([]); }
    }

    private static IEnumerable<Uri> CandidatePages(Uri home, string html)
    {
        var seen = new HashSet<string>();
        foreach (Match m in HrefRx().Matches(html))
        {
            var href = WebUtility.HtmlDecode(m.Groups[1].Value).Trim();
            if (href.StartsWith('#') || href.StartsWith("mailto:", StringComparison.OrdinalIgnoreCase) || href.StartsWith("tel:", StringComparison.OrdinalIgnoreCase) || href.StartsWith("javascript:", StringComparison.OrdinalIgnoreCase)) continue;
            if (!Uri.TryCreate(home, href, out var abs)) continue;
            if (abs.Scheme is not ("http" or "https")) continue;
            if (!string.Equals(abs.Host, home.Host, StringComparison.OrdinalIgnoreCase)) continue;   // never leave the site
            var path = abs.AbsolutePath.ToLowerInvariant();
            if (path is "/" or "") continue;
            if (!ContactHints.Any(h => path.Contains(h))) continue;
            if (path.EndsWith(".pdf") || path.EndsWith(".jpg") || path.EndsWith(".png")) continue;
            if (seen.Add(abs.AbsolutePath)) yield return new Uri(abs.GetLeftPart(UriPartial.Path));
        }
    }

    // ── Extraction ───────────────────────────────────────────────────────────────────────────

    private static string? Title(string html)
    {
        var m = TitleRx().Match(html); if (!m.Success) return null;
        var t = WebUtility.HtmlDecode(m.Groups[1].Value).Trim();
        t = Regex.Replace(t, @"\s+", " ");
        return t.Length == 0 ? null : t.Length > 160 ? t[..160] : t;
    }

    private static IEnumerable<string> ExtractEmails(string html)
    {
        var found = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        // Cloudflare's "email protection" hides addresses as hex; a large share of small business sites use it.
        foreach (Match m in CfEmailRx().Matches(html))
            if (DecodeCf(m.Groups[1].Value) is { } e) found.Add(e);

        var text = WebUtility.HtmlDecode(html);
        text = Regex.Replace(text, @"\s*[\[\(]\s*at\s*[\]\)]\s*", "@", RegexOptions.IgnoreCase);
        text = Regex.Replace(text, @"\s*[\[\(]\s*dot\s*[\]\)]\s*", ".", RegexOptions.IgnoreCase);
        foreach (Match m in EmailRx().Matches(text))
        {
            var e = m.Value.Trim('.', '-', '_').ToLowerInvariant();
            if (Plausible(e)) found.Add(e);
        }
        return found;
    }

    private static string? DecodeCf(string hex)
    {
        try
        {
            var key = Convert.ToInt32(hex[..2], 16); var sb = new StringBuilder();
            for (var i = 2; i + 1 < hex.Length; i += 2) sb.Append((char)(Convert.ToInt32(hex.Substring(i, 2), 16) ^ key));
            var e = sb.ToString().ToLowerInvariant();
            return Plausible(e) ? e : null;
        }
        catch { return null; }
    }

    private static readonly string[] BadLocals = ["noreply", "no-reply", "donotreply", "do-not-reply", "mailer-daemon", "postmaster", "wordpress", "example", "sentry", "u003e", "yourname", "name@", "email@", "user@", "username"];
    private static readonly string[] BadSuffixes = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".css", ".js", ".woff", ".woff2", ".ico", ".pdf"];

    private static bool Plausible(string e)
    {
        if (e.Length is < 6 or > 100) return false;
        if (BadSuffixes.Any(e.EndsWith)) return false;
        if (BadLocals.Any(e.Contains)) return false;
        var at = e.IndexOf('@'); if (at < 1 || e.IndexOf('@', at + 1) >= 0) return false;
        var domain = e[(at + 1)..];
        if (domain.Contains("..") || domain.StartsWith('.') || domain.StartsWith('-')) return false;
        if (domain is "example.com" or "domain.com" or "email.com" or "sentry.io" || domain.EndsWith("wixpress.com") || domain.EndsWith("sentry-next.wixpress.com")) return false;
        return true;
    }

    /// <summary>Lower is better: an address on the company's own domain first, a personal-looking one before a desk address.</summary>
    private static int Rank(string email, string siteDomain)
    {
        var domain = email[(email.IndexOf('@') + 1)..];
        var own = domain == siteDomain || domain.EndsWith("." + siteDomain) || siteDomain.EndsWith("." + domain);
        var role = Application.Scoring.ProspectScoring.IsRoleAddress(email);
        return (own ? 0 : 10) + (role ? 1 : 0);
    }

    private static IEnumerable<string> ExtractPhones(string html, string region)
    {
        var found = new List<string>();
        void Add(string? raw)
        {
            var p = PhoneNormalizer.Normalize(raw, region);
            if (p is not null && !found.Contains(p.E164)) found.Add(p.E164);
        }

        // tel: links and WhatsApp links are deliberate — the business put them there to be called.
        foreach (Match m in Regex.Matches(html, @"href\s*=\s*[""']tel:([^""']+)[""']", RegexOptions.IgnoreCase))
            Add(WebUtility.UrlDecode(m.Groups[1].Value));
        foreach (Match m in WhatsAppRx().Matches(html)) Add("+" + m.Groups[1].Value);

        // Numbers printed in the page text (footers, contact blocks), read through the phone library.
        var text = WebUtility.HtmlDecode(StripTagsRx().Replace(StripBlocksRx().Replace(html, " "), " "));
        if (text.Length > 200_000) text = text[..200_000];
        var util = PhoneNumberUtil.GetInstance();
        foreach (var match in util.FindNumbers(text, region.ToUpperInvariant(), PhoneNumberUtil.Leniency.VALID, 25).Take(12))
            Add(util.Format(match.Number, PhoneNumberFormat.E164));

        return found;
    }

    private static IEnumerable<KeyValuePair<string, string>> ExtractSocial(string html)
    {
        var rules = new (string key, string pattern, string[] skip)[]
        {
            ("facebook",  @"https?://(?:www\.|m\.)?facebook\.com/(?!sharer|share|plugins|tr\?|dialog|login|policies|help|events/)[A-Za-z0-9._\-/]+", []),
            ("instagram", @"https?://(?:www\.)?instagram\.com/(?!p/|reel/|explore|accounts|about)[A-Za-z0-9._]+", []),
            ("linkedin",  @"https?://(?:[a-z]{2,3}\.)?linkedin\.com/(?:company|school)/[A-Za-z0-9\-_%]+", []),
            ("x",         @"https?://(?:www\.)?(?:twitter|x)\.com/(?!intent|share|home|i/|search)[A-Za-z0-9_]{2,15}", []),
            ("youtube",   @"https?://(?:www\.)?youtube\.com/(?:@|c/|channel/|user/)[A-Za-z0-9._\-]+", []),
            ("tiktok",    @"https?://(?:www\.)?tiktok\.com/@[A-Za-z0-9._]+", []),
        };
        foreach (var (key, pattern, _) in rules)
        {
            var m = Regex.Match(html, pattern, RegexOptions.IgnoreCase);
            if (m.Success) yield return new(key, m.Value.TrimEnd('/', '"', '\'', '\\'));
        }
    }
}
