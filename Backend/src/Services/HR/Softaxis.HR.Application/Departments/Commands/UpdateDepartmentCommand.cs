using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.HR.Application.Departments.Commands;

public sealed record UpdateDepartmentCommand(
    Guid    Id,
    string  Name,
    string? Code,
    string? Description,
    Guid?   ManagerId,
    bool    IsActive = true
) : ICommand;

public sealed class UpdateDepartmentValidator : AbstractValidator<UpdateDepartmentCommand>
{
    public UpdateDepartmentValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Department name is required.")
            .MaximumLength(200).WithMessage("Department name must be ≤ 200 characters.");

        RuleFor(x => x.Code)
            .MaximumLength(20).WithMessage("Code must be ≤ 20 characters.")
            .When(x => x.Code is not null);

        RuleFor(x => x.Description)
            .MaximumLength(500).WithMessage("Description must be ≤ 500 characters.")
            .When(x => x.Description is not null);
    }
}
