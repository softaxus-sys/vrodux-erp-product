using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Domain.Entities;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Application.Billing.Commands;

/// <summary>
/// Claim the 30-day free trial from the billing page.
///
/// <para>
/// Only reachable by a tenant that signed up through a "Buy Now" link and never paid — those
/// accounts get no trial up front, so this is their self-rescue if they change their mind at the
/// card form. Without it, an abandoned purchase would be a dead account needing support.
/// </para>
/// </summary>
public sealed record StartTrialCommand : ICommand;

public sealed class StartTrialCommandHandler(
    ITenantContext           tenantCtx,
    ITenantRepository        tenantRepo,
    ISubscriptionAccessCache accessCache,
    IUnitOfWork              uow)
    : ICommandHandler<StartTrialCommand>
{
    public async Task<Result> Handle(StartTrialCommand cmd, CancellationToken ct)
    {
        if (!tenantCtx.TenantId.HasValue)
            return Result.Failure(Error.Custom("Billing.NoTenant", "Billing is only available to tenant accounts."));

        var tenant = await tenantRepo.GetByIdAsync(tenantCtx.TenantId.Value, ct);
        if (tenant is null)
            return Result.Failure(Error.NotFoundById(nameof(Tenant), tenantCtx.TenantId.Value));

        // Guarded on the aggregate: a tenant that has already had a trial (or is past this stage)
        // must not be able to mint another one by replaying this call.
        if (!tenant.CanStartTrial)
            return Result.Failure(Error.Custom(
                "Billing.TrialUnavailable",
                "A free trial isn't available on this account. Choose a plan to continue."));

        tenant.StartTrial(30);
        await uow.SaveChangesAsync(ct);

        // Drop the cached "blocked" decision so access resumes on the next request rather than
        // after the middleware's 60s TTL.
        accessCache.Invalidate(tenant.Id);

        return Result.Success();
    }
}
