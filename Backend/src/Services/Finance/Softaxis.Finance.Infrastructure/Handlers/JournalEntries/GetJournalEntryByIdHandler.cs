using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.JournalEntries.Dtos;
using Softaxis.Finance.Application.JournalEntries.Queries;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.JournalEntries;

internal sealed class GetJournalEntryByIdHandler(FinanceDbContext db) : IQueryHandler<GetJournalEntryByIdQuery, JournalEntryDto>
{
    public async Task<Result<JournalEntryDto>> Handle(GetJournalEntryByIdQuery query, CancellationToken ct)
    {
        var entry = await db.JournalEntries
            .AsNoTracking()
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.Id == query.Id, ct);

        if (entry is null)
            return Result.Failure<JournalEntryDto>(Error.NotFoundById("JournalEntry", query.Id));

        return Result.Success(JournalEntryMappings.ToDto(entry));
    }
}
