using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Restaurant.Application.BranchInstructions;

/// <summary>One head-office request to a branch, with what the branch did about it.</summary>
/// <param name="Status">
/// <c>pending</c> (the branch has not picked it up), <c>applying</c>, <c>applied</c> or <c>rejected</c>.
/// </param>
public sealed record BranchInstructionDto(
    Guid Id, Guid BranchId, string Kind, Guid OrderId, string? OrderNumber, string Reason,
    decimal? Amount, string? Method, string RequestedByName, DateTime RequestedAt,
    string Status, string? Message, DateTime? ResultAt);

/// <summary>Ask a branch that runs on its own server to void or refund one of its bills.</summary>
public sealed record CreateBranchInstructionCommand(
    Guid BranchId, string Kind, Guid OrderId, string Reason, decimal? Amount = null, string? Method = null)
    : ICommand<BranchInstructionDto>;

public sealed class CreateBranchInstructionValidator : AbstractValidator<CreateBranchInstructionCommand>
{
    public CreateBranchInstructionValidator()
    {
        RuleFor(x => x.BranchId).NotEmpty();
        RuleFor(x => x.OrderId).NotEmpty();
        RuleFor(x => x.Kind).Must(k => k is "void_order" or "refund_order")
            .WithMessage("Kind must be 'void_order' or 'refund_order'.");
        RuleFor(x => x.Reason).NotEmpty().MaximumLength(500);
        When(x => x.Kind == "refund_order", () =>
        {
            RuleFor(x => x.Amount).NotNull().GreaterThan(0).WithMessage("A refund needs an amount.");
            RuleFor(x => x.Method).NotEmpty().MaximumLength(30).WithMessage("A refund needs a method.");
        });
    }
}

public sealed record GetBranchInstructionsQuery(Guid? BranchId = null, Guid? OrderId = null)
    : IQuery<IReadOnlyList<BranchInstructionDto>>;
