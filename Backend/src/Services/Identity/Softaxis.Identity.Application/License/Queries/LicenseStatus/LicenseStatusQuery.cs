using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
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

public sealed class LicenseStatusQueryHandler(ITenantRepository tenantRepo)
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
                IsOnPremises: false, Licensed: false, ExpiresAt: null, DaysLeft: null, Expired: false));

        var expiry   = tenant.LicenseExpiresAt;
        var licensed = !string.IsNullOrWhiteSpace(tenant.LicenseKey) && expiry.HasValue;
        var expired  = licensed && expiry!.Value < DateTime.UtcNow;

        return Result.Success(new LicenseStatusDto(
            IsOnPremises: true,
            Licensed:     licensed,
            ExpiresAt:    expiry,
            DaysLeft:     expiry is { } e ? (int)Math.Max(0, Math.Ceiling((e - DateTime.UtcNow).TotalDays)) : null,
            Expired:      expired));
    }
}
