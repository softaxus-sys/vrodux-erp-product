using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Application.AuditLogs.Queries.GetAuditLogs;
using Softaxis.Identity.Application.DTOs;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Application.AuditLogs.Queries.GetAuditLogsSummary;

public sealed class GetAuditLogsSummaryQueryHandler(IAuditLogRepository auditRepo, ICurrentUser currentUser)
    : IQueryHandler<GetAuditLogsSummaryQuery, AuditLogSummaryDto>
{
    public async Task<Result<AuditLogSummaryDto>> Handle(GetAuditLogsSummaryQuery query, CancellationToken ct)
    {
        var tenantId = currentUser.IsSuperAdmin ? null : currentUser.TenantId;

        var fromUtc = AuditLogFilterWindow.StartUtc(query.From, query.TzOffsetMinutes);
        var toUtc   = AuditLogFilterWindow.EndUtc(query.To,   query.TzOffsetMinutes);
        var today   = AuditLogFilterWindow.TodayUtc(query.TzOffsetMinutes);

        var (total, failed, todayCount) = await auditRepo.GetSummaryAsync(
            query.UserId, query.Action, fromUtc, toUtc,
            tenantId, query.Search, today.Start, today.End, ct);

        return Result.Success(new AuditLogSummaryDto(total, failed, todayCount));
    }
}
