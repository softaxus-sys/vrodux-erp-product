using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Seo.Application.Sites.Commands;
using Softaxis.Seo.Application.Sites.Dtos;
using Softaxis.Seo.Infrastructure.Persistence;

namespace Softaxis.Seo.Infrastructure.Handlers.Sites;

internal sealed class UpdateSiteHandler(SeoDbContext db) : ICommandHandler<UpdateSiteCommand, SiteDto>
{
    public async Task<Result<SiteDto>> Handle(UpdateSiteCommand cmd, CancellationToken ct)
    {
        var site = await db.Sites.FirstOrDefaultAsync(s => s.Id == cmd.Id, ct);
        if (site is null) return Result.Failure<SiteDto>(Error.NotFoundById("SeoSite", cmd.Id));

        site.Rename(cmd.DisplayName);
        site.SetScanFrequency(cmd.ScanFrequency);
        await db.SaveChangesAsync(ct);

        var connected = await db.GoogleIntegrations.AsNoTracking().AnyAsync(g => g.SiteId == site.Id && g.Status == "connected", ct);
        return Result.Success(SiteMappings.ToDto(site, connected));
    }
}
