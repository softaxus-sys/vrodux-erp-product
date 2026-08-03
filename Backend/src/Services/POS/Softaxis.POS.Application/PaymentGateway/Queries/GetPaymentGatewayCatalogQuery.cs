using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.POS.Application.PaymentGateway.Dtos;

namespace Softaxis.POS.Application.PaymentGateway.Queries;

public sealed record GetPaymentGatewayCatalogQuery : IQuery<IReadOnlyList<PaymentGatewayCatalogEntryDto>>;
