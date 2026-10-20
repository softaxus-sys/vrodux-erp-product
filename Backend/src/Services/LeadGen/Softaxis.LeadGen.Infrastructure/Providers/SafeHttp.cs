using System.Net;
using System.Net.Sockets;

namespace Softaxis.LeadGen.Infrastructure.Providers;

/// <summary>
/// An HTTP handler that will only ever connect to the public internet.
///
/// The enricher fetches whatever URL a business listed as its website, so without this a hostile
/// listing (or a redirect) could point the server at <c>http://169.254.169.254/</c> (cloud metadata),
/// <c>http://localhost:5000/</c> or a database port on the internal network — classic server-side
/// request forgery. The check runs on the address the connection is actually made to, after DNS, and
/// again on every redirect hop, so neither a DNS trick nor a redirect gets round it.
/// </summary>
public static class SafeHttp
{
    public static SocketsHttpHandler CreateHandler() => new()
    {
        AllowAutoRedirect = true,
        MaxAutomaticRedirections = 4,
        AutomaticDecompression = DecompressionMethods.All,
        ConnectTimeout = TimeSpan.FromSeconds(5),
        PooledConnectionLifetime = TimeSpan.FromMinutes(5),
        ConnectCallback = async (context, ct) =>
        {
            var addresses = await Dns.GetHostAddressesAsync(context.DnsEndPoint.Host, ct);
            var safe = addresses.Where(IsPublic).ToArray();
            if (safe.Length == 0) throw new HttpRequestException("Blocked: the address is not on the public internet.");

            var socket = new Socket(SocketType.Stream, ProtocolType.Tcp) { NoDelay = true };
            try
            {
                await socket.ConnectAsync(safe, context.DnsEndPoint.Port, ct);
                return new NetworkStream(socket, ownsSocket: true);
            }
            catch { socket.Dispose(); throw; }
        },
    };

    public static bool IsPublic(IPAddress ip)
    {
        if (ip.IsIPv4MappedToIPv6) ip = ip.MapToIPv4();
        if (IPAddress.IsLoopback(ip) || ip.Equals(IPAddress.Any) || ip.Equals(IPAddress.IPv6Any) || ip.Equals(IPAddress.None)) return false;

        if (ip.AddressFamily == AddressFamily.InterNetworkV6)
        {
            if (ip.IsIPv6LinkLocal || ip.IsIPv6SiteLocal || ip.IsIPv6Multicast || ip.IsIPv6UniqueLocal) return false;
            return true;
        }

        var b = ip.GetAddressBytes();
        return !(b[0] == 10
              || b[0] == 0
              || (b[0] == 172 && b[1] is >= 16 and <= 31)
              || (b[0] == 192 && b[1] == 168)
              || (b[0] == 169 && b[1] == 254)                // link-local, incl. cloud metadata
              || (b[0] == 100 && b[1] is >= 64 and <= 127)    // carrier-grade NAT
              || (b[0] == 192 && b[1] == 0 && b[2] == 0)
              || (b[0] == 198 && b[1] is 18 or 19)
              || b[0] >= 224);                                // multicast and reserved
    }

    /// <summary>Normalises a listed website into an absolute http(s) URL, or null when it is not one.</summary>
    public static Uri? ParseWebsite(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var s = raw.Trim();
        if (!s.Contains("://")) s = "https://" + s;
        if (!Uri.TryCreate(s, UriKind.Absolute, out var uri)) return null;
        if (uri.Scheme is not ("http" or "https")) return null;
        if (string.IsNullOrWhiteSpace(uri.Host) || !uri.Host.Contains('.')) return null;
        if (!string.IsNullOrEmpty(uri.UserInfo)) return null;
        return uri;
    }

    /// <summary>"www.acme.ae" and "ACME.ae" are the same business site.</summary>
    public static string Domain(Uri uri)
    {
        var host = uri.Host.ToLowerInvariant();
        return host.StartsWith("www.", StringComparison.Ordinal) ? host[4..] : host;
    }
}
