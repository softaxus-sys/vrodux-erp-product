using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Application.DTOs;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.Sessions.Queries.GetCashMovements;

public sealed record GetCashMovementsQuery(Guid SessionId) : IQuery<List<CashMovementDto>>;

public sealed class GetCashMovementsQueryHandler(ICashMovementRepository repo)
    : IQueryHandler<GetCashMovementsQuery, List<CashMovementDto>>
{
    public async Task<Result<List<CashMovementDto>>> Handle(GetCashMovementsQuery q, CancellationToken ct)
    {
        var items = await repo.GetBySessionAsync(q.SessionId, ct);
        var dtos  = items.Select(m => new CashMovementDto(
            m.Id, m.SessionId, m.CashierId, m.Type.ToString(), m.Amount, m.Reason, m.CreatedAt)).ToList();
        return Result.Success(dtos);
    }
}
