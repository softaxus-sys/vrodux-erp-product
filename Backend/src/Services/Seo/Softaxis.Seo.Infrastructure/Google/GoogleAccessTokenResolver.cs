using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Softaxis.Seo.Application.Abstractions;
using Softaxis.Seo.Infrastructure.Persistence;

namespace Softaxis.Seo.Infrastructure.Google;

/// <summary>
/// Decrypt-and-refresh-if-needed for a site's stored Google credentials — extracted out of
/// GetGooglePropertiesHandler (which had this inline first) so ContentResearch can reuse the exact
/// same refresh logic rather than a second, potentially-drifting copy.
/// </summary>
public sealed class GoogleAccessTokenResolver(GoogleOAuthClient google, ISecretProtector protector)
{
    /// <summary>Null when the site has no Google connection at all.</summary>
    public async Task<string?> ResolveAsync(SeoDbContext db, Guid siteId, CancellationToken ct)
    {
        var integration = await db.GoogleIntegrations.FirstOrDefaultAsync(g => g.SiteId == siteId, ct);
        if (integration?.Credentials is null) return null;

        var creds = JsonSerializer.Deserialize<JsonElement>(protector.Unprotect(integration.Credentials)!);
        var accessToken = creds.GetProperty("accessToken").GetString()!;

        var expiresAt = creds.GetProperty("expiresAt").GetDateTime();
        if (expiresAt < DateTime.UtcNow.AddMinutes(2)
            && creds.TryGetProperty("refreshToken", out var rt) && rt.GetString() is { Length: > 0 } refreshToken)
        {
            var refreshed = await google.RefreshAccessTokenAsync(refreshToken, ct);
            accessToken = refreshed.AccessToken;
            integration.SetCredentials(protector.Protect(JsonSerializer.Serialize(new
            {
                accessToken  = refreshed.AccessToken,
                refreshToken = refreshed.RefreshToken ?? refreshToken,
                expiresAt    = refreshed.ExpiresAt,
            }))!);
            await db.SaveChangesAsync(ct);
        }

        return accessToken;
    }
}
