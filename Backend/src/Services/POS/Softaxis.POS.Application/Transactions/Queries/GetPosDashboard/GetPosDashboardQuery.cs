using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.POS.Application.Transactions.Queries.GetPosDashboard;

/// <summary>
/// Today's takings by hour and the payment-method split, for the dashboard's POS charts.
/// </summary>
/// <param name="Date">
/// Local business day as yyyy-MM-dd. The caller passes its own day because the terminal's timezone
/// is what "today" means at the till — deriving it from UTC on the server would roll the day over
/// mid-evening in the Gulf. Defaults to the server's current UTC date when omitted.
/// </param>
/// <param name="UtcOffsetMinutes">
/// Minutes to add to UTC to get the caller's local time, so the hour buckets line up with the
/// clock on the wall rather than with UTC.
/// </param>
public sealed record GetPosDashboardQuery(string? Date = null, int UtcOffsetMinutes = 0)
    : IQuery<PosDashboardDto>;

public sealed record HourlySalesDto(int Hour, decimal Sales, int Transactions);

public sealed record PaymentMethodCountDto(string Method, int Count);

public sealed record PosDashboardDto(
    IReadOnlyList<HourlySalesDto>         Hourly,
    IReadOnlyList<PaymentMethodCountDto>  Methods,
    decimal                               TotalSales,
    int                                   TotalTransactions);
