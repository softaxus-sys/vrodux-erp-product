using Softaxis.BuildingBlocks.Domain.Primitives;
using Softaxis.BuildingBlocks.Domain.Results;

namespace Softaxis.POS.Domain.ValueObjects;

public sealed class Barcode : ValueObject
{
    public string Value { get; }

    private Barcode(string value) => Value = value;

    public static Result<Barcode> Create(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return Result.Failure<Barcode>(Error.Custom("Barcode.Empty", "Barcode cannot be empty."));

        var trimmed = value.Trim();
        if (trimmed.Length > 50)
            return Result.Failure<Barcode>(Error.Custom("Barcode.TooLong", "Barcode cannot exceed 50 characters."));

        return Result.Success(new Barcode(trimmed));
    }

    protected override IEnumerable<object> GetEqualityComponents()
    {
        yield return Value;
    }

    public override string ToString() => Value;
    public static implicit operator string(Barcode b) => b.Value;
}
