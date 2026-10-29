using Microsoft.Extensions.Configuration;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Seo.Application.Sites.Commands;
using Softaxis.Seo.Application.Sites.Dtos;
using Softaxis.Seo.Domain.Entities;
using Softaxis.Seo.Infrastructure.Net;
using Softaxis.Seo.Infrastructure.Persistence;

namespace Softaxis.Seo.Infrastructure.Handlers.Sites;

internal sealed class CreateSiteHandler(SeoDbContext db, IConfiguration configuration) : ICommandHandler<CreateSiteCommand, SiteDto>
{
    public async Task<Result<SiteDto>> Handle(CreateSiteCommand cmd, CancellationToken ct)
    {
        var site = new SeoSite(cmd.Domain, cmd.DisplayName, cmd.ScanFrequency ?? ScanFrequencies.Weekly);

        // The server will fetch this address for every audit, so it must be a real public website — not an IP address, an internal
        // name or "localhost". (The crawler refuses those again at connect time; this just says so up front.)
        var allowPrivate = SeoNetwork.AllowPrivate(configuration);
        var host = site.Domain.Split('/')[0];
        if (host.Contains(':') && !allowPrivate || !SsrfGuard.IsPlausiblePublicHost(host.Split(':')[0], allowPrivate))
            return Result.Failure<SiteDto>(Error.Custom("Validation.Failed", "That does not look like a public website address. Enter a domain such as example.com."));

        db.Sites.Add(site);
        await db.SaveChangesAsync(ct);
        return Result.Success(SiteMappings.ToDto(site, googleConnected: false));
    }
}
