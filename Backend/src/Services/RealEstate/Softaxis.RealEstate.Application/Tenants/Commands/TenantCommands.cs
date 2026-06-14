using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.RealEstate.Application.Tenants.Dtos;

namespace Softaxis.RealEstate.Application.Tenants.Commands;

public sealed record CreateTenantCommand(
    string Name, string TenantType, string Email, string Phone,
    string Nationality, string? NationalId, string? CompanyName, string? TradeLicense)
    : ICommand<CreatedTenantDto>;

public sealed class CreateTenantValidator : AbstractValidator<CreateTenantCommand>
{
    public CreateTenantValidator()
    {
        RuleFor(x => x.Name).NotEmpty();
        RuleFor(x => x.TenantType).NotEmpty();
        RuleFor(x => x.Email).NotEmpty();
        RuleFor(x => x.Phone).NotEmpty();
        RuleFor(x => x.Nationality).NotEmpty();
    }
}

public sealed record DeleteTenantCommand(Guid Id) : ICommand;
