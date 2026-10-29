using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Seo.Application.Audits.Dtos;
using Softaxis.Seo.Application.Audits.Queries;
using Softaxis.Seo.Infrastructure.Persistence;

namespace Softaxis.Seo.Infrastructure.Handlers.Audits;

internal sealed class GetIssuesHandler(SeoDbContext db) : IQueryHandler<GetIssuesQuery, IReadOnlyList<IssueDto>>
{
    public async Task<Result<IReadOnlyList<IssueDto>>> Handle(GetIssuesQuery query, CancellationToken ct)
    {
        var q = db.Issues.AsNoTracking().Where(i => i.SiteId == query.SiteId);
        if (string.IsNullOrWhiteSpace(query.Status)) q = q.Where(i => i.Status != "resolved" && i.Status != "dismissed");   // what still needs attention
        else if (!query.Status.Equals("all", StringComparison.OrdinalIgnoreCase)) q = q.Where(i => i.Status == query.Status);

        var rows = await q.OrderByDescending(i => i.LastSeenAt).Take(3000)
            .Select(i => new IssueDto(i.Id, i.SiteId, i.AuditId, i.Source, i.Category, i.Severity, i.Title, i.Description, i.PageUrl, i.Status, i.DetectedAt,
                i.Code, i.AffectedCount, i.DetailsJson, i.FirstSeenAt, i.LastSeenAt, i.ResolvedAt))
            .ToListAsync(ct);

        static int Rank(string s) => s switch { "critical" => 0, "high" => 1, "medium" => 2, _ => 3 };
        var ordered = rows.OrderBy(i => Rank(i.Severity)).ThenByDescending(i => i.AffectedCount).ToList();
        return Result.Success<IReadOnlyList<IssueDto>>(ordered);
    }
}
