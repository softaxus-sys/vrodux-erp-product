using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Seo.Application.Snippet.Dtos;
using Softaxis.Seo.Application.Snippet.Queries;
using Softaxis.Seo.Infrastructure.Persistence;

namespace Softaxis.Seo.Infrastructure.Handlers.Snippet;

/// <summary>Anonymous. Only ever returns <c>Status == "applied"</c> fixes — nothing changes on a
/// tenant's site until a human approves it (see SeoFix's own remarks). An unknown snippet key
/// returns an empty ruleset rather than an error, so a misconfigured/stale snippet fails silently
/// on the tenant's own site instead of throwing a visible error to their visitors.</summary>
internal sealed class GetSnippetRulesHandler(SeoDbContext db) : IQueryHandler<GetSnippetRulesQuery, IReadOnlyList<SnippetRuleDto>>
{
    public async Task<Result<IReadOnlyList<SnippetRuleDto>>> Handle(GetSnippetRulesQuery query, CancellationToken ct)
    {
        var site = await db.Sites.AsNoTracking().FirstOrDefaultAsync(s => s.SnippetKey == query.SnippetKey, ct);
        if (site is null) return Result.Success<IReadOnlyList<SnippetRuleDto>>([]);

        var q = db.Fixes.AsNoTracking().Where(f => f.SiteId == site.Id && f.Status == "applied");
        if (!string.IsNullOrWhiteSpace(query.Path))
            q = q.Where(f => f.PageUrl == null || f.PageUrl.EndsWith(query.Path));

        var rules = await q.Select(f => new SnippetRuleDto(f.ChangeType, f.ProposedValueJson)).ToListAsync(ct);
        return Result.Success<IReadOnlyList<SnippetRuleDto>>(rules);
    }
}
