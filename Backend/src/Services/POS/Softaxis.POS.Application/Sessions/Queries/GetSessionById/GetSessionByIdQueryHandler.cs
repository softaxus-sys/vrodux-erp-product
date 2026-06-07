using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Application.DTOs;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.Sessions.Queries.GetSessionById;

public sealed class GetSessionByIdQueryHandler(IPOSSessionRepository sessionRepo)
    : IQueryHandler<GetSessionByIdQuery, POSSessionDto>
{
    public async Task<Result<POSSessionDto>> Handle(GetSessionByIdQuery query, CancellationToken ct)
    {
        var session = await sessionRepo.GetByIdAsync(query.Id, ct);
        if (session is null)
            return Result.Failure<POSSessionDto>(Error.NotFoundById("Session", query.Id));

        return Result.Success(new POSSessionDto(
            session.Id, session.CashierId, session.RegisterId, session.Status.ToString(),
            session.OpenedAt, session.ClosedAt, session.OpeningCash, session.ClosingCash,
            session.ExpectedCash, session.CashVariance, session.TotalTransactions,
            session.TotalSales, session.TotalRefunds, session.NetSales, session.Notes));
    }
}
