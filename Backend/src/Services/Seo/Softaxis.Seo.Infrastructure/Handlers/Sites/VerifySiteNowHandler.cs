using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Seo.Application.Sites.Commands;
using Softaxis.Seo.Application.Sites.Dtos;
using Softaxis.Seo.Infrastructure.Persistence;

namespace Softaxis.Seo.Infrastructure.Handlers.Sites;

/// <summary>Fetches the tenant's own homepage server-side and checks the snippet tag is present in
/// the raw HTML — see VerifySiteNowCommand's own remarks on why this, not waiting for a browser
/// ping, is the verification path that must always work regardless of the tenant's site config.</summary>
internal sealed class VerifySiteNowHandler(SeoDbContext db, IHttpClientFactory httpFactory, ILogger<VerifySiteNowHandler> logger)
    : ICommandHandler<VerifySiteNowCommand, SiteDto>
{
    public async Task<Result<SiteDto>> Handle(VerifySiteNowCommand cmd, CancellationToken ct)
    {
        var site = await db.Sites.FirstOrDefaultAsync(s => s.Id == cmd.Id, ct);
        if (site is null) return Result.Failure<SiteDto>(Error.NotFoundById("SeoSite", cmd.Id));

        if (site.VerificationStatus != "verified")
        {
            var found = await TagFoundOnPageAsync(site.Domain, site.SnippetKey, ct);
            if (found)
            {
                site.RecordVerifiedBySourceCheck();
                await db.SaveChangesAsync(ct);
            }
        }

        var connected = await db.GoogleIntegrations.AsNoTracking().AnyAsync(g => g.SiteId == site.Id && g.Status == "connected", ct);
        return Result.Success(SiteMappings.ToDto(site, connected));
    }

    private async Task<bool> TagFoundOnPageAsync(string domain, string snippetKey, CancellationToken ct)
    {
        var client = httpFactory.CreateClient("seo-crawler");
        try
        {
            var html = await client.GetStringAsync($"https://{domain}", ct);
            // Matches either the literal snippet URL or just the key — a tenant may have copied the
            // tag with a different host (e.g. a CDN mirror) or edited it slightly; the key alone is
            // still the unambiguous proof of installation.
            return html.Contains(snippetKey, StringComparison.OrdinalIgnoreCase);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Server-side verification fetch failed for {Domain}.", domain);
            return false;
        }
    }
}
