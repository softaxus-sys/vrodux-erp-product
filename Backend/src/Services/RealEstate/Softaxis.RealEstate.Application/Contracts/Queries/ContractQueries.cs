using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.RealEstate.Application.Contracts.Dtos;

namespace Softaxis.RealEstate.Application.Contracts.Queries;

public sealed record GetContractsQuery(Guid? TenantId = null, string? Status = null)
    : IQuery<IReadOnlyList<ContractDto>>;

public sealed record GetContractByIdQuery(Guid Id) : IQuery<ContractDetailDto>;

public sealed record GetContractsSummaryQuery : IQuery<ContractsSummaryDto>;

/// <summary>Rent that is late, or falls due inside the next <paramref name="WithinDays"/> days.
/// Overdue first — that is the queue an operator actually works.</summary>
public sealed record GetRentDueQuery(int WithinDays = 30, bool IncludeOverdue = true)
    : IQuery<IReadOnlyList<RentDueItemDto>>;
