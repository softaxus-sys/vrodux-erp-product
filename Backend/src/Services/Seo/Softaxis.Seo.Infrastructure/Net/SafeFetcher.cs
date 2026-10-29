using System.Diagnostics;
using System.Net;
using System.Text;
using Microsoft.Extensions.Configuration;

namespace Softaxis.Seo.Infrastructure.Net;

public sealed record Hop(string Url, int Status);

/// <param name="Error">Set when no response came back at all (unreachable, refused, timed out, blocked address, too many redirects).</param>
public sealed record FetchResult(
    string RequestedUrl, string FinalUrl, int StatusCode, IReadOnlyList<Hop> Hops, string? ContentType, string? XRobotsTag,
    string? Body, int Bytes, long ElapsedMs, string? Error, bool Truncated, bool RedirectLoop)
{
    public bool Ok => Error is null && StatusCode is >= 200 and < 300;
    public bool IsHtml => ContentType is not null && ContentType.Contains("html", StringComparison.OrdinalIgnoreCase);
}

/// <summary>
/// Every outbound fetch of a customer-supplied address goes through here: http/https only, standard ports only, redirects followed
/// by hand (a handful, each hop re-validated by the connect guard), a hard cap on how much is read, and a hard timeout. A page
/// that streams forever, or a redirect chain that never ends, costs us a few seconds and a few hundred KB — never a hung worker.
/// </summary>
public sealed class SafeFetcher(IHttpClientFactory factory, IConfiguration configuration)
{
    public const string ClientName = "seo-crawler";
    public const string UserAgent = "VroduxSEOBot/1.0 (+https://vrodux.com/seo-bot)";
    private const int MaxRedirects = 6;

    public bool AllowPrivate => SeoNetwork.AllowPrivate(configuration);

    public async Task<FetchResult> FetchAsync(string url, CancellationToken ct, int maxBytes = 2_000_000, bool head = false, TimeSpan? timeout = null)
    {
        var sw = Stopwatch.StartNew();
        var hops = new List<Hop>();
        var current = url;
        string? contentType = null, xRobots = null;

        for (var i = 0; i <= MaxRedirects; i++)
        {
            if (!TryValidate(current, out var uri, out var why))
                return new FetchResult(url, current, 0, hops, null, null, null, 0, sw.ElapsedMilliseconds, why, false, false);

            try
            {
                using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
                cts.CancelAfter(timeout ?? TimeSpan.FromSeconds(15));
                using var req = new HttpRequestMessage(head ? HttpMethod.Head : HttpMethod.Get, uri);
                req.Headers.TryAddWithoutValidation("User-Agent", UserAgent);
                req.Headers.TryAddWithoutValidation("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.5");
                req.Headers.TryAddWithoutValidation("Accept-Language", "en");

                using var res = await factory.CreateClient(ClientName).SendAsync(req, HttpCompletionOption.ResponseHeadersRead, cts.Token);
                var status = (int)res.StatusCode;
                hops.Add(new Hop(current, status));

                if (status is 301 or 302 or 303 or 307 or 308 && res.Headers.Location is { } loc)
                {
                    var next = loc.IsAbsoluteUri ? loc : new Uri(uri, loc);
                    current = next.GetLeftPart(UriPartial.Query);
                    if (hops.Any(h => h.Url == current)) return new FetchResult(url, current, status, hops, null, null, null, 0, sw.ElapsedMilliseconds, "Redirect loop.", false, true);
                    continue;
                }

                contentType = res.Content.Headers.ContentType?.MediaType;
                xRobots = res.Headers.TryGetValues("X-Robots-Tag", out var xr) ? string.Join(", ", xr) : null;
                if (head) return new FetchResult(url, current, status, hops, contentType, xRobots, null, 0, sw.ElapsedMilliseconds, null, false, false);

                var (body, bytes, truncated) = await ReadCappedAsync(res, contentType, maxBytes, cts.Token);
                return new FetchResult(url, current, status, hops, contentType, xRobots, body, bytes, sw.ElapsedMilliseconds, null, truncated, false);
            }
            catch (OperationCanceledException) when (!ct.IsCancellationRequested)
            {
                return new FetchResult(url, current, 0, hops, null, null, null, 0, sw.ElapsedMilliseconds, "The page took too long to respond.", false, false);
            }
            catch (HttpRequestException ex)
            {
                return new FetchResult(url, current, 0, hops, null, null, null, 0, sw.ElapsedMilliseconds, Friendly(ex), false, false);
            }
        }
        return new FetchResult(url, current, 0, hops, null, null, null, 0, sw.ElapsedMilliseconds, "Too many redirects.", false, true);
    }

    private static string Friendly(HttpRequestException ex) =>
        ex.InnerException?.Message is { Length: > 0 } inner && ex.Message.Contains("error occurred while sending", StringComparison.OrdinalIgnoreCase) ? inner : ex.Message;

    private bool TryValidate(string url, out Uri uri, out string? why)
    {
        why = null;
        if (!Uri.TryCreate(url, UriKind.Absolute, out uri!) || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
        { why = "Only http and https addresses can be checked."; return false; }
        if (!string.IsNullOrEmpty(uri.UserInfo)) { why = "Addresses with a user name or password are not allowed."; return false; }
        // Real sites live on the standard ports. Allowing any port would turn this into a scanner of our own internal services.
        if (!AllowPrivate && !(uri.Port is 80 or 443)) { why = "Only the standard web ports (80 and 443) can be checked."; return false; }
        if (!SsrfGuard.IsPlausiblePublicHost(uri.Host, AllowPrivate)) { why = "That does not look like a public website address."; return false; }
        return true;
    }

    private static async Task<(string? Body, int Bytes, bool Truncated)> ReadCappedAsync(HttpResponseMessage res, string? contentType, int maxBytes, CancellationToken ct)
    {
        // Pictures, video, downloads: never read. Only the text a crawler can use.
        var textual = contentType is null || contentType.StartsWith("text/", StringComparison.OrdinalIgnoreCase)
            || contentType.Contains("xml", StringComparison.OrdinalIgnoreCase) || contentType.Contains("json", StringComparison.OrdinalIgnoreCase)
            || contentType.Contains("html", StringComparison.OrdinalIgnoreCase);
        if (!textual) return (null, (int)(res.Content.Headers.ContentLength ?? 0), false);

        await using var stream = await res.Content.ReadAsStreamAsync(ct);
        var buffer = new byte[16 * 1024];
        using var ms = new MemoryStream();
        int read;
        var truncated = false;
        while ((read = await stream.ReadAsync(buffer, ct)) > 0)
        {
            if (ms.Length + read > maxBytes) { ms.Write(buffer, 0, (int)(maxBytes - ms.Length)); truncated = true; break; }
            ms.Write(buffer, 0, read);
        }
        var charset = res.Content.Headers.ContentType?.CharSet;
        Encoding enc;
        try { enc = charset is null ? Encoding.UTF8 : Encoding.GetEncoding(charset.Trim('"')); } catch { enc = Encoding.UTF8; }
        return (enc.GetString(ms.GetBuffer(), 0, (int)ms.Length), (int)ms.Length, truncated);
    }
}

public static class SeoNetwork
{
    /// <summary>
    /// Private addresses are refused unless this is a development machine that says so explicitly. A production host cannot be switched
    /// to "allow private" by configuration: the setting is ignored unless the environment is literally Development.
    /// </summary>
    public static bool AllowPrivate(IConfiguration configuration) =>
        string.Equals(configuration["ASPNETCORE_ENVIRONMENT"], "Development", StringComparison.OrdinalIgnoreCase)
        && configuration.GetValue<bool>("Seo:AllowPrivateAddresses");
}
