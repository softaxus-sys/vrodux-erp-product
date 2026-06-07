using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Application.DTOs;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.MasterData.PaymentTerms.Queries;

public sealed record GetPaymentTermsQuery : IQuery<List<PaymentTermDto>>;

public sealed class GetPaymentTermsQueryHandler(IPaymentTermRepository repo)
    : IQueryHandler<GetPaymentTermsQuery, List<PaymentTermDto>>
{
    public async Task<Result<List<PaymentTermDto>>> Handle(GetPaymentTermsQuery q, CancellationToken ct)
    {
        var items = await repo.GetAllAsync(ct);
        var dtos  = items.Select(t => new PaymentTermDto(
            t.Id, t.Name, t.Code, t.DaysNet, t.AdvancePercent,
            t.Description, t.IsDefault, t.IsSystem,
            t.CreatedAt, t.UpdatedAt)).ToList();
        return Result.Success(dtos);
    }
}
