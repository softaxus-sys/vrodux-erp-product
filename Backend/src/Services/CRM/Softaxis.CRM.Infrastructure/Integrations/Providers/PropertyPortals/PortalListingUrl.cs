using System.Text.RegularExpressions;

namespace Softaxis.CRM.Infrastructure.Integrations.Providers.PropertyPortals;

/// <summary>
/// Pulls the portal's numeric listing id out of a listing URL.
///
/// <para>Bayut writes the same listing three ways, and a WhatsApp push carries two of them at once:
/// <c>listing.url</c> is <c>/pm/15943235/&lt;uuid&gt;</c> while the message body quotes
/// <c>/property/details-15943235.html</c>. The <c>reference</c> ("100104-uDkDxP") is an account-level
/// code, so it is NOT interchangeable with the id — matching on the reference alone misses any
/// listing whose pull record only carried <c>listing_id</c>.</para>
///
/// <para>Extracting the id gives a second, stable key for the listing → agent map, which is what
/// lets a push enquiry (no agent in the payload at all) be routed to the agent learned from an
/// earlier pull enquiry on the same property.</para>
/// </summary>
internal static partial class PortalListingUrl
{
    // details-15943235.html  ·  /pm/15943235/<uuid>  ·  /property/15943235  ·  ?listing_id=15943235
    [GeneratedRegex(@"(?:details-|/pm/|/property/|listing[_-]?id=)(\d{4,12})", RegexOptions.IgnoreCase)]
    private static partial Regex IdPattern();

    // Property Finder puts the id at the end of a slug instead: …/villa-for-sale-dubai-12345678.html.
    // Kept as a separate, tighter pattern (6+ digits immediately before .html) rather than widening
    // the one above — a Bayut slug containing "-2024.html" would otherwise read as a listing id.
    [GeneratedRegex(@"-(\d{6,12})\.html\b", RegexOptions.IgnoreCase)]
    private static partial Regex SlugIdPattern();

    [GeneratedRegex(@"https?://[^\s""'<>]+", RegexOptions.IgnoreCase)]
    private static partial Regex UrlPattern();

    /// <summary>The listing id in <paramref name="text"/>, or null. Safe on a whole message body.</summary>
    public static string? ExtractId(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return null;
        var m = IdPattern().Match(text);
        if (m.Success) return m.Groups[1].Value;
        var slug = SlugIdPattern().Match(text);
        return slug.Success ? slug.Groups[1].Value : null;
    }

    /// <summary>
    /// The first portal listing URL in <paramref name="text"/>. Restricted to the portal's own hosts:
    /// an enquirer can paste any link into their message, and following an arbitrary one back as
    /// "the property" would attribute the lead to something we never listed.
    /// </summary>
    public static string? ExtractUrl(string? text, params string[] hosts)
    {
        if (string.IsNullOrWhiteSpace(text)) return null;
        foreach (Match m in UrlPattern().Matches(text))
        {
            var url = m.Value.TrimEnd('.', ',', ')', ']');
            if (hosts.Length == 0) return url;
            if (!Uri.TryCreate(url, UriKind.Absolute, out var uri)) continue;
            foreach (var h in hosts)
                if (uri.Host.EndsWith(h, StringComparison.OrdinalIgnoreCase)) return url;
        }
        return null;
    }
}
