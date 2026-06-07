using Softaxis.BuildingBlocks.Domain.Primitives;
using Softaxis.BuildingBlocks.Domain.Results;

namespace Softaxis.POS.Domain.ValueObjects;

public sealed class Money : ValueObject
{
    public decimal Amount   { get; }
    public string  Currency { get; }

    private Money(decimal amount, string currency)
    {
        Amount   = amount;
        Currency = currency;
    }

    public static Result<Money> Create(decimal amount, string currency = "PKR")
    {
        if (amount < 0)
            return Result.Failure<Money>(Error.Custom("Money.NegativeAmount", "Amount cannot be negative."));

        if (string.IsNullOrWhiteSpace(currency))
            return Result.Failure<Money>(Error.Custom("Money.InvalidCurrency", "Currency is required."));

        return Result.Success(new Money(Math.Round(amount, 2), currency.ToUpperInvariant().Trim()));
    }

    public static Money Zero(string currency = "PKR") => new(0m, currency);

    public Money Add(Money other)
    {
        if (Currency != other.Currency)
            throw new InvalidOperationException($"Cannot add {Currency} and {other.Currency}.");
        return new Money(Amount + other.Amount, Currency);
    }

    public Money Subtract(Money other)
    {
        if (Currency != other.Currency)
            throw new InvalidOperationException($"Cannot subtract {Currency} and {other.Currency}.");
        return new Money(Amount - other.Amount, Currency);
    }

    public Money Multiply(decimal factor) => new(Math.Round(Amount * factor, 2), Currency);

    public static Money operator +(Money a, Money b) => a.Add(b);
    public static Money operator -(Money a, Money b) => a.Subtract(b);
    public static Money operator *(Money a, decimal b) => a.Multiply(b);

    protected override IEnumerable<object> GetEqualityComponents()
    {
        yield return Amount;
        yield return Currency;
    }

    public override string ToString() => $"{Currency} {Amount:F2}";
}
