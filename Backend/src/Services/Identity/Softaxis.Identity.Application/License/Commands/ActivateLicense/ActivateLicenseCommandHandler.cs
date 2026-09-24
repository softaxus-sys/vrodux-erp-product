using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Application.License.Dtos;
using Softaxis.Identity.Domain.Enums;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Application.License.Commands.ActivateLicense;

public sealed class ActivateLicenseCommandHandler(
    ITenantRepository        tenantRepo,
    ILicenseService          licenseService,
    ISubscriptionAccessCache accessCache,
    IUnitOfWork              uow,
    ILogger<ActivateLicenseCommandHandler> logger)
    : ICommandHandler<ActivateLicenseCommand, LicenseActivationDto>
{
    public async Task<Result<LicenseActivationDto>> Handle(ActivateLicenseCommand cmd, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(cmd.LicenseKey))
            return Fail("License.Invalid", "Paste the license key you were sent.");

        // Verifies the RSA signature and the expiry. A key that is already expired is refused here
        // rather than installed and found dead on the next request.
        var payload = licenseService.ValidateLicenseKey(cmd.LicenseKey.Trim());
        if (payload is null)
            return Fail("License.Invalid",
                "That key is not valid for this product, or it has already expired. Check it was " +
                "pasted whole, then contact Softaxis for a replacement.");

        var tenant = await tenantRepo.GetByIdAsync(payload.TenantId, ct);

        // The key names a workspace this installation has never heard of. Almost always a key for
        // a different customer's site, pasted into the wrong server.
        if (tenant is null)
            return Fail("License.Forbidden",
                "That key belongs to a different installation. Check you were sent the key for " +
                "this site.");

        // A cloud workspace is billed by subscription, not licensed. Letting a pasted key set its
        // plan and modules would route around billing entirely.
        if (tenant.DeploymentType != DeploymentType.OnPremises)
            return Fail("License.Forbidden",
                "This workspace is hosted by Softaxis and is managed from its billing page, not " +
                "by a license key.");

        // The mirror is a read-only reflection of a shop's own server. It must never take its
        // entitlement from a key pasted into it - the shop is the system of record.
        if (tenant.IsMirror)
            return Fail("License.Forbidden",
                "This is the read-only cloud copy of an on-premises installation. Activate the " +
                "license on the shop's own server.");

        var previousExpiry = tenant.LicenseExpiresAt;
        var replaced       = !string.Equals(tenant.LicenseKey, cmd.LicenseKey.Trim(), StringComparison.Ordinal);

        tenant.SetLicenseKey(cmd.LicenseKey.Trim(), payload.ExpiresAt);

        // The key is the entitlement, so a new one re-asserts what was sold - the same rule the
        // startup adoption path follows. Without this, paying to add a module would extend the
        // expiry and change nothing else.
        if (Enum.TryParse<PlanType>(payload.Plan, ignoreCase: true, out var plan) && tenant.Plan != plan)
        {
            logger.LogInformation(
                "License activation: plan for workspace {TenantId} moved {Old} -> {New}.",
                tenant.Id, tenant.Plan, plan);
            tenant.ChangePlan(plan);
        }

        var modules = (payload.Features ?? [])
            .Where(f => !string.IsNullOrWhiteSpace(f))
            .Select(f => f.Trim().ToLowerInvariant())
            .Distinct()
            .ToList();

        // A manual grant, not a plan-bound list: the key decides what this site runs, so it must
        // not be re-filtered by the plan ceiling. Otherwise a Starter site licensed for POS loses
        // POS, because "pos" lives only in the Professional ceiling.
        if (modules.Count > 0)
            tenant.GrantModulesManually(modules);

        // An installation blocked on an expired license is Expired/Suspended in the DB too. The new
        // key is the payment, so put it back in service rather than leaving it blocked by status
        // after the licence check starts passing.
        if (tenant.Status is TenantStatus.Expired or TenantStatus.Suspended or TenantStatus.PendingPayment)
            tenant.Activate();

        tenantRepo.Update(tenant);
        await uow.SaveChangesAsync(ct);

        // The middleware caches its decision for 60s. Without this the shop stays locked out for up
        // to a minute after activating - long enough for someone to conclude it did not work and
        // paste the key again.
        accessCache.Invalidate(tenant.Id);

        logger.LogInformation(
            "License activated for workspace {TenantId}: expires {Expiry:u} (was {Previous:u}), plan {Plan}, {ModuleCount} module(s).",
            tenant.Id, payload.ExpiresAt, previousExpiry, payload.Plan, modules.Count);

        return Result.Success(new LicenseActivationDto(
            Activated:    true,
            AlreadyInUse: !replaced,
            TenantName:   tenant.Name,
            Plan:         payload.Plan,
            MaxUsers:     payload.MaxUsers,
            Modules:      modules,
            ExpiresAt:    payload.ExpiresAt,
            DaysLeft:     (int)Math.Max(0, Math.Ceiling((payload.ExpiresAt - DateTime.UtcNow).TotalDays))));
    }

    private static Result<LicenseActivationDto> Fail(string code, string message) =>
        Result.Failure<LicenseActivationDto>(Error.Custom(code, message));
}
