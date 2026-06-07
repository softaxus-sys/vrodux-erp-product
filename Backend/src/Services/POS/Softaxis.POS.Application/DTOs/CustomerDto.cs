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
    DateTime CreatedAt);

public sealed record CustomerSummaryDto(
    Guid    Id,
    string  Name,
    string? Phone,
    string? Email,
    decimal LoyaltyPoints,
    bool    IsActive);
