using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Application.DTOs;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.PaymentMethods.Queries.GetPaymentMethods;

public sealed class GetPaymentMethodsQueryHandler(IPaymentMethodConfigRepository repo)
    : IQueryHandler<GetPaymentMethodsQuery, List<PaymentMethodConfigDto>>
{
    public async Task<Result<List<PaymentMethodConfigDto>>> Handle(
        GetPaymentMethodsQuery query, CancellationToken ct)
    {
        var methods = await repo.GetAllAsync(ct);

        var dtos = methods
            .OrderBy(m => m.SortOrder)
            .ThenBy(m => m.Code)
            .Select(m => new PaymentMethodConfigDto(
                m.Id, m.Code, m.Label, m.IconKey,
                m.Countries, m.Description,
                m.SortOrder, m.IsEnabled, m.IsSystem))
            .ToList();

        return Result.Success(dtos);
    }
}
