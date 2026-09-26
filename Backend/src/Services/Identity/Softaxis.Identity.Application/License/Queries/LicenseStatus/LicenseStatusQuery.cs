using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Application.License.Dtos;
using Softaxis.Identity.Domain.Enums;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Application.License.Queries.LicenseStatus;

/// <summary>
/// Whether this installation is licensed, and until when. Served anonymously so the activation
/// screen can explain itself to someone who cannot sign in — which is the whole situation it
/// exists for.
/// </summary>
public sealed record LicenseStatusQuery : IQuery<LicenseStatusDto>;

public sealed class LicenseStatusQueryHandler(ITenantRepository tenantRepo, ILicenseService licenseService)
    : IQueryHandler<LicenseStatusQuery, LicenseStatusDto>
{
    public async Task<Result<LicenseStatusDto>> Handle(LicenseStatusQuery _, CancellationToken ct)
    {
        var tenants = await tenantRepo.GetAllAsync(ct);

        // An on-premises box holds exactly one licensed workspace — the one adopted from its key.
        // A cloud deployment holds many, and none of them are licensed this way, so it answers
        // "not on-premises" and the screen says the page does not apply here.
        var tenant = tenants.FirstOrDefault(t => t.DeploymentType == DeploymentType.OnPremises && !t.IsMirror);

        if (tenant is null)
            return Result.Success(new LicenseStatusDto(
                IsOnPremises: false, Licensed: false, ExpiresAt: null, DaysLeft: null, Expired: false,
                // A fresh on-prem box has no tenant yet but still needs its code to get a key;
                // the cloud keeps its own code to itself.
                MachineCode: licenseService.IsOnPremisesInstall ? licenseService.ThisMachineCode : null));

        var expiry   = tenant.LicenseExpiresAt;
        var licensed = !string.IsNullOrWhiteSpace(tenant.LicenseKey) && expiry.HasValue;
        var expired  = licensed && expiry!.Value < DateTime.UtcNow;

        return Result.Success(new LicenseStatusDto(
            IsOnPremises: true,
            Licensed:     licensed,
            ExpiresAt:    expiry,
            DaysLeft:     expiry is { } e ? (int)Math.Max(0, Math.Ceiling((e - DateTime.UtcNow).TotalDays)) : null,
            Expired:      expired,
            // Only an on-premises server publishes its code. A cloud database can still hold an
            // OnPremises tenant row (issued for a customer's box), which must not make the cloud
            // server reveal its own ID.
            MachineCode:  licenseService.IsOnPremisesInstall ? licenseService.ThisMachineCode : null));
    }
}
