using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Application.DTOs;
using Softaxis.Identity.Domain.Enums;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Application.TenantsAdmin.Commands.GenerateTenantLicense;

public sealed class GenerateTenantLicenseCommandHandler(
    ITenantRepository tenantRepo,
    ILicenseService   licenseService,
    IUnitOfWork       uow)
    : ICommandHandler<GenerateTenantLicenseCommand, GenerateLicenseResponse>
{
    public async Task<Result<GenerateLicenseResponse>> Handle(GenerateTenantLicenseCommand cmd, CancellationToken ct)
    {
        var tenant = await tenantRepo.GetByIdAsync(cmd.Id, ct);
        if (tenant is null)
            return Result.Failure<GenerateLicenseResponse>(Error.NotFoundById("Tenant", cmd.Id));

        if (tenant.DeploymentType != DeploymentType.OnPremises)
            return Result.Failure<GenerateLicenseResponse>(Error.Custom(
                "Tenant.NotOnPrem", "License keys are only for on-premises deployments."));

        var expiresAt = DateTime.UtcNow.AddDays(cmd.ValidityDays);
        var limits    = tenant.Limits;

        var payload = new LicensePayload(
            TenantId:   tenant.Id,
            TenantSlug: tenant.Slug,
            Plan:       tenant.Plan.ToString(),
            MaxUsers:   limits.MaxUsers,
            Features:   cmd.Features,
            IssuedAt:   DateTime.UtcNow,
            ExpiresAt:  expiresAt);

        var key = licenseService.GenerateLicenseKey(payload);
        tenant.SetLicenseKey(key, expiresAt);
        tenantRepo.Update(tenant);
        await uow.SaveChangesAsync(ct);

        return Result.Success(new GenerateLicenseResponse(key, expiresAt));
    }
}
