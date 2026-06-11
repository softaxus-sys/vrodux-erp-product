using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Finance.Application.JournalEntries.Dtos;

namespace Softaxis.Finance.Application.JournalEntries.Queries;

public sealed record GetJournalEntriesQuery(
    int Page, int PageSize, string? Search, string? Status,
    string? DateFrom, string? DateTo) : IQuery<PagedResult<JournalEntrySummaryDto>>;

public sealed record GetJournalEntryByIdQuery(Guid Id) : IQuery<JournalEntryDto>;
