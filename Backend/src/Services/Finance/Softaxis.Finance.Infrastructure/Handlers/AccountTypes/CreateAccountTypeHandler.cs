using System.Text;
using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.AccountTypes.Commands;
using Softaxis.Finance.Application.Lookups.Dtos;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.AccountTypes;

internal sealed class CreateAccountTypeHandler(FinanceDbContext db)
    : ICommandHandler<CreateAccountTypeCommand, AccountTypeDto>
{
    public async Task<Result<AccountTypeDto>> Handle(CreateAccountTypeCommand cmd, CancellationToken ct)
    {
        string normalBalance;

        if (cmd.ParentId.HasValue)
        {
            var parent = await db.AccountTypes.FindAsync([cmd.ParentId.Value], ct);
            if (parent is null)
                return Result.Failure<AccountTypeDto>(
                    Error.Custom("AccountType.NotFound", $"Parent account type '{cmd.ParentId}' was not found."));

            if (parent.ParentId.HasValue)
                return Result.Failure<AccountTypeDto>(
                    Error.Custom("AccountType.Conflict", "Subtypes cannot be nested more than one level deep."));

            normalBalance = parent.NormalBalance;
        }
        else
        {
            normalBalance = cmd.NormalBalance!;
        }

        var code = await GenerateUniqueCodeAsync(cmd.Name, db, ct);

        var maxSortOrder = await db.AccountTypes
            .Where(x => x.ParentId == cmd.ParentId)
            .Select(x => (int?)x.SortOrder)
            .MaxAsync(ct);

        var entity = new AccountType(code, cmd.Name, normalBalance, (maxSortOrder ?? 0) + 1, cmd.ParentId);

        db.AccountTypes.Add(entity);
        await db.SaveChangesAsync(ct);

        return Result.Success(new AccountTypeDto(
            entity.Id, entity.Code, entity.Name, entity.NormalBalance,
            entity.ParentId, entity.SortOrder, entity.IsActive));
    }

    private static async Task<string> GenerateUniqueCodeAsync(string name, FinanceDbContext db, CancellationToken ct)
    {
        var baseCode = Slugify(name);
        var code = baseCode;
        var suffix = 2;

        while (await db.AccountTypes.AnyAsync(x => x.Code == code, ct))
        {
            code = $"{baseCode}_{suffix}";
            suffix++;
        }

        return code;
    }

    private static string Slugify(string name)
    {
        var sb = new StringBuilder();
        foreach (var c in name.Trim().ToLowerInvariant())
        {
            if (char.IsLetterOrDigit(c)) sb.Append(c);
            else if (sb.Length > 0 && sb[^1] != '_') sb.Append('_');
        }

        var result = sb.ToString().Trim('_');
        return result.Length > 0 ? result : "type";
    }
}
