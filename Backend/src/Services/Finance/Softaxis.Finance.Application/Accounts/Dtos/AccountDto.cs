namespace Softaxis.Finance.Application.Accounts.Dtos;

public sealed record AccountDto(
    Guid      Id,
    string    AccountNumber,
    string    Name,
    string    AccountType,   // asset | liability | equity | income | expense
    string?   Description,
    Guid?     ParentId,
    bool      IsActive,
    decimal   Balance,
    DateTime  CreatedAt,
    DateTime? UpdatedAt);

public sealed record AccountSummaryDto(
    decimal TotalAssets,
    decimal TotalLiabilities,
    decimal TotalEquity,
    decimal TotalRevenue,
    decimal TotalExpenses,
    decimal NetProfit);
