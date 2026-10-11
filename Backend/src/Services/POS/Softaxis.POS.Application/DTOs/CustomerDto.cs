namespace Softaxis.POS.Application.DTOs;

public sealed record CustomerDto(
    Guid     Id,
    string   Name,
    string?  Phone,
    string?  Email,
    string?  Address,
    decimal  LoyaltyPoints,
    decimal  TotalPurchases,
    bool     IsActive,
    string?  Notes,
    DateTime CreatedAt,
    decimal  WalletBalance,
    decimal  CreditLimit,
    decimal  CreditBalance,
    decimal  AvailableCredit,
    int      CreditTermsDays = 30,
    bool     CreditHold = false,
    string?  CreditHoldReason = null);

public sealed record CustomerSummaryDto(
    Guid    Id,
    string  Name,
    string? Phone,
    string? Email,
    decimal LoyaltyPoints,
    bool    IsActive,
    decimal WalletBalance,
    decimal AvailableCredit,
    bool    CreditHold = false);

public sealed record CustomerWalletTransactionDto(
    Guid     Id,
    Guid     CustomerId,
    string   Type,
    decimal  Amount,
    Guid?    OrderId,
    string?  Notes,
    DateTime CreatedAt);
