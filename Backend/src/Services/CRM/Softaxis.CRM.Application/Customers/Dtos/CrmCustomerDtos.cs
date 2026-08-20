namespace Softaxis.CRM.Application.Customers.Dtos;

public sealed record CrmCustomerDto(
    Guid Id, string Name, string? TradeName, string Industry, string? Website, string Country,
    string City, string Address, string Phone, string Email, string Status, string Tier,
    string AccountManager, Guid? AccountManagerUserId, string Since, string? LastActivity, decimal TotalRevenue, int OpenDeals,
    string Currency, string? Employees, string Description, IReadOnlyList<object> Contacts,
    IReadOnlyList<object> Deals, IReadOnlyList<object> Activities, IReadOnlyList<string> Tags,
    string? ContractRenewal, int? NpsScore);

public sealed record CrmCustomersSummaryDto(
    int Total, int Active, int Inactive, int Platinum, int Gold,
    decimal TotalRevenue, int OpenDeals, double AvgNps);
