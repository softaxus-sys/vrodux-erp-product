using Softaxis.BuildingBlocks.Domain.Primitives;
using Softaxis.BuildingBlocks.Domain.Results;

namespace Softaxis.Identity.Domain.ValueObjects;

/// <summary>
/// Email value object — normalises to lower-case, validates format.
/// </summary>
public sealed class Email : ValueObject
{
    private Email(string value) => Value = value;

    public string Value { get; }

    public static Result<Email> Create(string? email)
    {
        if (string.IsNullOrWhiteSpace(email))
            return Result.Failure<Email>(Error.Custom("Email.Empty", "Email address is required."));

        var normalised = email.Trim().ToLowerInvariant();

        if (normalised.Length > 254)
            return Result.Failure<Email>(Error.Custom("Email.TooLong", "Email address exceeds 254 characters."));

        // Very basic RFC-5322 check — FluentValidation handles thorough checks at the app layer
        if (!normalised.Contains('@') || normalised.IndexOf('.', normalised.IndexOf('@')) < 0)
            return Result.Failure<Email>(Error.Custom("Email.Invalid", "Email address is not valid."));

        return Result.Success(new Email(normalised));
    }

    protected override IEnumerable<object?> GetEqualityComponents()
    {
        yield return Value;
    }

    public override string ToString() => Value;
    public static implicit operator string(Email e) => e.Value;
}
