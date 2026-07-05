using Softaxis.Identity.Application.DTOs;
using Softaxis.Identity.Domain.Entities;

namespace Softaxis.Identity.Application.TenantsAdmin;

internal static class TenantMappings
{
    public static TenantDto ToDto(Tenant t) => new(
        Id:               t.Id,
        Name:             t.Name,
        Slug:             t.Slug,
        Plan:             t.Plan.ToString(),
        DeploymentType:   t.DeploymentType.ToString(),
        Status:           t.Status.ToString(),
        ContactEmail:     t.ContactEmail,
        ContactPhone:     t.ContactPhone,
        Country:          t.Country,
        PrimaryColor:     t.PrimaryColor,
        Industry:         t.Industry,
        Currency:         t.Currency,
        HasLicenseKey:    t.LicenseKey is not null,
        LicenseExpiresAt: t.LicenseExpiresAt,
        LastHeartbeatAt:  t.LastHeartbeatAt,
        TrialEndsAt:      t.TrialEndsAt,
        MaxUsers:         t.Limits.MaxUsers,
        MaxWarehouses:    t.Limits.MaxWarehouses,
        ResolvedModules:  t.ResolvedModules,
        CreatedAt:        t.CreatedAt);
}
