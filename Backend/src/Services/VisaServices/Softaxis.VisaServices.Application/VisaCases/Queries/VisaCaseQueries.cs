using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.VisaServices.Application.VisaCases.Dtos;

namespace Softaxis.VisaServices.Application.VisaCases.Queries;

public sealed record GetVisaCasesQuery(string? Status = null, Guid? CustomerId = null)
    : IQuery<IReadOnlyList<VisaCaseSummaryDto>>;

public sealed record GetVisaCaseByIdQuery(Guid Id) : IQuery<VisaCaseDetailDto>;

public sealed record GetVisaCasesSummaryQuery : IQuery<VisaCasesSummaryDto>;

public sealed record GetVisaTypesQuery : IQuery<IReadOnlyList<VisaTypeDto>>;

public sealed record GetVisaDashboardQuery : IQuery<VisaDashboardDto>;

/// <summary>Expiring passports + case documents within the given horizon (default 90 days), overdue first.</summary>
public sealed record GetVisaRenewalsQuery(int WithinDays = 90) : IQuery<IReadOnlyList<RenewalItemDto>>;
