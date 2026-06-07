using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Application.Abstractions;
using Softaxis.POS.Application.DTOs;
using Softaxis.POS.Domain.Enums;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.Sessions.Queries.GetActiveSessions;

public sealed class GetActiveSessionsQueryHandler(
    IPOSSessionRepository sessionRepo,
    ICurrentUser          currentUser)
    : IQueryHandler<GetActiveSessionsQuery, IReadOnlyList<POSSessionSummaryDto>>
{
    public async Task<Result<IReadOnlyList<POSSessionSummaryDto>>> Handle(
        GetActiveSessionsQuery query, CancellationToken ct)
    {
        // Filter by the calling user's ID so each user only sees their own sessions.
        // This prevents a cashier from accidentally picking up another user's open session.
        var paged = await sessionRepo.GetPagedAsync(
            1, 10,
            cashierId: currentUser.Id,
            status: SessionStatus.Open,
            ct: ct);

        var dtos = paged.Items.Select(s => new POSSessionSummaryDto(
            s.Id, s.RegisterId, s.Status.ToString(),
            s.OpenedAt, s.TotalTransactions, s.NetSales)).ToList();

        return Result.Success<IReadOnlyList<POSSessionSummaryDto>>(dtos);
    }
}
