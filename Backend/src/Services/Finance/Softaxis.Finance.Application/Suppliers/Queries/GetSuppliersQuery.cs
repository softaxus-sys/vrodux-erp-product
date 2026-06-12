using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Finance.Application.Suppliers.Dtos;

namespace Softaxis.Finance.Application.Suppliers.Queries;

/// <summary>Returns all suppliers, with optional filters.</summary>
public sealed record GetSuppliersQuery(
    string? Search   = null,
    bool?   IsActive = null
) : IQuery<IReadOnlyList<SupplierDto>>;
