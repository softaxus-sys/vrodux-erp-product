using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.RealEstate.Application.Tenants.Dtos;

namespace Softaxis.RealEstate.Application.Tenants.Commands;

public sealed record CreateTenantCommand(
    string Name, string TenantType, string Email, string Phone,
    string Nationality, string? NationalId, string? CompanyName, string? TradeLicense,
    // Optional profile detail the Add Tenant form has always collected. Trailing and optional, so
    // every existing caller binds unchanged.
    string? PassportNumber = null, string? Trn = null, string? Occupation = null,
    decimal? MonthlyIncome = null, string? EmergencyContact = null, string? Notes = null,
    string? Status = null)
    : ICommand<CreatedTenantDto>;

public sealed class CreateTenantValidator : AbstractValidator<CreateTenantCommand>
{
    public CreateTenantValidator()
    {
        // Named for the field the user actually sees. "The Name field is required" is meaningless
        // to someone looking at a form labelled Full Name.
        RuleFor(x => x.Name).NotEmpty().WithMessage("Full name is required.");
        RuleFor(x => x.TenantType).NotEmpty()
            .Must(t => t is "individual" or "company")
            .WithMessage("Tenant type must be individual or company.");
        RuleFor(x => x.Email).NotEmpty().WithMessage("Email is required.")
            .EmailAddress().WithMessage("Enter a valid email address.");
        RuleFor(x => x.Phone).NotEmpty().WithMessage("Phone number is required.");
        RuleFor(x => x.Nationality).NotEmpty().WithMessage("Nationality is required.");
        RuleFor(x => x.MonthlyIncome).GreaterThanOrEqualTo(0)
            .When(x => x.MonthlyIncome.HasValue);
    }
}

public sealed record DeleteTenantCommand(Guid Id) : ICommand;
