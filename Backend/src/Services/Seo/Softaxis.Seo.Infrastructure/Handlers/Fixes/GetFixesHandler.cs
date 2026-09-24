using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Seo.Application.Fixes.Dtos;
using Softaxis.Seo.Application.Fixes.Queries;
using Softaxis.Seo.Infrastructure.Persistence;

namespace Softaxis.Seo.Infrastructure.Handlers.Fixes;

internal sealed class GetFixesHandler(SeoDbContext db) : IQueryHandler<GetFixesQuery, IReadOnlyList<FixDto>>
{
    public async Task<Result<IReadOnlyList<FixDto>>> Handle(GetFixesQuery query, CancellationToken ct)
    {
        var q =
            from f in db.Fixes.AsNoTracking()
            join i in db.Issues.AsNoTracking() on f.IssueId equals i.Id
            where f.SiteId == query.SiteId
            select new { f, i };

        if (!string.IsNullOrWhiteSpace(query.Status)) q = q.Where(x => x.f.Status == query.Status);

        var rows = await q.OrderByDescending(x => x.f.CreatedAt).ToListAsync(ct);
        var dtos = rows.Select(x => new FixDto(
            x.f.Id, x.f.IssueId, x.f.SiteId, x.f.PageUrl, x.f.ChangeType, x.f.ProposedValueJson, x.f.Rationale,
            x.f.Status, x.f.ReviewedByName, x.f.ReviewedAt, x.f.AppliedAt, x.f.CreatedAt,
            x.i.Title, x.i.Severity, x.i.Category)).ToList();

        return Result.Success<IReadOnlyList<FixDto>>(dtos);
    }
}
