using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Application.DTOs;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.Customers.Queries.GetCustomers;

public sealed class GetCustomersQueryHandler(ICustomerRepository customerRepo)
    : IQueryHandler<GetCustomersQuery, PagedResult<CustomerSummaryDto>>
{
    public async Task<Result<PagedResult<CustomerSummaryDto>>> Handle(GetCustomersQuery query, CancellationToken ct)
    {
        var paged = await customerRepo.GetPagedAsync(query.Page, query.PageSize, query.Search, ct);

        var dtos = paged.Items.Select(c => new CustomerSummaryDto(
            c.Id, c.Name, c.Phone, c.Email, c.LoyaltyPoints, c.IsActive)).ToList();

        return Result.Success(PagedResult<CustomerSummaryDto>.Create(
            dtos, paged.TotalCount, paged.Page, paged.PageSize));
    }
}
