using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Finance.Application.Suppliers.Dtos;

namespace Softaxis.Finance.Application.Suppliers.Queries;

/// <summary>Returns a single supplier by its GUID.</summary>
public sealed record GetSupplierByIdQuery(Guid Id) : IQuery<SupplierDto>;
