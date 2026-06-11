using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Finance.Application.Expenses.Dtos;

namespace Softaxis.Finance.Application.Expenses.Commands;

public sealed record CreateExpenseCommand(
    string Title, string Category, decimal Amount, string ExpenseDate,
    string? PaidBy, string? PaymentMethod, string? Reference, string? Notes) : ICommand<ExpenseDto>;

public sealed class CreateExpenseValidator : AbstractValidator<CreateExpenseCommand>
{
    public CreateExpenseValidator()
    {
        RuleFor(x => x.Title).NotEmpty();
        RuleFor(x => x.Category).NotEmpty();
        RuleFor(x => x.ExpenseDate).NotEmpty();
    }
}

public sealed record UpdateExpenseCommand(
    Guid Id, string Title, string Category, decimal Amount, string ExpenseDate,
    string? PaidBy, string? PaymentMethod, string? Reference, string? Notes) : ICommand;

public sealed class UpdateExpenseValidator : AbstractValidator<UpdateExpenseCommand>
{
    public UpdateExpenseValidator()
    {
        RuleFor(x => x.Title).NotEmpty();
        RuleFor(x => x.Category).NotEmpty();
        RuleFor(x => x.ExpenseDate).NotEmpty();
    }
}

public sealed record ApproveExpenseCommand(Guid Id, Guid ApproverId) : ICommand;

public sealed record RejectExpenseCommand(Guid Id, Guid ApproverId) : ICommand;

public sealed record MarkExpensePaidCommand(Guid Id) : ICommand;

public sealed record DeleteExpenseCommand(Guid Id) : ICommand;
