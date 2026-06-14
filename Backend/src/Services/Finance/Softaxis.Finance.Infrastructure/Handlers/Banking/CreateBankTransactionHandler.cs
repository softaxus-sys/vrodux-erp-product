using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.Banking.Commands;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.Banking;

internal sealed class CreateBankTransactionHandler(FinanceDbContext db) : ICommandHandler<CreateBankTransactionCommand, Guid>
{
    public async Task<Result<Guid>> Handle(CreateBankTransactionCommand cmd, CancellationToken ct)
    {
        var account = await db.BankAccounts.FindAsync([cmd.AccountId], ct);
        if (account is null)
            return Result.Failure<Guid>(Error.NotFoundById("BankAccount", cmd.AccountId));

        var type = cmd.Type.ToLowerInvariant(); // "credit" | "debit"

        // Update source account balance
        var newBalance   = type == "credit" ? account.Balance + cmd.Amount : account.Balance - cmd.Amount;
        var newAvailable = type == "credit" ? account.AvailableBalance + cmd.Amount : account.AvailableBalance - cmd.Amount;
        account.UpdateBalance(newBalance, newAvailable);

        var txn = new BankTransaction(
            cmd.AccountId, cmd.Date,
            cmd.Description, cmd.Reference ?? "",
            cmd.Amount, type, cmd.Category);
        txn.SetBalance(newBalance);
        db.BankTransactions.Add(txn);

        // Transfer: create mirrored credit on destination account
        if (cmd.ToAccountId.HasValue && type == "debit")
        {
            var toAccount = await db.BankAccounts.FindAsync([cmd.ToAccountId.Value], ct);
            if (toAccount is null)
                return Result.Failure<Guid>(Error.NotFoundById("BankAccount", cmd.ToAccountId.Value));

            var toBalance   = toAccount.Balance + cmd.Amount;
            var toAvailable = toAccount.AvailableBalance + cmd.Amount;
            toAccount.UpdateBalance(toBalance, toAvailable);

            var toTxn = new BankTransaction(
                cmd.ToAccountId.Value, cmd.Date,
                $"Transfer from {account.AccountName}: {cmd.Description}",
                cmd.Reference ?? "",
                cmd.Amount, "credit", cmd.Category);
            toTxn.SetBalance(toBalance);
            db.BankTransactions.Add(toTxn);
        }

        await db.SaveChangesAsync(ct);

        return Result.Success(txn.Id);
    }
}
