using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Trade.Application.Reports;

/// <summary>A report as a table: column names, and rows keyed by column name.</summary>
public sealed record TabularReportDto(
    IReadOnlyList<string> Columns, IReadOnlyList<Dictionary<string, object?>> Rows, int TotalCount);

/// <summary>
/// One Trade report for the central Reports hub. <c>From</c> / <c>To</c> are calendar days; reports
/// that describe "now" ignore them. Where a range applies, it is the day the shipment was booked.
/// </summary>
public sealed record RunTradeReportQuery(string ReportId, DateOnly? From, DateOnly? To, DateOnly? Today)
    : IQuery<TabularReportDto>;
