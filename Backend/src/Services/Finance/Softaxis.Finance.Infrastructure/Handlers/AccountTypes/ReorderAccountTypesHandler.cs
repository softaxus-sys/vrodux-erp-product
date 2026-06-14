using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.AccountTypes.Commands;
using Softaxis.Finance.Application.Lookups.Dtos;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.AccountTypes;

internal sealed class ReorderAccountTypesHandler(FinanceDbContext db)
    : ICommandHandler<ReorderAccountTypesCommand, IReadOnlyList<AccountTypeDto>>
{
    public async Task<Result<IReadOnlyList<AccountTypeDto>>> Handle(ReorderAccountTypesCommand cmd, CancellationToken ct)
    {
        var ids = cmd.Items.Select(x => x.Id).ToList();
        var entities = await db.AccountTypes.Where(x => ids.Contains(x.Id)).ToListAsync(ct);

        if (entities.Count != ids.Count)
            return Result.Failure<IReadOnlyList<AccountTypeDto>>(
                Error.Custom("AccountType.NotFound", "One or more account types were not found."));

        if (entities.Select(x => x.ParentId).Distinct().Count() > 1)
            return Result.Failure<IReadOnlyList<AccountTypeDto>>(
                Error.Custom("AccountType.Conflict", "All reordered items must share the same parent type."));

        var sortOrderById = cmd.Items.ToDictionary(x => x.Id, x => x.SortOrder);
        foreach (var entity in entities)
            entity.SetSortOrder(sortOrderById[entity.Id]);

        await db.SaveChangesAsync(ct);

        var all = await db.AccountTypes
            .AsNoTracking()
            .OrderBy(x => x.ParentId.HasValue)
            .ThenBy(x => x.SortOrder)
            .Select(x => new AccountTypeDto(x.Id, x.Code, x.Name, x.NormalBalance, x.ParentId, x.SortOrder, x.IsActive))
            .ToListAsync(ct);

        return Result.Success<IReadOnlyList<AccountTypeDto>>(all);
    }
}
