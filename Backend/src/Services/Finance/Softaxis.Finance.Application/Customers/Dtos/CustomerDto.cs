namespace Softaxis.Finance.Application.Customers.Dtos;

public sealed record CustomerDto(
    Guid      Id,
    string    Code,
    string    Name,
    string?   Email,
    string?   Phone,
    string?   Address,
    Guid?     AccountId,
    string?   AccountNumber,
    string?   AccountName,
    string?   CcEmails,
    bool      IsActive,
    DateTime  CreatedAt,
    DateTime? UpdatedAt);
