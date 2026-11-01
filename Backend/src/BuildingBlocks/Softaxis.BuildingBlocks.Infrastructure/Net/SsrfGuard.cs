using System.Net;
using System.Net.Sockets;

namespace Softaxis.Seo.Infrastructure.Net;

/// <summary>
/// The server fetches addresses a customer typed (their own site, competitors, a WordPress URL). Without a guard, that is a
/// way to make OUR server read things only it can reach: the cloud metadata service (169.254.169.254), other containers on the
/// Docker network, localhost admin ports, the database. The check is on the address a name actually RESOLVES to, at the moment
/// of connecting — checking the text of the URL is not enough (a public name can point at 127.0.0.1, and can change between
/// the check and the connection).
/// </summary>
public static class SsrfGuard
{
    /// <summary>True for any address that must never be fetched on a customer's behalf.</summary>
    public static bool IsBlocked(IPAddress ip)
    {
        if (ip.IsIPv4MappedToIPv6) ip = ip.MapToIPv4();   // ::ffff:127.0.0.1 is still loopback
        if (IPAddress.IsLoopback(ip) || ip.Equals(IPAddress.Any) || ip.Equals(IPAddress.IPv6Any) || ip.Equals(IPAddress.None)) return true;

        if (ip.AddressFamily == AddressFamily.InterNetworkV6)
        {
            if (ip.IsIPv6LinkLocal || ip.IsIPv6SiteLocal || ip.IsIPv6Multicast || ip.IsIPv6Teredo) return true;
            var b6 = ip.GetAddressBytes();
            if ((b6[0] & 0xFE) == 0xFC) return true;                                   // fc00::/7 unique local
            if (b6[0] == 0x20 && b6[1] == 0x01 && b6[2] == 0x0D && b6[3] == 0xB8) return true;   // 2001:db8::/32 documentation
            // NAT64 / 6to4 wrappers around a private IPv4 are the same trick again
            if (b6[0] == 0x00 && b6[1] == 0x64 && b6[2] == 0xFF && b6[3] == 0x9B) return IsBlocked(new IPAddress(b6[12..16]));
            return false;
        }

        var b = ip.GetAddressBytes();
        return b[0] switch
        {
            0 => true,                                              // "this network"
            10 => true,                                             // private
            100 when b[1] is >= 64 and <= 127 => true,              // carrier-grade NAT
            127 => true,                                            // loopback
            169 when b[1] == 254 => true,                           // link-local, includes the cloud metadata address
            172 when b[1] is >= 16 and <= 31 => true,               // private
            192 when b[1] == 168 => true,                           // private
            192 when b[1] == 0 && b[2] is 0 or 2 => true,           // 192.0.0.0/24 + documentation
            198 when b[1] is 18 or 19 => true,                      // benchmarking
            198 when b[1] == 51 && b[2] == 100 => true,             // documentation
            203 when b[1] == 0 && b[2] == 113 => true,              // documentation
            >= 224 => true,                                         // multicast + reserved + broadcast
            _ => false,
        };
    }

    /// <summary>
    /// A connect step for <see cref="SocketsHttpHandler"/> that resolves the host itself and refuses the connection if ANY answer is
    /// internal (a mixed answer is a rebinding attempt, so it is not worth finding the one "good" address). Runs for every
    /// connection, including each redirect hop.
    /// </summary>
    public static Func<SocketsHttpConnectionContext, CancellationToken, ValueTask<Stream>> GuardedConnect(bool allowPrivate)
    {
        return async (context, ct) =>
        {
            var host = context.DnsEndPoint.Host;
            IPAddress[] addresses;
            if (IPAddress.TryParse(host, out var literal)) addresses = [literal];
            else
            {
                try { addresses = await Dns.GetHostAddressesAsync(host, ct); }
                catch (SocketException) { throw new HttpRequestException($"The address {host} could not be found."); }
            }

            if (addresses.Length == 0) throw new HttpRequestException($"The address {host} could not be found.");
            if (!allowPrivate && addresses.Any(IsBlocked))
                throw new HttpRequestException("That address points to a private or internal network, so it cannot be fetched.");

            var socket = new Socket(SocketType.Stream, ProtocolType.Tcp) { NoDelay = true };
            try
            {
                await socket.ConnectAsync(addresses, context.DnsEndPoint.Port, ct);
                return new NetworkStream(socket, ownsSocket: true);
            }
            catch { socket.Dispose(); throw; }
        };
    }

    /// <summary>The one handler every outbound customer-address client uses.</summary>
    public static SocketsHttpHandler CreateHandler(bool allowPrivate) => new()
    {
        AllowAutoRedirect = false,                  // redirects are followed by hand, a few hops, each re-checked
        UseCookies = false,
        AutomaticDecompression = DecompressionMethods.All,
        ConnectTimeout = TimeSpan.FromSeconds(8),
        PooledConnectionLifetime = TimeSpan.FromMinutes(2),   // short, so a name that changes address is looked up again
        ConnectCallback = GuardedConnect(allowPrivate),
    };

    /// <summary>
    /// Whether a typed value could be a public website's host name at all: letters, digits, hyphens and dots, at least one dot, no
    /// port, path or credentials, and not an address literal. A first filter — <see cref="GuardedConnect"/> is the real protection.
    /// </summary>
    public static bool IsPlausiblePublicHost(string host, bool allowPrivate = false)
    {
        if (string.IsNullOrWhiteSpace(host) || host.Length > 253) return false;
        if (IPAddress.TryParse(host, out _)) return allowPrivate;
        if (host.Equals("localhost", StringComparison.OrdinalIgnoreCase) || host.EndsWith(".localhost", StringComparison.OrdinalIgnoreCase)
            || host.EndsWith(".local", StringComparison.OrdinalIgnoreCase) || host.EndsWith(".internal", StringComparison.OrdinalIgnoreCase))
            return allowPrivate;
        if (!host.Contains('.') && !allowPrivate) return false;
        foreach (var ch in host) if (!(char.IsAsciiLetterOrDigit(ch) || ch is '-' or '.')) return false;
        return !host.StartsWith('.') && !host.EndsWith('.') && !host.Contains("..");
    }
}
