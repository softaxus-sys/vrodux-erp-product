using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.Banking.Commands;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.Banking;

internal sealed class CreateBankAccountHandler(FinanceDbContext db) : ICommandHandler<CreateBankAccountCommand, Guid>
{
    public async Task<Result<Guid>> Handle(CreateBankAccountCommand cmd, CancellationToken ct)
    {
        var acc = new BankAccount(cmd.AccountName, cmd.BankName, cmd.AccountNumber,
            cmd.Iban, cmd.Currency, cmd.AccountType);
        db.BankAccounts.Add(acc);
        await db.SaveChangesAsync(ct);

        return Result.Success(acc.Id);
    }
}
