namespace Softaxis.Finance.Application.Suppliers.Dtos;

public sealed record SupplierDto(
    Guid      Id,
    string    Code,
    string    Name,
    string?   Email,
    string?   Phone,
    string?   Address,
    string?   TaxNumber,
    Guid?     AccountId,
    string?   AccountNumber,
    string?   AccountName,
    bool      IsActive,
    DateTime  CreatedAt,
    DateTime? UpdatedAt);
