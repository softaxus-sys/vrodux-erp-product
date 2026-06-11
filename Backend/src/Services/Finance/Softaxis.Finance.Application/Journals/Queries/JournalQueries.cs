using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Finance.Application.Journals.Dtos;

namespace Softaxis.Finance.Application.Journals.Queries;

public sealed record GetJournalsSummaryQuery : IQuery<JournalsSummaryDto>;

public sealed record GetJournalsQuery(string? Search, string? Status) : IQuery<IReadOnlyList<JournalDto>>;

public sealed record GetJournalByIdQuery(Guid Id) : IQuery<JournalDto>;
