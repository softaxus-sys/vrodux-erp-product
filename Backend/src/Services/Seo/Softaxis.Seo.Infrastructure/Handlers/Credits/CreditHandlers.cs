using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Seo.Application.Abstractions;
using Softaxis.Seo.Application.Credits;
using Softaxis.Seo.Domain.Entities;
using Softaxis.Seo.Infrastructure.Credits;
using Softaxis.Seo.Infrastructure.Crawl;
using Softaxis.Seo.Infrastructure.Persistence;

namespace Softaxis.Seo.Infrastructure.Handlers.Credits;

internal static class CreditView
{
    public static async Task<SeoCreditsDto> BuildAsync(SeoDbContext db, ISeoCreditService credits, SeoOptions options, CancellationToken ct)
    {
        var w = await credits.EnsureWalletAsync(ct);
        var recent = await db.CreditLedger.AsNoTracking().OrderByDescending(l => l.CreatedAt).Take(30)
            .Select(l => new CreditEntryDto(l.Id, l.Type, l.Amount, l.BalanceAfter, l.Reason, l.ActorName, l.CreatedAt)).ToListAsync(ct);
        return new SeoCreditsDto(w.Balance, w.LifetimeAdded, w.LifetimeSpent, options.PagesPerCredit, options.MaxPagesPerAudit, recent);
    }
}

internal sealed class GetSeoCreditsHandler(SeoDbContext db, ISeoCreditService credits, SeoOptions options) : IQueryHandler<GetSeoCreditsQuery, SeoCreditsDto>
{
    public async Task<Result<SeoCreditsDto>> Handle(GetSeoCreditsQuery q, CancellationToken ct) =>
        Result.Success(await CreditView.BuildAsync(db, credits, options, ct));
}

internal sealed class AdminGrantSeoCreditsHandler(SeoDbContext db, ISeoCreditService credits, SeoOptions options, ICurrentUser user)
    : ICommandHandler<AdminGrantSeoCreditsCommand, SeoCreditsDto>
{
    public async Task<Result<SeoCreditsDto>> Handle(AdminGrantSeoCreditsCommand cmd, CancellationToken ct)
    {
        // Work inside the target workspace for the duration of the grant, then step back out.
        var previous = (TenantAmbient.IsResolved, TenantAmbient.TenantId, TenantAmbient.IsSuperAdmin);
        try
        {
            TenantAmbient.Set(cmd.TenantId, isSuperAdmin: false, isResolved: true);
            await credits.EnsureWalletAsync(ct);
            var type = cmd.Amount > 0 ? SeoCreditTypes.Grant : SeoCreditTypes.Adjustment;
            var res = await credits.AddAsync(cmd.Amount, type, $"{cmd.Reason} (by {user.Username ?? "platform admin"})", "admin", null, $"admin:{Guid.NewGuid()}", ct);
            if (!res.Ok) return Result.Failure<SeoCreditsDto>(Error.Custom("Credits.Conflict", "That would take the balance below zero."));
            // Read only: looking at a workspace must not create its wallet or hand it the welcome credits.
            var w = await db.Wallets.AsNoTracking().FirstOrDefaultAsync(ct);
            var recent = await db.CreditLedger.AsNoTracking().OrderByDescending(l => l.CreatedAt).Take(30)
                .Select(l => new CreditEntryDto(l.Id, l.Type, l.Amount, l.BalanceAfter, l.Reason, l.ActorName, l.CreatedAt)).ToListAsync(ct);
            return Result.Success(new SeoCreditsDto(w?.Balance ?? 0, w?.LifetimeAdded ?? 0, w?.LifetimeSpent ?? 0, options.PagesPerCredit, options.MaxPagesPerAudit, recent));
        }
        finally
        {
            if (previous.IsResolved) TenantAmbient.Set(previous.TenantId, previous.IsSuperAdmin, true);
            else TenantAmbient.Clear();
        }
    }
}

internal sealed class AdminSeoCreditsOverviewHandler(SeoDbContext db) : IQueryHandler<AdminSeoCreditsOverviewQuery, IReadOnlyList<AdminSeoWalletDto>>
{
    public async Task<Result<IReadOnlyList<AdminSeoWalletDto>>> Handle(AdminSeoCreditsOverviewQuery q, CancellationToken ct)
    {
        // The platform owner has no workspace context, so the tenant filter is lifted for this one read; the endpoint is SuperAdminOnly.
        var rows = await db.Wallets.IgnoreQueryFilters().AsNoTracking()
            .Select(w => new { TenantId = EF.Property<Guid?>(w, "TenantId"), w.Balance, w.LifetimeAdded, w.LifetimeSpent, w.UpdatedAt })
            .Where(x => x.TenantId != null)
            .ToListAsync(ct);
        return Result.Success<IReadOnlyList<AdminSeoWalletDto>>(rows.Select(x => new AdminSeoWalletDto(x.TenantId!.Value, x.Balance, x.LifetimeAdded, x.LifetimeSpent, x.UpdatedAt)).ToList());
    }
}

internal sealed class AdminTenantSeoCreditsHandler(SeoDbContext db, SeoOptions options) : IQueryHandler<AdminTenantSeoCreditsQuery, SeoCreditsDto>
{
    public async Task<Result<SeoCreditsDto>> Handle(AdminTenantSeoCreditsQuery q, CancellationToken ct)
    {
        var previous = (TenantAmbient.IsResolved, TenantAmbient.TenantId, TenantAmbient.IsSuperAdmin);
        try
        {
            TenantAmbient.Set(q.TenantId, isSuperAdmin: false, isResolved: true);
            // Read only: looking at a workspace must not create its wallet or hand it the welcome credits.
            var w = await db.Wallets.AsNoTracking().FirstOrDefaultAsync(ct);
            var recent = await db.CreditLedger.AsNoTracking().OrderByDescending(l => l.CreatedAt).Take(30)
                .Select(l => new CreditEntryDto(l.Id, l.Type, l.Amount, l.BalanceAfter, l.Reason, l.ActorName, l.CreatedAt)).ToListAsync(ct);
            return Result.Success(new SeoCreditsDto(w?.Balance ?? 0, w?.LifetimeAdded ?? 0, w?.LifetimeSpent ?? 0, options.PagesPerCredit, options.MaxPagesPerAudit, recent));
        }
        finally
        {
            if (previous.IsResolved) TenantAmbient.Set(previous.TenantId, previous.IsSuperAdmin, true);
            else TenantAmbient.Clear();
        }
    }
}
