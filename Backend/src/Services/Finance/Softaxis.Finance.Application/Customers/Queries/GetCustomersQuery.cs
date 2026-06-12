using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Finance.Application.Customers.Dtos;

namespace Softaxis.Finance.Application.Customers.Queries;

/// <summary>Returns all customers, with optional filters.</summary>
public sealed record GetCustomersQuery(
    string? Search   = null,
    bool?   IsActive = null
) : IQuery<IReadOnlyList<CustomerDto>>;
