using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Application.Customers;
using Softaxis.POS.Application.DTOs;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.Customers.Queries.GetCustomerById;

public sealed class GetCustomerByIdQueryHandler(ICustomerRepository customerRepo)
    : IQueryHandler<GetCustomerByIdQuery, CustomerDto>
{
    public async Task<Result<CustomerDto>> Handle(GetCustomerByIdQuery query, CancellationToken ct)
    {
        var customer = await customerRepo.GetByIdAsync(query.Id, ct);
        if (customer is null)
            return Result.Failure<CustomerDto>(Error.NotFoundById("Customer", query.Id));

        return Result.Success(CustomerMappings.ToDto(customer));
    }
}
