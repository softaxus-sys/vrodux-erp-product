using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.LeadGen.Application.Credits;
using Softaxis.LeadGen.Domain.Entities;
using Softaxis.LeadGen.Infrastructure.Persistence;
using Softaxis.LeadGen.Infrastructure.Services;

namespace Softaxis.LeadGen.Infrastructure.Handlers.Admin;

/// <summary>
/// Platform-wide view for the super admin: how much credit is out there, what the data provider is
/// costing us, how healthy sending is, and which workspaces use it most. Reads across workspaces —
/// possible only because the super admin's ambient context bypasses the tenant filter; the endpoint
/// itself is restricted to the SuperAdminOnly policy.
/// </summary>
internal sealed class AdminOverviewHandler(LeadGenDbContext db, ITenantInfoReader tenants) : IQueryHandler<AdminOverviewQuery, AdminOverviewDto>
{
    public async Task<Result<AdminOverviewDto>> Handle(AdminOverviewQuery q, CancellationToken ct)
    {
        var since = DateTime.UtcNow.AddDays(-30);

        var wallets = await db.Wallets.AsNoTracking().Select(w => new { Tenant = EF.Property<Guid?>(w, "TenantId"), w.Balance, w.LifetimePurchased, w.LifetimeSpent }).ToListAsync(ct);
        var requests = await db.Searches.AsNoTracking().Where(s => s.CreatedAt >= since).SumAsync(s => (int?)s.RequestsMade, ct) ?? 0;
        var sent = await db.Messages.AsNoTracking().CountAsync(m => m.Direction == MessageDirection.Out && m.Status == MessageStatus.Sent && m.OccurredAt >= since, ct);
        var bounced = await db.Messages.AsNoTracking().CountAsync(m => m.Direction == MessageDirection.Out && m.Status == MessageStatus.Bounced && m.OccurredAt >= since, ct);
        var replies = await db.Messages.AsNoTracking().CountAsync(m => m.Direction == MessageDirection.In && m.OccurredAt >= since, ct);
        var paused = await db.Mailboxes.AsNoTracking().CountAsync(m => !m.IsDeleted && m.Status == MailboxStatus.Paused, ct);
        var pool = await db.Directory.AsNoTracking().CountAsync(ct);
        var enriched = await db.Directory.AsNoTracking().CountAsync(d => d.EnrichedAt != null, ct);

        var perTenant = new Dictionary<Guid, AdminTenantUsageDto>();
        foreach (var w in wallets.Where(w => w.Tenant != null))
            perTenant[w.Tenant!.Value] = new AdminTenantUsageDto(w.Tenant.Value, null, w.Balance, w.LifetimePurchased, w.LifetimeSpent, 0, 0, 0, 0, 0, 0, 0, null);

        async Task<Dictionary<Guid, int>> Count<T>(IQueryable<T> source, System.Linq.Expressions.Expression<Func<T, Guid?>> tenant) where T : class =>
            (await source.GroupBy(tenant).Select(g => new { g.Key, N = g.Count() }).ToListAsync(ct)).Where(x => x.Key != null).ToDictionary(x => x.Key!.Value, x => x.N);

        var searches = await Count(db.Searches.AsNoTracking().Where(s => !s.IsDeleted), s => EF.Property<Guid?>(s, "TenantId"));
        var prospects = await Count(db.Prospects.AsNoTracking().Where(p => !p.IsDeleted), p => EF.Property<Guid?>(p, "TenantId"));
        var revealed = await Count(db.Prospects.AsNoTracking().Where(p => !p.IsDeleted && p.IsRevealed), p => EF.Property<Guid?>(p, "TenantId"));
        var boxes = await Count(db.Mailboxes.AsNoTracking().Where(m => !m.IsDeleted), m => EF.Property<Guid?>(m, "TenantId"));
        var camps = await Count(db.Campaigns.AsNoTracking().Where(c => !c.IsDeleted), c => EF.Property<Guid?>(c, "TenantId"));
        var sentBy = await Count(db.Messages.AsNoTracking().Where(m => m.Direction == MessageDirection.Out && m.Status == MessageStatus.Sent && m.OccurredAt >= since), m => EF.Property<Guid?>(m, "TenantId"));
        var bouncedBy = await Count(db.Messages.AsNoTracking().Where(m => m.Direction == MessageDirection.Out && m.Status == MessageStatus.Bounced && m.OccurredAt >= since), m => EF.Property<Guid?>(m, "TenantId"));

        var top = new List<AdminTenantUsageDto>();
        foreach (var (id, u) in perTenant.OrderByDescending(p => p.Value.LifetimeSpent).ThenByDescending(p => prospects.GetValueOrDefault(p.Key)).Take(15))
        {
            var info = await tenants.GetAsync(id, ct);
            top.Add(u with
            {
                TenantName = info?.Name, Searches = searches.GetValueOrDefault(id), Prospects = prospects.GetValueOrDefault(id),
                Revealed = revealed.GetValueOrDefault(id), Mailboxes = boxes.GetValueOrDefault(id), Campaigns = camps.GetValueOrDefault(id),
                Sent30d = sentBy.GetValueOrDefault(id), Bounced30d = bouncedBy.GetValueOrDefault(id),
            });
        }

        return Result.Success(new AdminOverviewDto(
            wallets.Count, wallets.Sum(w => w.Balance), wallets.Sum(w => w.LifetimePurchased), wallets.Sum(w => w.LifetimeSpent),
            requests, sent, bounced, replies, paused, pool, enriched, top));
    }
}
