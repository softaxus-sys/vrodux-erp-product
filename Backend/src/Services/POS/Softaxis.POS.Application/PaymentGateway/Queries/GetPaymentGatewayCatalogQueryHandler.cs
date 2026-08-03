using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Application.PaymentGateway.Dtos;

namespace Softaxis.POS.Application.PaymentGateway.Queries;

public sealed class GetPaymentGatewayCatalogQueryHandler
    : IQueryHandler<GetPaymentGatewayCatalogQuery, IReadOnlyList<PaymentGatewayCatalogEntryDto>>
{
    public Task<Result<IReadOnlyList<PaymentGatewayCatalogEntryDto>>> Handle(GetPaymentGatewayCatalogQuery query, CancellationToken ct) =>
        Task.FromResult(Result.Success(PaymentGatewayCatalog.All));
}
