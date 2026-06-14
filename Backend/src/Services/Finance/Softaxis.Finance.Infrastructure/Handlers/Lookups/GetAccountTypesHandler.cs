using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.Lookups.Dtos;
using Softaxis.Finance.Application.Lookups.Queries;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.Lookups;

internal sealed class GetAccountTypesHandler(FinanceDbContext db)
    : IQueryHandler<GetAccountTypesQuery, IReadOnlyList<AccountTypeDto>>
{
    public async Task<Result<IReadOnlyList<AccountTypeDto>>> Handle(GetAccountTypesQuery query, CancellationToken ct)
    {
        var items = await db.AccountTypes
            .AsNoTracking()
            .OrderBy(x => x.ParentId.HasValue)
            .ThenBy(x => x.SortOrder)
            .Select(x => new AccountTypeDto(x.Id, x.Code, x.Name, x.NormalBalance, x.ParentId, x.SortOrder, x.IsActive))
            .ToListAsync(ct);

        return Result.Success<IReadOnlyList<AccountTypeDto>>(items);
    }
}
