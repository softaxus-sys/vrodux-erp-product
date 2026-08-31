using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.Finance.Application.Journals.Dtos;

namespace Softaxis.Finance.Application.Journals.Queries;

public sealed record GetJournalsSummaryQuery : IQuery<JournalsSummaryDto>;

/// <summary>
/// The journals list. Paged in SQL: journal entries are the fastest-growing table in Finance —
/// every invoice sent, payment received, expense paid and payroll approved writes one, so this
/// list only ever gets longer.
/// </summary>
public sealed record GetJournalsQuery(
    string? Search = null,
    string? Status = null,
    /// <summary>yyyy-MM. The period is the date prefix, so this filters on the stored date.</summary>
    string? Period = null,
    int     Page   = 1,
    int     PageSize = 30) : IQuery<PagedResult<JournalDto>>;

public sealed record GetJournalByIdQuery(Guid Id) : IQuery<JournalDto>;
