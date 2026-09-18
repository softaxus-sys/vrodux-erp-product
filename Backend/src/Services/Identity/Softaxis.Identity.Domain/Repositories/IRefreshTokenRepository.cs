using Softaxis.Identity.Domain.Entities;

namespace Softaxis.Identity.Domain.Repositories;

public interface IRefreshTokenRepository
{
    Task<RefreshToken?> GetByHashAsync(string tokenHash, CancellationToken ct = default);
    Task<IReadOnlyList<RefreshToken>> GetActiveByUserIdAsync(Guid userId, CancellationToken ct = default);
    /// <summary>Scoped to <paramref name="userId"/> so a caller can never revoke another user's
    /// session even if they guess a valid session id.</summary>
    Task<RefreshToken?> GetByIdForUserAsync(Guid id, Guid userId, CancellationToken ct = default);
    void Add(RefreshToken token);
    void Update(RefreshToken token);
    Task RevokeAllForUserAsync(Guid userId, CancellationToken ct = default);
    /// <summary>Revokes any still-active session this user already has on this device, so a
    /// device only ever holds one live row -- used at login when the client presents a DeviceId,
    /// mirroring how re-registering a push token updates its owner rather than duplicating.</summary>
    Task RevokeActiveForUserDeviceAsync(Guid userId, string deviceId, CancellationToken ct = default);
}
