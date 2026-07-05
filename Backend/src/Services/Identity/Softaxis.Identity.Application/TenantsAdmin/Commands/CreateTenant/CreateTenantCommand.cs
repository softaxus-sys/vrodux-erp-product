using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Identity.Application.DTOs;

namespace Softaxis.Identity.Application.TenantsAdmin.Commands.CreateTenant;

public sealed record CreateTenantCommand(
    string  Name,
    string  Slug,
    string  Plan,
    string  DeploymentType,
    string? ContactEmail,
    string? Country,
    string? Industry,
    string? Currency,
    bool    StartTrial,
    string? AdminEmail,
    string? AdminUsername,
    string? AdminFirstName,
    string? AdminLastName,
    string? AdminPassword) : ICommand<TenantDto>;

public sealed class CreateTenantValidator : AbstractValidator<CreateTenantCommand>
{
    public CreateTenantValidator()
    {
        RuleFor(x => x.Name).NotEmpty().WithMessage("Name and slug are required.");
        RuleFor(x => x.Slug).NotEmpty().WithMessage("Name and slug are required.");
    }
}
