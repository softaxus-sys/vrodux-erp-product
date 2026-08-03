using Softaxis.Restaurant.Application.Reports.Dtos;

namespace Softaxis.Restaurant.Application.Dashboard.Dtos;

public sealed record OwnerDashboardDto(
    decimal TodaySales, int TodayOrders, decimal TodayNetSales,
    decimal WeekSales, decimal WeekNetSales, decimal WeekDiscounts, decimal WeekVoidValue,
    IReadOnlyList<SalesByCategoryRow> TopCategoriesWeek);

public sealed record BranchDashboardDto(
    Guid? BranchId, decimal TodaySales, int TodayOrders, decimal TodayNetSales,
    int TablesAvailable, int TablesOccupied, int TablesReserved, int TablesCleaning, int ActiveOrders);

public sealed record KitchenDashboardDto(
    int ActiveTickets, int PendingItems, int PreparingItems, int ReadyItems,
    double AvgPrepMinutesToday, IReadOnlyList<KitchenPrepTimeRow> SlowestItemsToday);

public sealed record CashierDashboardDto(
    int TodayOrders, decimal TodaySales, SessionReportDto? CurrentSession);

public sealed record LowStockItemRow(Guid ProductId, string ProductName, decimal StockQuantity, decimal ReorderLevel);

public sealed record InventoryDashboardDto(
    int LowStockCount, IReadOnlyList<LowStockItemRow> LowStockItems,
    int EightySixedCount, IReadOnlyList<string> EightySixedItemNames);
