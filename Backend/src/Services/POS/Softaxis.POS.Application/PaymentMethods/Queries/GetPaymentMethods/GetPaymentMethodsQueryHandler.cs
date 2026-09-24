using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Application.Abstractions;
using Softaxis.POS.Application.DTOs;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.PaymentMethods.Queries.GetPaymentMethods;

public sealed class GetPaymentMethodsQueryHandler(
    IPaymentMethodConfigRepository repo,
    ICurrentUser                   currentUser)
    : IQueryHandler<GetPaymentMethodsQuery, List<PaymentMethodConfigDto>>
{
    public async Task<Result<List<PaymentMethodConfigDto>>> Handle(
        GetPaymentMethodsQuery query, CancellationToken ct)
    {
        // First time this tenant asks, give it its own copy of the seeded registry. Without it
        // the list is empty - the seeded rows carry no TenantId and the tenant filter hides them -
        // so Master Data and POS Payment Methods showed nothing and nothing could be toggled.
        await repo.EnsureSeededForTenantAsync(currentUser.Country, ct);

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
