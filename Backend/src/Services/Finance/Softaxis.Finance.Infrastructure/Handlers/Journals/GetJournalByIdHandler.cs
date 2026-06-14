using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.Journals.Dtos;
using Softaxis.Finance.Application.Journals.Queries;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.Journals;

internal sealed class GetJournalByIdHandler(FinanceDbContext db) : IQueryHandler<GetJournalByIdQuery, JournalDto>
{
    public async Task<Result<JournalDto>> Handle(GetJournalByIdQuery query, CancellationToken ct)
    {
        var e = await db.JournalEntries.AsNoTracking()
            .Include(x => x.Lines).ThenInclude(l => l.Account)
            .FirstOrDefaultAsync(x => x.Id == query.Id, ct);

        if (e is null)
            return Result.Failure<JournalDto>(Error.NotFoundById("Journal", query.Id));

        return Result.Success(JournalMappings.ToDto(e));
    }
}
