using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Application.Customers;
using Softaxis.POS.Application.DTOs;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.Customers.Queries.GetCustomers;

public sealed class GetCustomersQueryHandler(ICustomerRepository customerRepo)
    : IQueryHandler<GetCustomersQuery, PagedResult<CustomerSummaryDto>>
{
    public async Task<Result<PagedResult<CustomerSummaryDto>>> Handle(GetCustomersQuery query, CancellationToken ct)
    {
        var paged = await customerRepo.GetPagedAsync(query.Page, query.PageSize, query.Search, ct);

        var dtos = paged.Items.Select(CustomerMappings.ToSummaryDto).ToList();

        return Result.Success(PagedResult<CustomerSummaryDto>.Create(
            dtos, paged.TotalCount, paged.Page, paged.PageSize));
    }
}
