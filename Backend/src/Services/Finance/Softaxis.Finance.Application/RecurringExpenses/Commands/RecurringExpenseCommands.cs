using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Finance.Application.RecurringExpenses.Dtos;

namespace Softaxis.Finance.Application.RecurringExpenses.Commands;

public static class RecurringExpenseRules
{
    public static readonly string[] Frequencies    = ["weekly", "monthly", "quarterly", "yearly"];
    public static readonly string[] PaymentMethods = ["cash", "bank", "card", "cheque"];
}

public sealed record CreateRecurringExpenseCommand(
    string TemplateName, string Category, decimal Amount, string? Vendor,
    string? PaymentMethod, string Frequency, string StartDate, string? EndDate,
    // On = each generated expense is approved, paid and posted to the ledger with nobody reviewing
    // it. Off = created pending for the normal approval workflow.
    bool AutoPost, string? Reference, string? Notes,
    // Ledger accounts to debit (the cost) and credit (where the money comes from). Null = derived
    // from the category and the payment method.
    Guid? ExpenseAccountId = null, Guid? PaymentAccountId = null) : ICommand<RecurringExpenseDto>;

public sealed class CreateRecurringExpenseValidator : AbstractValidator<CreateRecurringExpenseCommand>
{
    public CreateRecurringExpenseValidator()
    {
        RuleFor(x => x.TemplateName).NotEmpty().WithName("Name").MaximumLength(150);
        RuleFor(x => x.Category).NotEmpty().MaximumLength(50);
        RuleFor(x => x.Amount).GreaterThan(0).WithMessage("Amount must be greater than zero.");
        RuleFor(x => x.Frequency).Must(f => RecurringExpenseRules.Frequencies.Contains(f))
            .WithMessage("Frequency must be weekly, monthly, quarterly or yearly.");
        RuleFor(x => x.PaymentMethod)
            .Must(m => string.IsNullOrWhiteSpace(m) || RecurringExpenseRules.PaymentMethods.Contains(m))
            .WithMessage("Paid from must be cash, bank, card or cheque.");
        RuleFor(x => x.StartDate).Must(d => DateTime.TryParse(d, out _))
            .WithMessage("Start date is required.");
        RuleFor(x => x.EndDate).Must(d => string.IsNullOrWhiteSpace(d) || DateTime.TryParse(d, out _))
            .WithMessage("End date is not a valid date.");
    }
}

public sealed record UpdateRecurringExpenseCommand(
    Guid Id, string TemplateName, string Category, decimal Amount, string? Vendor,
    string? PaymentMethod, string Frequency, string? NextRunDate, string? EndDate,
    bool AutoPost, string? Reference, string? Notes,
    Guid? ExpenseAccountId = null, Guid? PaymentAccountId = null) : ICommand;

public sealed class UpdateRecurringExpenseValidator : AbstractValidator<UpdateRecurringExpenseCommand>
{
    public UpdateRecurringExpenseValidator()
    {
        RuleFor(x => x.TemplateName).NotEmpty().WithName("Name").MaximumLength(150);
        RuleFor(x => x.Category).NotEmpty().MaximumLength(50);
        RuleFor(x => x.Amount).GreaterThan(0).WithMessage("Amount must be greater than zero.");
        RuleFor(x => x.Frequency).Must(f => RecurringExpenseRules.Frequencies.Contains(f))
            .WithMessage("Frequency must be weekly, monthly, quarterly or yearly.");
        RuleFor(x => x.PaymentMethod)
            .Must(m => string.IsNullOrWhiteSpace(m) || RecurringExpenseRules.PaymentMethods.Contains(m))
            .WithMessage("Paid from must be cash, bank, card or cheque.");
        RuleFor(x => x.NextRunDate).Must(d => string.IsNullOrWhiteSpace(d) || DateTime.TryParse(d, out _))
            .WithMessage("Next run date is not a valid date.");
        RuleFor(x => x.EndDate).Must(d => string.IsNullOrWhiteSpace(d) || DateTime.TryParse(d, out _))
            .WithMessage("End date is not a valid date.");
    }
}

public sealed record PauseRecurringExpenseCommand(Guid Id) : ICommand;

public sealed record ResumeRecurringExpenseCommand(Guid Id) : ICommand;

public sealed record DeleteRecurringExpenseCommand(Guid Id) : ICommand;

/// <summary>Generate one expense now from a template (advances the schedule).</summary>
public sealed record GenerateRecurringExpenseNowCommand(Guid Id) : ICommand<GenerateRecurringExpenseResultDto>;

/// <summary>Generate expenses for every template that is currently due.</summary>
public sealed record RunDueRecurringExpensesCommand : ICommand<RunDueRecurringExpensesResultDto>;
