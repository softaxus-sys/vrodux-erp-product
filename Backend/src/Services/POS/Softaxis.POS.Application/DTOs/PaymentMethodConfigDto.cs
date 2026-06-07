namespace Softaxis.POS.Application.DTOs;

/// <summary>Returned by GET /api/pos/payment-methods</summary>
public sealed record PaymentMethodConfigDto(
    Guid    Id,
    string  Code,
    string  Label,
    string  IconKey,
    string  Countries,
    string? Description,
    int     SortOrder,
    bool    IsEnabled,
    bool    IsSystem
);
