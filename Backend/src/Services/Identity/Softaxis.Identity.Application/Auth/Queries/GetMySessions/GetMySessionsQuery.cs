using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Identity.Application.DTOs;

namespace Softaxis.Identity.Application.Auth.Queries.GetMySessions;

/// <summary>CallerDeviceId is display-only -- it only decides which row in the result gets
/// IsCurrent = true, never which rows are returned (that's UserId alone).</summary>
public sealed record GetMySessionsQuery(Guid UserId, string? CallerDeviceId = null)
    : IQuery<IReadOnlyList<SessionDto>>;
