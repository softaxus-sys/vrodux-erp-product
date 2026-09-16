using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.POS.Application.Dashboard;

/// <summary>
/// Retail POS dashboard for a local date range, with the previous period of equal length for comparison.
/// </summary>
/// <param name="From">First local business day, yyyy-MM-dd. Defaults to today.</param>
/// <param name="To">Last local business day (inclusive), yyyy-MM-dd. Defaults to <paramref name="From"/>.</param>
/// <param name="UtcOffsetMinutes">
/// Minutes to add to UTC to reach the caller's clock. "Today" at a till is the terminal's day —
/// deriving it from UTC would roll the day over mid-evening in the Gulf.
/// </param>
public sealed record GetPosOverviewQuery(string? From = null, string? To = null, int UtcOffsetMinutes = 0)
    : IQuery<PosOverviewDto>;

public sealed class GetPosOverviewQueryValidator : AbstractValidator<GetPosOverviewQuery>
{
    public GetPosOverviewQueryValidator()
    {
        RuleFor(x => x.UtcOffsetMinutes).InclusiveBetween(-14 * 60, 14 * 60);
    }
}

/// <summary>
/// How the figures are defined — worth reading before trusting a number:
/// <list type="bullet">
/// <item>Gross sales = completed sales, <b>plus</b> sales later refunded. A refund marks its original
/// sale voided, so excluding those would subtract the refund twice.</item>
/// <item>Refunds = completed refund transactions, dated when the refund happened.</item>
/// <item>Net sales = gross − refunds. Voids (sales cancelled outright) are not revenue and are counted separately.</item>
/// </list>
/// </summary>
public sealed record PosKpisDto(
    decimal GrossSales,
    decimal Refunds,
    decimal NetSales,
    int     Transactions,
    int     RefundCount,
    int     VoidCount,
    decimal VoidedValue,
    decimal AverageBasket,
    decimal ItemsSold,
    decimal Discounts,
    decimal Tax);

/// <param name="Bucket">"HH:00" for a single-day range, otherwise the local date yyyy-MM-dd.</param>
public sealed record PosTrendPointDto(string Bucket, decimal Sales, decimal Refunds, int Transactions);

public sealed record PosPaymentMixDto(string Method, decimal Amount, int Count);

public sealed record PosTopProductDto(Guid ProductId, string Name, decimal Quantity, decimal Revenue);

public sealed record PosCashierDto(Guid CashierId, int Transactions, decimal Sales);

public sealed record PosOpenShiftDto(
    Guid SessionId, string RegisterId, Guid CashierId, DateTime OpenedAt,
    int Transactions, decimal NetSales, bool IsOffline);

public sealed record PosTillBacklogDto(
    string DeviceId, string? RegisterId, string? UserName, int PendingRecords, int UnsyncedShifts, DateTime ReportedAt);

public sealed record PosOverviewDto(
    string                            From,
    string                            To,
    bool                              Hourly,
    PosKpisDto                        Current,
    PosKpisDto                        Previous,
    IReadOnlyList<PosTrendPointDto>   Trend,
    IReadOnlyList<PosPaymentMixDto>   PaymentMix,
    IReadOnlyList<PosTopProductDto>   TopProducts,
    IReadOnlyList<PosCashierDto>      Cashiers,
    IReadOnlyList<PosOpenShiftDto>    OpenShifts,
    bool                              OfflineModeEnabled,
    IReadOnlyList<PosTillBacklogDto>  TillsWithUnsyncedWork);
