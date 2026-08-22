using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Reports.Dtos;
using Softaxis.CRM.Application.Reports.Queries;
using Softaxis.CRM.Infrastructure.Persistence;
using Softaxis.CRM.Infrastructure.Services;
using static Softaxis.CRM.Infrastructure.Handlers.Reports.ReportQueryHelpers;

namespace Softaxis.CRM.Infrastructure.Handlers.Reports;

/// <summary>
/// Revenue and open pipeline rolled up per account — who your best customers actually are.
/// <para>
/// Won value is summed from linked opportunities (<c>Deal.CustomerId</c>), which is the trustworthy
/// figure. <c>RecordedRevenue</c> is the account's own <c>TotalRevenue</c> field, reported alongside
/// rather than merged: it is manually maintained and often disagrees with the deal data, and quietly
/// picking one over the other would hide that.
/// </para>
/// Dates apply to deal close date; open pipeline is a point-in-time snapshot.
/// </summary>
internal sealed class GetAccountRevenueReportHandler(CrmDbContext db, ILeadAccessGuard access)
    : IQueryHandler<GetAccountRevenueReportQuery, AccountRevenueReportDto>
{
    public async Task<Result<AccountRevenueReportDto>> Handle(GetAccountRevenueReportQuery query, CancellationToken ct)
    {
        var f = query.Filter;

        var accountQuery = access.ScopeCustomers(db.Customers.AsNoTracking()).Where(c => !c.IsDeleted);
        if (f.CustomerId is Guid cid) accountQuery = accountQuery.Where(c => c.Id == cid);

        var accounts = await accountQuery
            .Select(c => new
            {
                c.Id, c.Name, c.Industry, c.Tier, c.AccountManager, c.TotalRevenue, c.LastActivity
            })
            .ToListAsync(ct);

        var dealBase = ApplyDealFilters(access.ScopeDeals(db.Deals.AsNoTracking()), f)
            .Where(d => d.CustomerId != null);

        var openDeals = await dealBase.Where(d => d.Stage != "won" && d.Stage != "lost")
            .Select(d => new { d.CustomerId, d.Value }).ToListAsync(ct);

        var closedDeals = await ApplyDealClosedWindow(
                dealBase.Where(d => d.ClosedAt != null && d.Stage == "won"), f)
            .Select(d => new { d.CustomerId, d.Value }).ToListAsync(ct);

        var openByAccount = openDeals.GroupBy(d => d.CustomerId!.Value)
            .ToDictionary(g => g.Key, g => (Count: g.Count(), Value: g.Sum(d => d.Value)));
        var wonByAccount = closedDeals.GroupBy(d => d.CustomerId!.Value)
            .ToDictionary(g => g.Key, g => (Count: g.Count(), Value: g.Sum(d => d.Value)));

        var rows = accounts
            .Select(a =>
            {
                var open = openByAccount.TryGetValue(a.Id, out var o) ? o : (Count: 0, Value: 0m);
                var won = wonByAccount.TryGetValue(a.Id, out var w) ? w : (Count: 0, Value: 0m);
                return new AccountRevenueRowDto(
                    a.Id, a.Name, Fallback(a.Industry, "—"), Fallback(a.Tier, "standard"),
                    Fallback(a.AccountManager, "Unassigned"),
                    open.Count + won.Count, open.Count, open.Value, won.Count, won.Value,
                    a.TotalRevenue, a.LastActivity);
            })
            .OrderByDescending(r => r.WonValue).ThenByDescending(r => r.OpenValue)
            .ToList();

        return Result.Success(new AccountRevenueReportDto(
            rows, rows.Count, rows.Sum(r => r.WonValue), rows.Sum(r => r.OpenValue)));
    }
}
