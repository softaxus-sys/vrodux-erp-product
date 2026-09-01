namespace Softaxis.Sales.Application.Dashboard.Dtos;

/// <param name="Month">1–12.</param>
public sealed record MonthlyOrderDto(int Month, decimal Value, int Orders);

public sealed record OrderStatusCountDto(string Status, int Count);

public sealed record SalesDashboardDto(
    IReadOnlyList<MonthlyOrderDto>      Monthly,
    IReadOnlyList<OrderStatusCountDto>  ByStatus);
