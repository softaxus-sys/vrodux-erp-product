using Softaxis.BuildingBlocks.Domain.Primitives;
using Softaxis.BuildingBlocks.Domain.Results;

namespace Softaxis.POS.Domain.Entities;

public sealed class Customer : AuditableEntity<Guid>
{
    public string  Name           { get; private set; } = default!;
    public string? Phone          { get; private set; }
    public string? Email          { get; private set; }
    public string? Address        { get; private set; }
    public decimal LoyaltyPoints  { get; private set; }
    public decimal TotalPurchases { get; private set; }
    public bool    IsActive       { get; private set; }
    public string? Notes          { get; private set; }

    /// <summary>Store-credit balance — topped up by the customer/cashier, spent as a payment
    /// method on future orders.</summary>
    public decimal WalletBalance  { get; private set; }
    /// <summary>House-account credit limit set by an admin (0 = no house-account access).</summary>
    public decimal CreditLimit    { get; private set; }
    /// <summary>How much of CreditLimit is currently in use — increases when an order is charged
    /// to the house account, decreases when the customer makes a payment against it.</summary>
    public decimal CreditBalance  { get; private set; }
    /// <summary>What's left to charge before hitting CreditLimit.</summary>
    public decimal AvailableCredit => Math.Max(0, CreditLimit - CreditBalance);

    // Navigation
    public ICollection<POSTransaction> Transactions { get; private set; } = [];

    private Customer() { }

    public static Result<Customer> Create(string name, string? phone, string? email, string? address, string? notes)
    {
        if (string.IsNullOrWhiteSpace(name))
            return Result.Failure<Customer>(Error.Custom("Customer.NameRequired", "Customer name is required."));

        if (name.Trim().Length > 150)
            return Result.Failure<Customer>(Error.Custom("Customer.NameTooLong", "Customer name cannot exceed 150 characters."));

        if (!string.IsNullOrWhiteSpace(email) && !email.Contains('@'))
            return Result.Failure<Customer>(Error.Custom("Customer.InvalidEmail", "Invalid email address."));

        return Result.Success(new Customer
        {
            Id       = Guid.NewGuid(),
            Name     = name.Trim(),
            Phone    = phone?.Trim(),
            Email    = email?.Trim().ToLowerInvariant(),
            Address  = address?.Trim(),
            Notes    = notes?.Trim(),
            IsActive = true
        });
    }

    public Result Update(string name, string? phone, string? email, string? address, string? notes)
    {
        if (string.IsNullOrWhiteSpace(name))
            return Result.Failure(Error.Custom("Customer.NameRequired", "Customer name is required."));

        if (!string.IsNullOrWhiteSpace(email) && !email.Contains('@'))
            return Result.Failure(Error.Custom("Customer.InvalidEmail", "Invalid email address."));

        Name    = name.Trim();
        Phone   = phone?.Trim();
        Email   = email?.Trim().ToLowerInvariant();
        Address = address?.Trim();
        Notes   = notes?.Trim();

        return Result.Success();
    }

    public void AddLoyaltyPoints(decimal points)
    {
        if (points > 0)
            LoyaltyPoints += points;
    }

    public Result RedeemLoyaltyPoints(decimal points)
    {
        if (points > LoyaltyPoints)
            return Result.Failure(Error.Custom("Customer.InsufficientPoints",
                $"Insufficient loyalty points. Available: {LoyaltyPoints}."));

        LoyaltyPoints -= points;
        return Result.Success();
    }

    public void RecordPurchase(decimal amount)
    {
        if (amount > 0)
            TotalPurchases += amount;
    }

    public void Activate()   => IsActive = true;
    public void Deactivate() => IsActive = false;

    /// <summary>Loads store credit onto the wallet — cash/card handed over by the customer.</summary>
    public Result TopUpWallet(decimal amount)
    {
        if (amount <= 0)
            return Result.Failure(Error.Custom("Customer.InvalidAmount", "Top-up amount must be greater than zero."));

        WalletBalance += amount;
        return Result.Success();
    }

    /// <summary>Spends store credit — typically as an order payment method.</summary>
    public Result RedeemWallet(decimal amount)
    {
        if (amount <= 0)
            return Result.Failure(Error.Custom("Customer.InvalidAmount", "Redeem amount must be greater than zero."));
        if (amount > WalletBalance)
            return Result.Failure(Error.Custom("Customer.InsufficientWalletBalance",
                $"Insufficient wallet balance. Available: {WalletBalance}."));

        WalletBalance -= amount;
        return Result.Success();
    }

    /// <summary>Sets (or changes) this customer's house-account credit limit. Lowering it below the
    /// current CreditBalance is allowed — it just means no further charges are possible until the
    /// balance is paid down, it doesn't retroactively invalidate what's already owed.</summary>
    public Result SetCreditLimit(decimal creditLimit)
    {
        if (creditLimit < 0)
            return Result.Failure(Error.Custom("Customer.InvalidAmount", "Credit limit cannot be negative."));

        CreditLimit = creditLimit;
        return Result.Success();
    }

    /// <summary>Charges an order to the house account — fails if it would exceed the credit limit.</summary>
    public Result ChargeHouseAccount(decimal amount)
    {
        if (amount <= 0)
            return Result.Failure(Error.Custom("Customer.InvalidAmount", "Charge amount must be greater than zero."));
        if (CreditBalance + amount > CreditLimit)
            return Result.Failure(Error.Custom("Customer.CreditLimitExceeded",
                $"Charging {amount} would exceed the house-account credit limit. Available: {AvailableCredit}."));

        CreditBalance += amount;
        return Result.Success();
    }

    /// <summary>Records a payment against the house-account balance (e.g. month-end statement
    /// settlement) — clamped so it can never go negative.</summary>
    public Result RecordHouseAccountPayment(decimal amount)
    {
        if (amount <= 0)
            return Result.Failure(Error.Custom("Customer.InvalidAmount", "Payment amount must be greater than zero."));

        CreditBalance = Math.Max(0, CreditBalance - amount);
        return Result.Success();
    }
}
