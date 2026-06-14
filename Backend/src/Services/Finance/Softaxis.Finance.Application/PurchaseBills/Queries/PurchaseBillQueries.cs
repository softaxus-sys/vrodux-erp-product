using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Finance.Application.PurchaseBills.Dtos;

namespace Softaxis.Finance.Application.PurchaseBills.Queries;

public sealed record GetPurchaseBillsSummaryQuery : IQuery<PurchaseBillsSummaryDto>;

public sealed record GetPurchaseBillsQuery(
    int Page, int PageSize, string? Search, string? Status,
    Guid? SupplierId, bool? Outstanding) : IQuery<PagedResult<PurchaseBillSummaryDto>>;

public sealed record GetPurchaseBillByIdQuery(Guid Id) : IQuery<PurchaseBillDto>;
