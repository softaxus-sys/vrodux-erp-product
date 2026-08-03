using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Restaurant.Application.Tables.Dtos;

namespace Softaxis.Restaurant.Application.Tables.Commands;

/// <summary>Creates a new dining table.</summary>
public sealed record CreateTableCommand(
    string TableNumber,
    string Section,
    int Capacity,
    Guid? BranchId = null,
    Guid? DiningAreaId = null
) : ICommand<TableDto>;

public sealed class CreateTableValidator : AbstractValidator<CreateTableCommand>
{
    public CreateTableValidator()
    {
        RuleFor(x => x.TableNumber)
            .NotEmpty().WithMessage("Table number is required.")
            .MaximumLength(20).WithMessage("Table number must be ≤ 20 characters.");

        RuleFor(x => x.Section)
            .NotEmpty().WithMessage("Section is required.")
            .MaximumLength(50).WithMessage("Section must be ≤ 50 characters.");

        RuleFor(x => x.Capacity)
            .GreaterThan(0).WithMessage("Capacity must be greater than zero.");
    }
}
