using Softaxis.POS.Application.DTOs;
using Softaxis.POS.Domain.Entities;

namespace Softaxis.POS.Application.Customers;

/// <summary>Single source of truth for Customer→CustomerDto/CustomerSummaryDto — avoids repeating the
/// same field list across Create/Update/GetById/GetAll handlers (they'd drift on the next field add).</summary>
internal static class CustomerMappings
{
    public static CustomerDto ToDto(Customer c) => new(
        c.Id, c.Name, c.Phone, c.Email, c.Address, c.LoyaltyPoints, c.TotalPurchases,
        c.IsActive, c.Notes, c.CreatedAt, c.WalletBalance, c.CreditLimit, c.CreditBalance, c.AvailableCredit);

    public static CustomerSummaryDto ToSummaryDto(Customer c) => new(
        c.Id, c.Name, c.Phone, c.Email, c.LoyaltyPoints, c.IsActive, c.WalletBalance, c.AvailableCredit);
}
