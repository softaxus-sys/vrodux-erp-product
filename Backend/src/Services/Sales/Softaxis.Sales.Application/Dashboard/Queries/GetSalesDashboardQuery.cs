using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Sales.Application.Dashboard.Dtos;

namespace Softaxis.Sales.Application.Dashboard.Queries;

/// <summary>
/// Aggregates for the dashboard's sales charts.
///
/// <para>These were computed in the browser over a single 500-row page of orders. A chart cannot
/// be paged, so past 500 orders the figures silently described a subset — the aggregation belongs
/// in SQL.</para>
/// </summary>
/// <param name="Year">Calendar year for the monthly series. Defaults to the current year.</param>
public sealed record GetSalesDashboardQuery(int? Year = null) : IQuery<SalesDashboardDto>;
