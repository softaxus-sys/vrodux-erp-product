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
        if (!string.IsNullOrWhiteSpace(query.Status)) q = q.Where(i => i.Status == query.Status);

        var issues = await q.OrderByDescending(i => i.DetectedAt)
            .Select(i => new IssueDto(i.Id, i.SiteId, i.AuditId, i.Source, i.Category, i.Severity, i.Title, i.Description, i.PageUrl, i.Status, i.DetectedAt))
            .ToListAsync(ct);
        return Result.Success<IReadOnlyList<IssueDto>>(issues);
    }
}
