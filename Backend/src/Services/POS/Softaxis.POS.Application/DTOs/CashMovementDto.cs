namespace Softaxis.POS.Application.DTOs;

public sealed record CashMovementDto(
    Guid     Id,
    Guid     SessionId,
    Guid     CashierId,
    string   Type,        // "PayIn" | "PayOut"
    decimal  Amount,
    string   Reason,
    DateTime CreatedAt);
