using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Application.DTOs;
using Softaxis.Identity.Domain.Entities;
using Softaxis.Identity.Domain.Enums;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Application.TenantsAdmin.Commands.CreateTenant;

public sealed class CreateTenantCommandHandler(
    ITenantRepository      tenantRepo,
    IUserRepository        userRepo,
    ITenantRoleProvisioner roleProvisioner,
    IPasswordHasher        passwordHasher,
    IUnitOfWork            uow)
    : ICommandHandler<CreateTenantCommand, TenantDto>
{
    public async Task<Result<TenantDto>> Handle(CreateTenantCommand cmd, CancellationToken ct)
    {
        if (!Enum.TryParse<PlanType>(cmd.Plan, ignoreCase: true, out var plan))
            return Result.Failure<TenantDto>(Error.Custom("Tenant.InvalidPlan", $"Unknown plan: {cmd.Plan}"));

        if (!Enum.TryParse<DeploymentType>(cmd.DeploymentType, ignoreCase: true, out var deployment))
            return Result.Failure<TenantDto>(Error.Custom("Tenant.InvalidDeployment", $"Unknown deployment type: {cmd.DeploymentType}"));

        if (await tenantRepo.SlugExistsAsync(cmd.Slug, ct))
            return Result.Failure<TenantDto>(Error.Custom("Tenant.Slug.Taken", "A tenant with this slug already exists."));

        var tenant = Tenant.Create(cmd.Name, cmd.Slug, plan, deployment, cmd.ContactEmail, cmd.Country, cmd.Industry);

        if (cmd.StartTrial)
            tenant.StartTrial(30);
        else
            tenant.Activate();

        tenantRepo.Add(tenant);

        // ── Optionally provision the tenant's first admin user ───────────────────
        var wantAdmin = !string.IsNullOrWhiteSpace(cmd.AdminEmail) ||
                        !string.IsNullOrWhiteSpace(cmd.AdminPassword);
        if (wantAdmin)
        {
            if (string.IsNullOrWhiteSpace(cmd.AdminEmail) ||
                string.IsNullOrWhiteSpace(cmd.AdminPassword) ||
                string.IsNullOrWhiteSpace(cmd.AdminUsername))
                return Result.Failure<TenantDto>(Error.Custom(
                    "Tenant.Admin.Invalid",
                    "Admin email, username and password are required to create the tenant admin user."));

            if (await userRepo.EmailExistsAsync(cmd.AdminEmail, ct))
                return Result.Failure<TenantDto>(Error.Custom("User.Email.Taken", "Admin email is already registered."));

            if (await userRepo.UsernameExistsAsync(cmd.AdminUsername, ct))
                return Result.Failure<TenantDto>(Error.Custom("User.Username.Taken", "Admin username is already taken."));

            var userResult = User.Create(
                cmd.AdminEmail,
                cmd.AdminUsername,
                string.IsNullOrWhiteSpace(cmd.AdminFirstName) ? "Tenant" : cmd.AdminFirstName!,
                string.IsNullOrWhiteSpace(cmd.AdminLastName)  ? "Admin"  : cmd.AdminLastName!,
                passwordHasher.Hash(cmd.AdminPassword));

            if (userResult.IsFailure)
                return Result.Failure<TenantDto>(userResult.Error);

            var adminUser = userResult.Value;
            adminUser.VerifyEmail();          // pre-verified
            adminUser.SetTenant(tenant.Id);   // bind to the new tenant

            // Provision this tenant's own role set (Administrator + per-module Managers).
            var adminRole = await roleProvisioner.ProvisionAsync(tenant.Id, tenant.ResolvedModules, ct);
            adminUser.AssignRole(adminRole.Id);

            userRepo.Add(adminUser);
        }

        await uow.SaveChangesAsync(ct);

        return Result.Success(TenantMappings.ToDto(tenant));
    }
}
