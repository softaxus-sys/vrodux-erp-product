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
}
