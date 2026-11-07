using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Seo.Application.Audits.Dtos;

namespace Softaxis.Seo.Application.Audits.Queries;

public sealed record GetAuditsQuery(Guid SiteId) : IQuery<IReadOnlyList<AuditDto>>;

/// <param name="Status">null = what still needs attention (everything not resolved or dismissed); "all" = everything; otherwise that exact status.</param>
public sealed record GetIssuesQuery(Guid SiteId, string? Status) : IQuery<IReadOnlyList<IssueDto>>;

/// <param name="AuditId">null = the most recent audit that still has its page rows.</param>
public sealed record GetPagesQuery(Guid SiteId, Guid? AuditId) : IQuery<IReadOnlyList<PageDto>>;
