using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Seo.Application.Abstractions;
using Softaxis.Seo.Application.Google.Commands;
using Softaxis.Seo.Application.Google.Dtos;
using Softaxis.Seo.Domain.Entities;
using Softaxis.Seo.Infrastructure.Google;
using Softaxis.Seo.Infrastructure.Persistence;

namespace Softaxis.Seo.Infrastructure.Handlers.Google;

internal sealed class StartGoogleOAuthHandler(SeoDbContext db, GoogleOAuthClient google, ISecretProtector protector)
    : ICommandHandler<StartGoogleOAuthCommand, GoogleOAuthUrlDto>
{
    public async Task<Result<GoogleOAuthUrlDto>> Handle(StartGoogleOAuthCommand cmd, CancellationToken ct)
    {
        var site = await db.Sites.FirstOrDefaultAsync(s => s.Id == cmd.SiteId, ct);
        if (site is null) return Result.Failure<GoogleOAuthUrlDto>(Error.NotFoundById("SeoSite", cmd.SiteId));

        // Created here, in an authenticated context, so it is tenant-stamped automatically — the
        // anonymous callback only ever UPDATES this row (new rows in an anonymous context would need
        // manual tenant stamping; see GoogleOAuthCallbackHandler's remarks).
        var integration = await db.GoogleIntegrations.FirstOrDefaultAsync(g => g.SiteId == site.Id, ct);
        if (integration is null)
        {
            integration = new SeoGoogleIntegration(site.Id);
            db.GoogleIntegrations.Add(integration);
            await db.SaveChangesAsync(ct);
        }

        var state = Uri.EscapeDataString(protector.Protect(integration.Id.ToString())!);
        return Result.Success(new GoogleOAuthUrlDto(google.BuildLoginUrl(cmd.RedirectUri, state)));
    }
}
