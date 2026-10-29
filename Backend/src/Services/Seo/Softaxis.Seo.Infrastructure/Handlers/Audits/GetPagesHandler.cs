using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Seo.Application.Audits.Dtos;
using Softaxis.Seo.Application.Audits.Queries;
using Softaxis.Seo.Infrastructure.Persistence;

namespace Softaxis.Seo.Infrastructure.Handlers.Audits;

internal sealed class GetPagesHandler(SeoDbContext db) : IQueryHandler<GetPagesQuery, IReadOnlyList<PageDto>>
{
    public async Task<Result<IReadOnlyList<PageDto>>> Handle(GetPagesQuery query, CancellationToken ct)
    {
        var auditId = query.AuditId;
        if (auditId is null)
            auditId = await db.Audits.AsNoTracking().Where(a => a.SiteId == query.SiteId && a.Status == "completed")
                .OrderByDescending(a => a.StartedAt).Select(a => (Guid?)a.Id).FirstOrDefaultAsync(ct);
        if (auditId is null) return Result.Success<IReadOnlyList<PageDto>>([]);

        var pages = await db.Pages.AsNoTracking().Where(p => p.SiteId == query.SiteId && p.AuditId == auditId)
            .OrderByDescending(p => p.IssueCount).ThenBy(p => p.Url).Take(1000)
            .Select(p => new PageDto(p.Id, p.AuditId, p.Url, p.FinalUrl, p.StatusCode, p.RedirectHops, p.ResponseMs, p.HtmlBytes, p.Depth,
                p.Title, p.MetaDescription, p.H1, p.WordCount, p.Indexable, p.InSitemap, p.InternalLinksIn, p.InternalLinksOut, p.IssueCount, p.Error))
            .ToListAsync(ct);
        return Result.Success<IReadOnlyList<PageDto>>(pages);
    }
}
