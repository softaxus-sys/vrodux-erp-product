using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Finance.Application.Banking.Reconciliation;

/// <summary>A ledger line on the bank's account. <c>In</c> = money into the bank (a debit).</summary>
public sealed record ReconBookItemDto(
    Guid JournalLineId, Guid JournalEntryId, string EntryNumber, string Date,
    string Description, decimal Amount, bool In);

/// <summary>A statement line not yet matched, with the ledger lines it could be matched to (closest date first).</summary>
public sealed record ReconBankItemDto(
    Guid Id, string Date, string Description, string Reference, decimal Amount, bool In,
    IReadOnlyList<Guid> Suggestions);

public sealed record ReconciliationDto(
    Guid BankAccountId, string AccountName, string Currency,
    Guid? LedgerAccountId, string? LedgerAccountNumber, string? LedgerAccountName,
    decimal StatementBalance, decimal BookBalance, decimal Difference,
    decimal UnmatchedBankNet, decimal UnmatchedBookNet, int MatchedCount,
    int WindowDays, bool Truncated,
    IReadOnlyList<ReconBankItemDto> UnmatchedBank, IReadOnlyList<ReconBookItemDto> UnmatchedBook);

public sealed record GetReconciliationQuery(Guid BankAccountId, int WindowDays = 5) : IQuery<ReconciliationDto>;

public sealed record SetBankLedgerAccountCommand(Guid BankAccountId, Guid? LedgerAccountId) : ICommand;

public sealed record MatchBankTransactionCommand(Guid TransactionId, Guid JournalLineId, string? UserName) : ICommand;

public sealed class MatchBankTransactionValidator : AbstractValidator<MatchBankTransactionCommand>
{
    public MatchBankTransactionValidator()
    {
        RuleFor(x => x.TransactionId).NotEmpty();
        RuleFor(x => x.JournalLineId).NotEmpty();
    }
}

public sealed record UnmatchBankTransactionCommand(Guid TransactionId) : ICommand;

/// <summary>Matches only the unambiguous cases: one candidate each way. Anything else is left for a person.</summary>
public sealed record AutoMatchBankTransactionsCommand(Guid BankAccountId, int WindowDays, string? UserName) : ICommand<int>;
