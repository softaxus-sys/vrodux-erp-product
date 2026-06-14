using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Finance.Application.Customers.Dtos;

namespace Softaxis.Finance.Application.Customers.Queries;

/// <summary>Returns a single customer by its GUID.</summary>
public sealed record GetCustomerByIdQuery(Guid Id) : IQuery<CustomerDto>;
