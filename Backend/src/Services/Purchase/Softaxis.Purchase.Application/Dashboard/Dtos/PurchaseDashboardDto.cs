namespace Softaxis.Purchase.Application.Dashboard.Dtos;

/// <param name="Month">1–12.</param>
public sealed record MonthlyPurchaseDto(int Month, decimal Amount, int Orders);

public sealed record VendorSpendDto(string Vendor, decimal Amount, int Orders);

public sealed record PurchaseDashboardDto(
    IReadOnlyList<MonthlyPurchaseDto> Monthly,
    IReadOnlyList<VendorSpendDto>     TopVendors);
