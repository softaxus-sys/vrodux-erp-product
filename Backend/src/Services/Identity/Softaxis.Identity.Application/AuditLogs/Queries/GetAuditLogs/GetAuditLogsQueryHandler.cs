using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Application.DTOs;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Application.AuditLogs.Queries.GetAuditLogs;

public sealed class GetAuditLogsQueryHandler(IAuditLogRepository auditRepo, ICurrentUser currentUser)
    : IQueryHandler<GetAuditLogsQuery, PagedResult<AuditLogDto>>
{
    public async Task<Result<PagedResult<AuditLogDto>>> Handle(GetAuditLogsQuery query, CancellationToken ct)
    {
        // Super-admins see all logs; tenant users see only their tenant's logs
        var tenantId = currentUser.IsSuperAdmin ? null : currentUser.TenantId;

        // The date filters arrive as the viewer's calendar days — convert to UTC instants and make
        // the upper bound cover the whole end day. See AuditLogFilterWindow.
        var fromUtc = AuditLogFilterWindow.StartUtc(query.From, query.TzOffsetMinutes);
        var toUtc   = AuditLogFilterWindow.EndUtc(query.To,   query.TzOffsetMinutes);

        var paged = await auditRepo.GetPagedAsync(
            query.Page, query.PageSize,
            query.UserId, query.Action,
            fromUtc, toUtc,
            tenantId, query.Search, ct);

        var dtos = paged.Items
            .Select(a => new AuditLogDto(
                a.Id, a.UserId,
                a.User?.Username,
                a.Action, a.EntityType, a.EntityId,
                a.OldValues, a.NewValues, a.IpAddress,
                a.Succeeded,
                // OccurredOn is written as DateTime.UtcNow, but SQL Server `datetime2` carries no
                // offset, so EF hands it back as Unspecified and System.Text.Json serialises it
                // WITHOUT a trailing "Z". `new Date(...)` in the browser then reads that as local
                // time and every entry is displayed shifted by the viewer's UTC offset. Stamping
                // the kind is what puts the "Z" on the wire.
                DateTime.SpecifyKind(a.OccurredOn, DateTimeKind.Utc)))
            .ToList();

        return Result.Success(PagedResult<AuditLogDto>.Create(dtos, paged.TotalCount, paged.Page, paged.PageSize));
    }
}
