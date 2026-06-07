namespace Softaxis.BuildingBlocks.Domain.Exceptions;

/// <summary>
/// Thrown when a domain invariant is violated.
/// Use Result<T> for expected failures; throw this only for truly
/// exceptional invariant violations that should never reach production.
/// </summary>
public sealed class DomainException(string message) : Exception(message);
