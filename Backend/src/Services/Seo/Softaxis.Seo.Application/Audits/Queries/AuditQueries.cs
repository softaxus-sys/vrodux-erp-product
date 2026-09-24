using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Seo.Application.Audits.Dtos;

namespace Softaxis.Seo.Application.Audits.Queries;

public sealed record GetAuditsQuery(Guid SiteId) : IQuery<IReadOnlyList<AuditDto>>;
public sealed record GetIssuesQuery(Guid SiteId, string? Status) : IQuery<IReadOnlyList<IssueDto>>;
