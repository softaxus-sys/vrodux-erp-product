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
    IReadOnlyList<string>? Modules,
    string? AdminEmail,
    string? AdminUsername,
    string? AdminFirstName,
    string? AdminLastName,
    string? AdminPassword,
    // Creates this workspace as the READ-ONLY cloud mirror of an on-premises installation: it
    // accepts no writes and runs no tenant-scoped background jobs, because the shop does both.
    // The on-premises box then adopts this tenant's id via its license key.
    // docs/on-premises-cloud-mirror.md
    bool    IsMirror = false) : ICommand<TenantDto>;

public sealed class CreateTenantValidator : AbstractValidator<CreateTenantCommand>
{
    public CreateTenantValidator()
    {
        RuleFor(x => x.Name).NotEmpty().WithMessage("Name and slug are required.");
        RuleFor(x => x.Slug).NotEmpty().WithMessage("Name and slug are required.");
    }
}
