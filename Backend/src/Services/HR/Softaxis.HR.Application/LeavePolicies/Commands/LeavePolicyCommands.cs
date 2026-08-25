using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.HR.Application.LeavePolicies.Dtos;

namespace Softaxis.HR.Application.LeavePolicies.Commands;

public sealed record CreateLeavePolicyCommand(
    string  LeaveType,
    decimal AnnualEntitlementDays,
    bool    IsPaid = true,
    string? Description = null) : ICommand<LeavePolicyDto>;

public sealed record UpdateLeavePolicyCommand(
    Guid    Id,
    decimal AnnualEntitlementDays,
    bool    IsPaid,
    string? Description,
    bool    IsActive) : ICommand;

public sealed record DeleteLeavePolicyCommand(Guid Id) : ICommand;

public sealed class CreateLeavePolicyValidator : AbstractValidator<CreateLeavePolicyCommand>
{
    public CreateLeavePolicyValidator()
    {
        RuleFor(x => x.LeaveType).NotEmpty().MaximumLength(40)
            .WithMessage("Leave type is required.");
        RuleFor(x => x.AnnualEntitlementDays).InclusiveBetween(0, 365)
            .WithMessage("Entitlement must be between 0 and 365 days.");
    }
}

public sealed class UpdateLeavePolicyValidator : AbstractValidator<UpdateLeavePolicyCommand>
{
    public UpdateLeavePolicyValidator()
    {
        RuleFor(x => x.AnnualEntitlementDays).InclusiveBetween(0, 365)
            .WithMessage("Entitlement must be between 0 and 365 days.");
    }
}
