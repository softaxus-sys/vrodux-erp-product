using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.CRM.Application.PortalListings.Dtos;

namespace Softaxis.CRM.Application.PortalListings.Queries;

/// <summary>
/// Registered portal listings the caller may see — their own, their teams' when they lead one, or
/// everyone's for full CRM access. <paramref name="Mine"/> narrows to the caller's own regardless.
/// </summary>
public sealed record GetPortalListingsQuery(string? Search = null, string? Portal = null, bool Mine = false)
    : IQuery<IReadOnlyList<PortalListingDto>>;
