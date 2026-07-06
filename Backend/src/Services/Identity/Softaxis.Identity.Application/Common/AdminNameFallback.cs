namespace Softaxis.Identity.Application.Common;

/// <summary>
/// Derives a sensible first/last name for a tenant's admin user. Prefers the explicitly-provided
/// name; when that's blank, derives a human name from the email local-part (e.g.
/// <c>john.smith@acme.com</c> → <c>("John", "Smith")</c>) instead of the old <c>"Tenant"/"Admin"</c>
/// placeholder, so the UI never shows "Tenant Admin".
/// </summary>
public static class AdminNameFallback
{
    public static (string First, string Last) Resolve(string? firstName, string? lastName, string email)
    {
        var first = firstName?.Trim();
        var last  = lastName?.Trim();
        if (!string.IsNullOrEmpty(first))
            return (first, last ?? string.Empty);

        var local = (email ?? string.Empty).Split('@')[0];
        var tokens = local.Split(['.', '_', '-', '+'], StringSplitOptions.RemoveEmptyEntries)
                          .Select(Capitalize)
                          .ToArray();

        return tokens.Length switch
        {
            0 => ("Admin", string.Empty),
            1 => (tokens[0], string.Empty),
            _ => (tokens[0], string.Join(' ', tokens[1..])),
        };
    }

    private static string Capitalize(string s) =>
        s.Length switch
        {
            0 => s,
            1 => char.ToUpperInvariant(s[0]).ToString(),
            _ => char.ToUpperInvariant(s[0]) + s[1..],
        };
}
