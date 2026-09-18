using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.DTOs;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Application.Auth.Queries.GetMySessions;

public sealed class GetMySessionsQueryHandler(IRefreshTokenRepository refreshRepo)
    : IQueryHandler<GetMySessionsQuery, IReadOnlyList<SessionDto>>
{
    public async Task<Result<IReadOnlyList<SessionDto>>> Handle(GetMySessionsQuery query, CancellationToken ct)
    {
        var active = await refreshRepo.GetActiveByUserIdAsync(query.UserId, ct);

        var sessions = active
            .OrderByDescending(t => t.CreatedAt)
            .Select(t => new SessionDto(
                t.Id,
                t.DeviceName,
                t.Platform,
                t.CreatedByIp,
                t.CreatedAt,
                t.ExpiresAt,
                IsCurrent: query.CallerDeviceId != null && t.DeviceId == query.CallerDeviceId))
            .ToList();

        return Result.Success<IReadOnlyList<SessionDto>>(sessions);
    }
}
