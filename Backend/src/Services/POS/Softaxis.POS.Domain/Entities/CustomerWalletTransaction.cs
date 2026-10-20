namespace Softaxis.POS.Domain.Entities;

/// <summary>Audit trail row for every wallet/house-account movement on a Customer — topup/redeem
/// (wallet) and house_charge/house_payment (house account). OrderId is a scalar cross-service
/// reference (Restaurant's Order, or a future POS retail sale) — no FK constraint, same convention as
/// every other cross-service reference in this codebase.</summary>
public sealed class CustomerWalletTransaction
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public Guid CustomerId { get; private set; }
    public string Type { get; private set; } = null!; // topup/redeem/house_charge/house_payment/house_refund
    public decimal Amount { get; private set; }
    public Guid? OrderId { get; private set; }
    public string? Notes { get; private set; }
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;

    /// <summary>How the customer paid, for a top-up or a house-account payment: cash | card | bank_transfer | cheque.
    /// Null on rows from before this was recorded — the ledger cannot tell cash from bank for those.</summary>
    public string? PaymentMethod { get; private set; }

    /// <summary>For a house_charge: the day it falls due. Null on charges from before due dates existed
    /// (the customer's payment terms from the charge date are used instead).</summary>
    public DateTime? DueOn { get; private set; }

    public static readonly string[] PaymentMethods = ["cash", "card", "bank_transfer", "cheque"];

    public CustomerWalletTransaction(Guid customerId, string type, decimal amount, Guid? orderId, string? notes, string? paymentMethod = null, DateTime? dueOn = null)
    {
        DueOn = dueOn?.Date;
        CustomerId = customerId; Type = type; Amount = amount; OrderId = orderId; Notes = notes;
        PaymentMethod = string.IsNullOrWhiteSpace(paymentMethod) ? null : paymentMethod.Trim().ToLowerInvariant();
    }
}
