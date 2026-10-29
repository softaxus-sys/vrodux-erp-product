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
            return Result.Success(await CreditView.BuildAsync(db, credits, options, ct));
        }
        finally
        {
            if (previous.IsResolved) TenantAmbient.Set(previous.TenantId, previous.IsSuperAdmin, true);
            else TenantAmbient.Clear();
        }
    }
}
