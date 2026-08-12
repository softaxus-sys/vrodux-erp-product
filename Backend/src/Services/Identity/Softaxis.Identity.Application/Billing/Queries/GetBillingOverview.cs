using Microsoft.Extensions.Options;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Application.Billing.Dtos;
using Softaxis.Identity.Domain.Entities;
using Softaxis.Identity.Domain.Enums;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Application.Billing.Queries;

/// <summary>Everything the billing page needs, for the caller's own tenant (taken from the JWT).</summary>
public sealed record GetBillingOverviewQuery : IQuery<BillingOverviewDto>;

public sealed class GetBillingOverviewQueryHandler(
    ITenantContext           tenantCtx,
    ITenantRepository        tenantRepo,
    ISubscriptionRepository  subRepo,
    IUserRepository          userRepo,
    IEnumerable<IBillingProvider> providers)
    : IQueryHandler<GetBillingOverviewQuery, BillingOverviewDto>
{
    public async Task<Result<BillingOverviewDto>> Handle(GetBillingOverviewQuery query, CancellationToken ct)
    {
        if (!tenantCtx.TenantId.HasValue)
            return Result.Failure<BillingOverviewDto>(Error.Custom(
                "Billing.NoTenant", "Billing is only available to tenant accounts."));

        var tenantId = tenantCtx.TenantId.Value;
        var tenant   = await tenantRepo.GetByIdAsync(tenantId, ct);
        if (tenant is null)
            return Result.Failure<BillingOverviewDto>(Error.NotFoundById(nameof(Tenant), tenantId));

        var subscription = await subRepo.GetByTenantAsync(tenantId, ct);
        var limits       = PlanDefinitions.Get(tenant.Plan);
        var usersInUse   = await userRepo.CountByTenantAsync(tenantId, ct);

        var planOptions = PlanDefinitions.All
            .Select(kvp =>
            {
                var pricing = PlanDefinitions.PriceOf(kvp.Key);
                return new PlanOptionDto(
                    Id:                kvp.Key.ToString().ToLowerInvariant(),
                    Name:              kvp.Key.ToString(),
                    Label:             kvp.Key.ToString(),
                    MonthlyUsd:        pricing.MonthlyUsd,
                    AnnualUsdPerMonth: pricing.AnnualUsdPerMonth,
                    AnnualUsdTotal:    pricing.AnnualUsdTotal,
                    MaxUsers:          kvp.Value.MaxUsers,
                    SelfServe:         PlanDefinitions.SelfServePlans.Contains(kvp.Key),
                    IsCurrent:         kvp.Key == tenant.Plan,
                    Modules:           kvp.Value.Modules);
            })
            .ToList();

        // Only advertise providers with real credentials — offering a payment button that
        // 500s on click is worse than not showing it.
        var available = providers.Where(p => p.IsConfigured)
                                 .Select(p => p.Provider.ToString())
                                 .ToList();

        return Result.Success(new BillingOverviewDto(
            TenantId:           tenant.Id,
            TenantName:         tenant.Name,
            Plan:               tenant.Plan.ToString(),
            PlanLabel:          tenant.Plan.ToString(),
            TenantStatus:       tenant.Status.ToString(),
            TrialEndsAt:        tenant.TrialEndsAt,
            TrialDaysRemaining: tenant.TrialDaysRemaining,
            HasProductAccess:   tenant.HasProductAccess,
            UsersInUse:         usersInUse,
            MaxUsers:           limits.MaxUsers,
            Subscription:       subscription is null ? null : ToDto(subscription),
            Plans:              planOptions,
            AvailableProviders: available));
    }

    internal static SubscriptionDto ToDto(Subscription s) => new(
        Id:                 s.Id,
        Plan:               s.Plan.ToString(),
        BillingPeriod:      s.BillingPeriod.ToString(),
        Status:             s.Status.ToString(),
        Provider:           s.Provider.ToString(),
        Amount:             s.Amount,
        Currency:           s.Currency,
        CurrentPeriodStart: s.CurrentPeriodStart,
        CurrentPeriodEnd:   s.CurrentPeriodEnd,
        CancelAtPeriodEnd:  s.CancelAtPeriodEnd,
        CanceledAt:         s.CanceledAt,
        GrantsAccess:       s.GrantsAccess);
}

/// <summary>Billing history for the caller's tenant.</summary>
public sealed record GetInvoicesQuery : IQuery<IReadOnlyList<InvoiceDto>>;

public sealed class GetInvoicesQueryHandler(
    ITenantContext          tenantCtx,
    ISubscriptionRepository subRepo)
    : IQueryHandler<GetInvoicesQuery, IReadOnlyList<InvoiceDto>>
{
    public async Task<Result<IReadOnlyList<InvoiceDto>>> Handle(GetInvoicesQuery query, CancellationToken ct)
    {
        if (!tenantCtx.TenantId.HasValue)
            return Result.Failure<IReadOnlyList<InvoiceDto>>(Error.Custom(
                "Billing.NoTenant", "Billing is only available to tenant accounts."));

        var invoices = await subRepo.GetInvoicesAsync(tenantCtx.TenantId.Value, ct);

        IReadOnlyList<InvoiceDto> dtos = invoices.Select(i => new InvoiceDto(
            Id:                i.Id,
            Provider:          i.Provider.ToString(),
            ProviderInvoiceId: i.ProviderInvoiceId,
            Amount:            i.Amount,
            Currency:          i.Currency,
            Status:            i.Status.ToString(),
            PeriodStart:       i.PeriodStart,
            PeriodEnd:         i.PeriodEnd,
            PaidAt:            i.PaidAt,
            HostedInvoiceUrl:  i.HostedInvoiceUrl,
            InvoicePdfUrl:     i.InvoicePdfUrl,
            CreatedAt:         i.CreatedAt)).ToList();

        return Result.Success(dtos);
    }
}
