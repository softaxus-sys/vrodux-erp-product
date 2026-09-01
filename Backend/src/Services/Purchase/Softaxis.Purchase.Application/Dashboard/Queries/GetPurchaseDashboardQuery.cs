using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Purchase.Application.Dashboard.Dtos;

namespace Softaxis.Purchase.Application.Dashboard.Queries;

/// <summary>
/// Aggregates for the dashboard's purchase charts — monthly spend and the biggest vendors.
///
/// <para>These were computed in the browser over a single 500-row page of orders, so past 500
/// orders the figures described a subset with nothing on screen saying so. A chart cannot be
/// paged; the aggregation belongs in SQL.</para>
/// </summary>
/// <param name="Year">Calendar year for the monthly series. Defaults to the current year.</param>
public sealed record GetPurchaseDashboardQuery(int? Year = null) : IQuery<PurchaseDashboardDto>;
