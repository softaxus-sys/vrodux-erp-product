using System.Text.Json.Serialization;
using Softaxis.BuildingBlocks.Application.Serialization;
namespace Softaxis.POS.Application.DTOs;

// ── Generic report result (all tabular reports) ───────────────────────────────

public sealed record ReportResult(
    IReadOnlyList<string>                      Columns,
    IReadOnlyList<Dictionary<string, object?>> Rows,
    int                                        TotalCount);

public sealed record ReportParams(
    DateTime From,
    DateTime To,
    Guid?    CashierId      = null,
    Guid?    CategoryId     = null,
    Guid?    WarehouseId    = null,
    string?  PaymentMethod  = null,
    string?  Status         = null,
    string?  TaxPeriod      = null,
    string?  ValuationMethod = null,
    string?  FiscalYear     = null,
    int      IdleDays       = 90);

// ── Daily summary (existing) ──────────────────────────────────────────────────

public sealed record DailySummaryDto(
    // The report's DAY, not a moment in it.
    [property: JsonConverter(typeof(CalendarDateJsonConverter))] DateTime Date,
    int      TotalTransactions,
    int      TotalSales,
    int      TotalRefunds,
    int      TotalVoids,
    decimal  GrossSales,
    decimal  RefundAmount,
    decimal  NetSales,
    decimal  TaxCollected,
    decimal  TotalDiscount,
    IReadOnlyList<PaymentMethodSummaryDto> PaymentBreakdown,
    IReadOnlyList<TopProductDto>           TopProducts,
    IReadOnlyList<HourlySalesDto>          HourlySales);

public sealed record PaymentMethodSummaryDto(
    string  Method,
    int     Count,
    decimal Amount);

public sealed record TopProductDto(
    Guid    ProductId,
    string  ProductName,
    decimal QuantitySold,
    decimal Revenue);

public sealed record HourlySalesDto(
    int     Hour,
    int     TransactionCount,
    decimal SalesAmount);
