using Softaxis.CRM.Application.Customers.Dtos;
using Softaxis.CRM.Domain.Entities;

namespace Softaxis.CRM.Infrastructure.Handlers.Customers;

internal static class CrmCustomerMappings
{
    /// <summary>
    /// <paramref name="metrics"/> carries revenue and open deals, derived from the account's deals
    /// rather than read off the record — see <see cref="CustomerDealMetrics"/>.
    /// </summary>
    public static CrmCustomerDto ToDto(CrmCustomer c, CustomerDealMetrics metrics) => new(
        c.Id, c.Name, c.TradeName, c.Industry, c.Website, c.Country, c.City, c.Address,
        c.Phone, c.Email, c.Status, c.Tier, c.AccountManager, c.AccountManagerUserId, c.Since, c.LastActivity,
        metrics.Revenue, metrics.OpenDeals, c.Currency, c.Employees, c.Description,
        Array.Empty<object>(), Array.Empty<object>(), Array.Empty<object>(),
        c.Tags, c.ContractRenewal, c.NpsScore, c.TeamId, c.PaymentTerms);
}
