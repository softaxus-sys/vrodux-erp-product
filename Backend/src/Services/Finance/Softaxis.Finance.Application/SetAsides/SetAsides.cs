using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Finance.Application.SetAsides;

// ── DTOs ─────────────────────────────────────────────────────────────────────

public sealed record SetAsideRuleDto(Guid Id, string Name, string Kind, decimal Value, bool AutoApply, bool IsActive);

public sealed record SetAsideRuleTotalDto(string Name, decimal Accrued, decimal Paid, decimal Owed);

public sealed record SetAsideMonthDto(string Month, decimal Accrued, decimal Paid);

public sealed record SetAsideOwedEntryDto(
    Guid Id, Guid InvoiceId, string InvoiceNumber, string Name,
    decimal Amount, decimal LedgerAmount, string CurrencyCode, string AccruedOn);

public sealed record SetAsidePayoutDto(
    Guid Id, string PaidOn, decimal Total, string FromAccountNumber, string? Reference, string? Notes, int EntryCount);

/// <summary>All figures are in the workspace currency. Owed is all-time; the rest follow the date range.</summary>
public sealed record SetAsideDashboardDto(
    bool HasRules,
    decimal Owed,
    decimal Accrued,
    decimal Paid,
    decimal Income,
    decimal EffectivePercent,
    IReadOnlyList<SetAsideRuleTotalDto> ByRule,
    IReadOnlyList<SetAsideMonthDto> ByMonth,
    IReadOnlyList<SetAsideOwedEntryDto> OwedEntries,
    IReadOnlyList<SetAsidePayoutDto> RecentPayouts);

// ── Rules ────────────────────────────────────────────────────────────────────

public sealed record GetSetAsideRulesQuery : IQuery<IReadOnlyList<SetAsideRuleDto>>;

public sealed record SaveSetAsideRuleCommand(
    Guid? Id, string Name, string Kind, decimal Value, bool AutoApply, bool IsActive) : ICommand<SetAsideRuleDto>;

public sealed class SaveSetAsideRuleValidator : AbstractValidator<SaveSetAsideRuleCommand>
{
    public SaveSetAsideRuleValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Kind).Must(k => k is "percent" or "fixed").WithMessage("Kind must be 'percent' or 'fixed'.");
        RuleFor(x => x.Value).GreaterThan(0);
        RuleFor(x => x.Value).LessThanOrEqualTo(100).When(x => x.Kind == "percent")
            .WithMessage("A percentage cannot be more than 100.");
    }
}

public sealed record DeleteSetAsideRuleCommand(Guid Id) : ICommand;

// ── Dashboard + payout ───────────────────────────────────────────────────────

public sealed record GetSetAsideDashboardQuery(string? From, string? To) : IQuery<SetAsideDashboardDto>;

/// <summary>Reverses a payout recorded by mistake: the ledger entry is voided and the amounts go back to "waiting".</summary>
public sealed record UndoSetAsidePayoutCommand(Guid PayoutId) : ICommand;

public sealed record PaySetAsidesCommand(
    IReadOnlyList<Guid> EntryIds, string PaidOn, string FromAccountNumber, string? Reference, string? Notes)
    : ICommand<SetAsidePayoutDto>;

public sealed class PaySetAsidesValidator : AbstractValidator<PaySetAsidesCommand>
{
    public PaySetAsidesValidator()
    {
        RuleFor(x => x.EntryIds).NotEmpty().WithMessage("Choose at least one amount to pay.");
        RuleFor(x => x.PaidOn).NotEmpty().Matches(@"^\d{4}-\d{2}-\d{2}$").WithMessage("Date must be yyyy-MM-dd.");
        RuleFor(x => x.FromAccountNumber).NotEmpty().MaximumLength(30);
        RuleFor(x => x.Reference).MaximumLength(100);
        RuleFor(x => x.Notes).MaximumLength(500);
    }
}
