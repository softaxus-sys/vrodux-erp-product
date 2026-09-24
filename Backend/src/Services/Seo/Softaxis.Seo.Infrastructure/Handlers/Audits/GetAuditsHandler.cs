using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Seo.Application.Audits.Dtos;
using Softaxis.Seo.Application.Audits.Queries;
using Softaxis.Seo.Infrastructure.Persistence;

namespace Softaxis.Seo.Infrastructure.Handlers.Audits;

internal sealed class GetAuditsHandler(SeoDbContext db) : IQueryHandler<GetAuditsQuery, IReadOnlyList<AuditDto>>
{
    public async Task<Result<IReadOnlyList<AuditDto>>> Handle(GetAuditsQuery query, CancellationToken ct)
    {
        var audits = await db.Audits.AsNoTracking()
            .Where(a => a.SiteId == query.SiteId)
            .OrderByDescending(a => a.StartedAt)
            .Select(a => new AuditDto(a.Id, a.SiteId, a.Status, a.StartedAt, a.CompletedAt, a.IssuesFound, a.FixesProposed, a.Error))
            .ToListAsync(ct);
        return Result.Success<IReadOnlyList<AuditDto>>(audits);
    }
}
