namespace Softaxis.Restaurant.Application.Reports.Dtos;

public sealed record SalesDailyRow(DateOnly Date, int OrderCount, decimal GrossSales, decimal Discounts, decimal Tax, decimal NetSales);

public sealed record SalesByCategoryRow(Guid CategoryId, string CategoryName, int Qty, decimal Revenue);

/// <summary>Grouped by Order.Waiter (a free-text name captured at order time, not a resolvable
/// Identity user id) — matches what's actually captured on every order regardless of whether a POS
/// session/cashier was involved.</summary>
public sealed record SalesByEmployeeRow(string Waiter, int OrderCount, decimal Revenue, decimal TipTotal);

/// <summary>Fraud-signal report — outlier void/discount patterns per user. UserId is an Identity user
/// id; the frontend resolves it to a display name via the existing /api/users list rather than this
/// service doing a cross-schema name join for a report row.</summary>
public sealed record VoidsAndDiscountsRow(Guid UserId, int VoidCount, decimal VoidValue, int DiscountCount, decimal DiscountValue);

public sealed record KitchenPrepTimeRow(Guid MenuItemId, string MenuItemName, int OrdersCount, double AvgPrepMinutes, double P90PrepMinutes);

public sealed record TableTurnoverRow(Guid TableId, string TableNumber, int TurnCount, double AvgOccupiedMinutes);

public sealed record TaxSummaryRow(DateOnly Date, decimal TaxableAmount, decimal TaxCollected);

/// <summary>Z-report (closed session) / X-report (open session) — same shape, the only difference is
/// whether the underlying POS session is still open. PaymentMethodBreakdown sums OrderPayment.Amount
/// by method across every order tied to this session.</summary>
public sealed record SessionReportDto(
    Guid SessionId,
    string SessionStatus,
    int OrderCount,
    decimal GrossSales,
    decimal Discounts,
    decimal Tax,
    decimal Tips,
    decimal Refunds,
    decimal NetSales,
    int VoidCount,
    decimal VoidValue,
    IReadOnlyDictionary<string, decimal> PaymentMethodBreakdown);
