using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Seo.Application.Abstractions;
using Softaxis.Seo.Application.Google.Dtos;
using Softaxis.Seo.Application.Google.Queries;
using Softaxis.Seo.Domain.Entities;
using Softaxis.Seo.Infrastructure.Google;
using Softaxis.Seo.Infrastructure.Persistence;

namespace Softaxis.Seo.Infrastructure.Handlers.Google;

internal sealed class GetGooglePropertiesHandler(SeoDbContext db, GoogleOAuthClient google, ISecretProtector protector)
    : IQueryHandler<GetGooglePropertiesQuery, GooglePropertiesResultDto>
{
    public async Task<Result<GooglePropertiesResultDto>> Handle(GetGooglePropertiesQuery query, CancellationToken ct)
    {
        var integration = await db.GoogleIntegrations.FirstOrDefaultAsync(g => g.SiteId == query.SiteId, ct);
        if (integration?.Credentials is null)
            return Result.Failure<GooglePropertiesResultDto>(Error.Custom("Seo.NotConnected", "Google is not connected for this site yet."));

        var creds = JsonSerializer.Deserialize<JsonElement>(protector.Unprotect(integration.Credentials)!);
        var accessToken = creds.GetProperty("accessToken").GetString()!;

        // Access tokens are short-lived (~1 hour); refresh proactively rather than failing the read.
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

        var gscTask = google.GetSearchConsolePropertiesAsync(accessToken, ct);
        var ga4Task = google.GetAnalyticsPropertiesAsync(accessToken, ct);
        await Task.WhenAll(gscTask, ga4Task);

        var gsc = gscTask.Result.Select(p => new GooglePropertyDto(p.SiteUrl, p.SiteUrl, SeoGoogleResourceTypes.GscProperty)).ToList();
        var ga4 = ga4Task.Result.Select(p => new GooglePropertyDto(p.PropertyId, p.DisplayName, SeoGoogleResourceTypes.Ga4Property)).ToList();

        return Result.Success(new GooglePropertiesResultDto(gsc, ga4));
    }
}
