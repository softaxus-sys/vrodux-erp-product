using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.POS.Application.DTOs;

namespace Softaxis.POS.Application.Customers.Queries.GetCustomerById;

public sealed record GetCustomerByIdQuery(Guid Id) : IQuery<CustomerDto>;
