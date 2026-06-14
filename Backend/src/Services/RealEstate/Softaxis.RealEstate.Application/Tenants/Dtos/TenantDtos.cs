namespace Softaxis.RealEstate.Application.Tenants.Dtos;

public sealed record TenantDto(
    Guid Id, string TenantNumber, string Name, string TenantType, string Email, string Phone,
    string? NationalId, string? CompanyName, string? TradeLicense, string Nationality,
    string Status, int ActiveContracts, decimal TotalPaid);

public sealed record TenantsSummaryDto(
    int Total, int Individual, int Company, int Active, int Inactive,
    int TotalActiveContracts, decimal TotalPaid);

public sealed record CreatedTenantDto(Guid Id, string TenantNumber, string Name);
