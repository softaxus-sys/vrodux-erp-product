using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Seo.Application.Snippet.Commands;
using Softaxis.Seo.Infrastructure.Persistence;

namespace Softaxis.Seo.Infrastructure.Handlers.Snippet;

/// <summary>Anonymous — the embedded snippet calls this on every page load. Possession of the opaque
/// SnippetKey is the ownership proof (see SeoSite's own remarks); the global tenant filter bypasses
/// automatically for this unresolved/anonymous request, same as CRM's inbound webhook lookups.</summary>
internal sealed class PingSnippetHandler(SeoDbContext db) : ICommandHandler<PingSnippetCommand>
{
    public async Task<Result> Handle(PingSnippetCommand cmd, CancellationToken ct)
    {
        var site = await db.Sites.FirstOrDefaultAsync(s => s.SnippetKey == cmd.SnippetKey, ct);
        if (site is null) return Result.Failure(Error.Custom("Seo.UnknownSnippet", "Unknown snippet key."));

        site.RecordPing();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
