namespace Softaxis.POS.Domain.Entities;

/// <summary>Audit trail row for every wallet/house-account movement on a Customer — topup/redeem
/// (wallet) and house_charge/house_payment (house account). OrderId is a scalar cross-service
/// reference (Restaurant's Order, or a future POS retail sale) — no FK constraint, same convention as
/// every other cross-service reference in this codebase.</summary>
public sealed class CustomerWalletTransaction
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public Guid CustomerId { get; private set; }
    public string Type { get; private set; } = null!; // topup/redeem/house_charge/house_payment
    public decimal Amount { get; private set; }
    public Guid? OrderId { get; private set; }
    public string? Notes { get; private set; }
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;

    public CustomerWalletTransaction(Guid customerId, string type, decimal amount, Guid? orderId, string? notes)
    {
        CustomerId = customerId; Type = type; Amount = amount; OrderId = orderId; Notes = notes;
    }
}
