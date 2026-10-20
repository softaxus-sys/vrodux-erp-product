namespace Softaxis.LeadGen.Application;

/// <summary>Anchor for assembly scanning (MediatR handlers, FluentValidation validators).</summary>
public sealed class AssemblyMarker;

public sealed record PagedResult<T>(IReadOnlyList<T> Items, int Total, int Page, int PageSize);
