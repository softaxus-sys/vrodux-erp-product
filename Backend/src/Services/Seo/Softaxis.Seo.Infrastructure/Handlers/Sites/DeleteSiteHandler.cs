using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Seo.Application.Sites.Commands;
using Softaxis.Seo.Infrastructure.Persistence;

namespace Softaxis.Seo.Infrastructure.Handlers.Sites;

internal sealed class DeleteSiteHandler(SeoDbContext db) : ICommandHandler<DeleteSiteCommand>
{
    public async Task<Result> Handle(DeleteSiteCommand cmd, CancellationToken ct)
    {
        var site = await db.Sites.FirstOrDefaultAsync(s => s.Id == cmd.Id, ct);
        if (site is null) return Result.Failure(Error.NotFoundById("SeoSite", cmd.Id));

        site.Delete();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
