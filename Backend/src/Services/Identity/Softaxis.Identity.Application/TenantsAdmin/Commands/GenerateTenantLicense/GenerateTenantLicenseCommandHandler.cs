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

        // Accept the code however it was typed; store the canonical XXXX-XXXX-XXXX-XXXX form.
        string? machineId = null;
        var digits = new string((cmd.MachineCode ?? "").Where(char.IsLetterOrDigit).Select(char.ToUpperInvariant).ToArray());
        if (digits.Length > 0)
        {
            if (digits.Length != 16 || !digits.All(Uri.IsHexDigit))
                return Result.Failure<GenerateLicenseResponse>(Error.Custom("Validation.Failed",
                    "The machine code should look like 1A2B-3C4D-5E6F-7A8B (16 characters)."));
            machineId = $"{digits[..4]}-{digits[4..8]}-{digits[8..12]}-{digits[12..]}";
        }

        var expiresAt = DateTime.UtcNow.AddDays(cmd.ValidityDays);
        var limits    = tenant.Limits;

        var payload = new LicensePayload(
            TenantId:   tenant.Id,
            TenantSlug: tenant.Slug,
            Plan:       tenant.Plan.ToString(),
            MaxUsers:   limits.MaxUsers,
            Features:   cmd.Features,
            IssuedAt:   DateTime.UtcNow,
            ExpiresAt:  expiresAt,
            MachineId:  machineId);

        var key = licenseService.GenerateLicenseKey(payload);
        tenant.SetLicenseKey(key, expiresAt);
        tenantRepo.Update(tenant);
        await uow.SaveChangesAsync(ct);

        return Result.Success(new GenerateLicenseResponse(key, expiresAt));
    }
}
