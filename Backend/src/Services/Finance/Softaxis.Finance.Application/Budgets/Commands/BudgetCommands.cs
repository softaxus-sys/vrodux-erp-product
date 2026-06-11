using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Finance.Application.Budgets.Dtos;

namespace Softaxis.Finance.Application.Budgets.Commands;

public sealed record CreateBudgetCommand(
    string Name, string Period, string? Notes,
    IReadOnlyList<BudgetLineRequest> Lines) : ICommand<BudgetDto>;

public sealed class CreateBudgetValidator : AbstractValidator<CreateBudgetCommand>
{
    public CreateBudgetValidator()
    {
        RuleFor(x => x.Name).NotEmpty();
        RuleFor(x => x.Period).NotEmpty();
    }
}

public sealed record UpdateBudgetCommand(
    Guid Id, string Name, string Period, string Status, string? Notes,
    IReadOnlyList<BudgetLineRequest> Lines) : ICommand;

public sealed class UpdateBudgetValidator : AbstractValidator<UpdateBudgetCommand>
{
    public UpdateBudgetValidator()
    {
        RuleFor(x => x.Name).NotEmpty();
        RuleFor(x => x.Period).NotEmpty();
        RuleFor(x => x.Status).NotEmpty();
    }
}

public sealed record DeleteBudgetCommand(Guid Id) : ICommand;
