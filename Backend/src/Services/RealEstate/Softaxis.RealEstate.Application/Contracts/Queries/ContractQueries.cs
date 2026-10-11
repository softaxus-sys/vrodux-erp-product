using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.RealEstate.Application.Contracts.Dtos;

namespace Softaxis.RealEstate.Application.Contracts.Queries;

public sealed record GetContractsQuery(Guid? TenantId = null, string? Status = null)
    : IQuery<IReadOnlyList<ContractDto>>;

public sealed record GetContractByIdQuery(Guid Id) : IQuery<ContractDetailDto>;

public sealed record GetContractsSummaryQuery : IQuery<ContractsSummaryDto>;

/// <summary>What ending this lease on <paramref name="TerminationDate"/> would come to. Changes nothing.</summary>
public sealed record GetTerminationPreviewQuery(
    Guid Id, string TerminationDate, decimal PenaltyAmount = 0, decimal DeductionsAmount = 0)
    : IQuery<TerminationStatementDto>;

/// <summary>Rent that is late, or falls due inside the next <paramref name="WithinDays"/> days.
/// Overdue first — that is the queue an operator actually works.</summary>
public sealed record GetRentDueQuery(int WithinDays = 30, bool IncludeOverdue = true)
    : IQuery<IReadOnlyList<RentDueItemDto>>;
