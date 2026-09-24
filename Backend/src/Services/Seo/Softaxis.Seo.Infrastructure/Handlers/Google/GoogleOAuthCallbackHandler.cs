using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Seo.Application.Abstractions;
using Softaxis.Seo.Application.Google.Commands;
using Softaxis.Seo.Application.Google.Dtos;
using Softaxis.Seo.Infrastructure.Google;
using Softaxis.Seo.Infrastructure.Persistence;

namespace Softaxis.Seo.Infrastructure.Handlers.Google;

/// <summary>
/// Anonymous OAuth callback (Google redirects the browser, no JWT). Resolves the integration from
/// the encrypted state — the global tenant filter bypasses automatically for an unresolved/anonymous
/// request (see <c>ITenantAmbientContext.BypassTenantFilter</c>), so no explicit
/// <c>IgnoreQueryFilters</c> is needed here; only NEW rows created in an anonymous context need
/// manual tenant stamping, and this handler only updates a row <c>StartGoogleOAuthHandler</c> already
/// created (and tenant-stamped) in an authenticated request.
/// </summary>
internal sealed class GoogleOAuthCallbackHandler(SeoDbContext db, GoogleOAuthClient google, ISecretProtector protector)
    : ICommandHandler<GoogleOAuthCallbackCommand, GoogleCallbackResultDto>
{
    public async Task<Result<GoogleCallbackResultDto>> Handle(GoogleOAuthCallbackCommand cmd, CancellationToken ct)
    {
        if (!Guid.TryParse(protector.Unprotect(cmd.State), out var integrationId))
            return Result.Failure<GoogleCallbackResultDto>(Error.Custom("Seo.InvalidState", "Invalid OAuth state."));

        var integration = await db.GoogleIntegrations.FirstOrDefaultAsync(g => g.Id == integrationId, ct);
        if (integration is null)
            return Result.Failure<GoogleCallbackResultDto>(Error.NotFoundById("SeoGoogleIntegration", integrationId));

        try
        {
            var tokens = await google.ExchangeCodeAsync(cmd.Code, cmd.RedirectUri, ct);
            integration.SetCredentials(protector.Protect(JsonSerializer.Serialize(new
            {
                accessToken  = tokens.AccessToken,
                refreshToken = tokens.RefreshToken,
                expiresAt    = tokens.ExpiresAt,
            }))!);
            await db.SaveChangesAsync(ct);
            return Result.Success(new GoogleCallbackResultDto(integration.SiteId));
        }
        catch (Exception ex)
        {
            integration.RecordError(ex.Message);
            await db.SaveChangesAsync(ct);
            return Result.Failure<GoogleCallbackResultDto>(Error.Custom("Seo.OAuthFailed", "Could not complete the Google connection."));
        }
    }
}
