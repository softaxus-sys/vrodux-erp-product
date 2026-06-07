namespace Softaxis.POS.Application.DTOs;

public sealed record POSSessionDto(
    Guid     Id,
    Guid     CashierId,
    string   RegisterId,
    string   Status,
    DateTime OpenedAt,
    DateTime? ClosedAt,
    decimal  OpeningCash,
    decimal  ClosingCash,
    decimal  ExpectedCash,
    decimal  CashVariance,
    int      TotalTransactions,
    decimal  TotalSales,
    decimal  TotalRefunds,
    decimal  NetSales,
    string?  Notes);

public sealed record POSSessionSummaryDto(
    Guid     Id,
    string   RegisterId,
    string   Status,
    DateTime OpenedAt,
    int      TotalTransactions,
    decimal  NetSales);
