using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.Identity.Application.DTOs;

namespace Softaxis.Identity.Application.AuditLogs.Queries.GetAuditLogs;

public sealed record GetAuditLogsQuery(
    int       Page     = 1,
    int       PageSize = 20,
    Guid?     UserId   = null,
    string?   Action   = null,
    DateTime? From     = null,
    DateTime? To       = null
) : IQuery<PagedResult<AuditLogDto>>;

