using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.HR.Application.Employees.Dtos;

namespace Softaxis.HR.Application.Employees.Commands;

public sealed record CreateEmployeeCommand(
    string  FirstName,
    string  LastName,
    string  Email,
    string? Phone,
    string? JobTitle,
    Guid?   DepartmentId,
    string? DepartmentName,
    string  EmploymentType,
    decimal BasicSalary,
    string  JoiningDate,
    Guid?   ManagerId,
    string? Notes
) : ICommand<EmployeeDto>;

public sealed class CreateEmployeeValidator : AbstractValidator<CreateEmployeeCommand>
{
    public CreateEmployeeValidator()
    {
        RuleFor(x => x.FirstName).NotEmpty().WithMessage("First name is required.");
        RuleFor(x => x.LastName).NotEmpty().WithMessage("Last name is required.");
        RuleFor(x => x.Email).NotEmpty().EmailAddress().WithMessage("A valid email is required.");
        RuleFor(x => x.JoiningDate).NotEmpty().WithMessage("Joining date is required.");
    }
}
