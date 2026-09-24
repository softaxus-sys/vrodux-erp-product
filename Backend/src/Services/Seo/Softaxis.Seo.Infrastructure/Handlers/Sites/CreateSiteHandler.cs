using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Seo.Application.Sites.Commands;
using Softaxis.Seo.Application.Sites.Dtos;
using Softaxis.Seo.Domain.Entities;
using Softaxis.Seo.Infrastructure.Persistence;

namespace Softaxis.Seo.Infrastructure.Handlers.Sites;

internal sealed class CreateSiteHandler(SeoDbContext db) : ICommandHandler<CreateSiteCommand, SiteDto>
{
    public async Task<Result<SiteDto>> Handle(CreateSiteCommand cmd, CancellationToken ct)
    {
        var site = new SeoSite(cmd.Domain, cmd.DisplayName, cmd.ScanFrequency ?? ScanFrequencies.Weekly);
        db.Sites.Add(site);
        await db.SaveChangesAsync(ct);
        return Result.Success(SiteMappings.ToDto(site, googleConnected: false));
    }
}
