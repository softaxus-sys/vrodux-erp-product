using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.DTOs;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Application.AuditLogs.Queries.GetAuditLogs;

public sealed class GetAuditLogsQueryHandler(IAuditLogRepository auditRepo)
    : IQueryHandler<GetAuditLogsQuery, PagedResult<AuditLogDto>>
{
    public async Task<Result<PagedResult<AuditLogDto>>> Handle(GetAuditLogsQuery query, CancellationToken ct)
    {
        var paged = await auditRepo.GetPagedAsync(
            query.Page, query.PageSize,
            query.UserId, query.Action,
            query.From, query.To, ct);

        var dtos = paged.Items
            .Select(a => new AuditLogDto(
                a.Id, a.UserId,
                a.User?.Username,
                a.Action, a.EntityType, a.EntityId,
                a.OldValues, a.NewValues, a.IpAddress,
                a.Succeeded, a.OccurredOn))
            .ToList();

        return Result.Success(PagedResult<AuditLogDto>.Create(dtos, paged.TotalCount, paged.Page, paged.PageSize));
    }
}

