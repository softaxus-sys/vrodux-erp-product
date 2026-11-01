using System.Net;

namespace Softaxis.BuildingBlocks.Infrastructure.Net;

/// <param name="Error">Set when nothing usable came back; says why, in words a person can act on.</param>
public sealed record DownloadedImage(byte[]? Bytes, string? ContentType, string? FileName, string? Error)
{
    public bool Ok => Error is null && Bytes is { Length: > 0 };
}

/// <summary>
/// Downloads a picture from an address a customer typed (a column in an import file). The same rules as every other
/// fetch of a customer address: public hosts only (checked on the address the name resolves to, at connect time, by
/// <see cref="SsrfGuard"/>), standard web ports, redirects followed by hand, a hard timeout, and a hard cap on size.
///
/// <para>The picture type is decided from the file's own first bytes, never from the server's say-so, and SVG is refused
/// (it can carry script). Only JPEG, PNG, GIF and WebP are accepted.</para>
/// </summary>
public sealed class SafeImageDownloader(IHttpClientFactory factory)
{
    public const string ClientName = "safe-image";
    public const int MaxBytes = 8 * 1024 * 1024;
    private const int MaxRedirects = 5;

    public async Task<DownloadedImage> DownloadAsync(string url, bool allowPrivate, CancellationToken ct)
    {
        var current = url.Trim();
        var seen = new HashSet<string>();

        for (var hop = 0; hop <= MaxRedirects; hop++)
        {
            if (!Uri.TryCreate(current, UriKind.Absolute, out var uri) || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
                return Fail("That is not a web address (it must start with http:// or https://).");
            if (!string.IsNullOrEmpty(uri.UserInfo)) return Fail("Addresses with a user name or password are not allowed.");
            if (!allowPrivate && uri.Port is not (80 or 443)) return Fail("Only the standard web ports (80 and 443) are allowed.");
            if (!SsrfGuard.IsPlausiblePublicHost(uri.Host, allowPrivate)) return Fail("That does not look like a public website address.");
            if (!seen.Add(current)) return Fail("The address redirects in a circle.");

            try
            {
                using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
                cts.CancelAfter(TimeSpan.FromSeconds(25));
                using var req = new HttpRequestMessage(HttpMethod.Get, uri);
                req.Headers.TryAddWithoutValidation("User-Agent", "VroduxImageImport/1.0");
                req.Headers.TryAddWithoutValidation("Accept", "image/jpeg,image/png,image/webp,image/gif,*/*;q=0.5");

                using var res = await factory.CreateClient(ClientName).SendAsync(req, HttpCompletionOption.ResponseHeadersRead, cts.Token);
                var status = (int)res.StatusCode;

                if (status is 301 or 302 or 303 or 307 or 308 && res.Headers.Location is { } loc)
                {
                    current = (loc.IsAbsoluteUri ? loc : new Uri(uri, loc)).ToString();
                    continue;
                }
                if (status == 404 || status == 410) return Fail("The picture was not found at that address (404).");
                if (status is 401 or 403) return Fail("The site refused to give the picture (it may need a login).");
                if (status is < 200 or >= 300) return Fail($"The site answered with an error ({status}).");

                if (res.Content.Headers.ContentLength is > MaxBytes)
                    return Fail($"The picture is larger than {MaxBytes / 1024 / 1024} MB.");

                await using var stream = await res.Content.ReadAsStreamAsync(cts.Token);
                using var ms = new MemoryStream();
                var buffer = new byte[32 * 1024];
                int read;
                while ((read = await stream.ReadAsync(buffer, cts.Token)) > 0)
                {
                    if (ms.Length + read > MaxBytes) return Fail($"The picture is larger than {MaxBytes / 1024 / 1024} MB.");
                    ms.Write(buffer, 0, read);
                }

                var bytes = ms.ToArray();
                var type = Sniff(bytes);
                if (type is null) return Fail("That address does not point to a JPEG, PNG, GIF or WebP picture.");
                return new DownloadedImage(bytes, type, FileNameFrom(uri, type), null);
            }
            catch (OperationCanceledException) when (!ct.IsCancellationRequested)
            {
                return Fail("The site took too long to respond.");
            }
            catch (HttpRequestException ex)
            {
                return Fail(ex.InnerException?.Message is { Length: > 0 } inner && ex.Message.Contains("error occurred while sending", StringComparison.OrdinalIgnoreCase)
                    ? inner : ex.Message);
            }
        }
        return Fail("Too many redirects.");
    }

    /// <summary>The real type from the first bytes, or null when it is not a picture we accept.</summary>
    public static string? Sniff(byte[] b)
    {
        if (b.Length < 12) return null;
        if (b[0] == 0xFF && b[1] == 0xD8 && b[2] == 0xFF) return "image/jpeg";
        if (b[0] == 0x89 && b[1] == 0x50 && b[2] == 0x4E && b[3] == 0x47) return "image/png";
        if (b[0] == 0x47 && b[1] == 0x49 && b[2] == 0x46 && b[3] == 0x38) return "image/gif";
        if (b[0] == 0x52 && b[1] == 0x49 && b[2] == 0x46 && b[3] == 0x46 && b[8] == 0x57 && b[9] == 0x45 && b[10] == 0x42 && b[11] == 0x50) return "image/webp";
        return null;
    }

    private static string? FileNameFrom(Uri uri, string contentType)
    {
        var name = Path.GetFileName(uri.AbsolutePath);
        if (string.IsNullOrWhiteSpace(name) || name.Length > 120) return null;
        var ext = contentType switch { "image/jpeg" => ".jpg", "image/png" => ".png", "image/gif" => ".gif", _ => ".webp" };
        return Path.HasExtension(name) ? name : name + ext;
    }

    private static DownloadedImage Fail(string why) => new(null, null, null, why);
}
