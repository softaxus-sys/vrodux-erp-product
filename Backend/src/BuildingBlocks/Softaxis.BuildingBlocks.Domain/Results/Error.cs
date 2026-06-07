namespace Softaxis.BuildingBlocks.Domain.Results;

/// <summary>
/// Structured error with a machine-readable code and human-readable description.
/// </summary>
public sealed record Error(string Code, string Description)
{
    public static readonly Error None        = new(string.Empty, string.Empty);
    public static readonly Error NullValue   = new("Error.NullValue", "A null value was provided.");
    public static readonly Error NotFound    = new("Error.NotFound", "The requested resource was not found.");
    public static readonly Error Unauthorized = new("Error.Unauthorized", "You are not authorized to perform this action.");
    public static readonly Error Forbidden   = new("Error.Forbidden", "Access to this resource is denied.");
    public static readonly Error Conflict    = new("Error.Conflict", "A conflict occurred with the current state.");
    public static readonly Error Validation  = new("Error.Validation", "One or more validation errors occurred.");

    public static Error NotFoundById(string entity, object id) =>
        new($"{entity}.NotFound", $"{entity} with id '{id}' was not found.");

    public static Error Custom(string code, string description) => new(code, description);
}
