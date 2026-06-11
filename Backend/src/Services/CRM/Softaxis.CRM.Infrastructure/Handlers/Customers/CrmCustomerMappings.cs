using Softaxis.CRM.Application.Customers.Dtos;
using Softaxis.CRM.Domain.Entities;

namespace Softaxis.CRM.Infrastructure.Handlers.Customers;

internal static class CrmCustomerMappings
{
    public static CrmCustomerDto ToDto(CrmCustomer c) => new(
        c.Id, c.Name, c.TradeName, c.Industry, c.Website, c.Country, c.City, c.Address,
        c.Phone, c.Email, c.Status, c.Tier, c.AccountManager, c.Since, c.LastActivity,
        c.TotalRevenue, c.OpenDeals, c.Currency, c.Employees, c.Description,
        Array.Empty<object>(), Array.Empty<object>(), Array.Empty<object>(),
        c.Tags, c.ContractRenewal, c.NpsScore);
}
