using Softaxis.BuildingBlocks.Domain.Pagination;
using Microsoft.EntityFrameworkCore;
using Softaxis.Identity.Domain.Entities;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Infrastructure.Persistence.Repositories;

public sealed class RefreshTokenRepository(IdentityDbContext db) : IRefreshTokenRepository
{
    public Task<RefreshToken?> GetByHashAsync(string tokenHash, CancellationToken ct = default) =>
        db.RefreshTokens.FirstOrDefaultAsync(t => t.TokenHash == tokenHash, ct);

    public async Task<IReadOnlyList<RefreshToken>> GetActiveByUserIdAsync(Guid userId, CancellationToken ct = default) =>
        await db.RefreshTokens
            .Where(t => t.UserId == userId && t.RevokedAt == null && t.ExpiresAt > DateTime.UtcNow)
            .ToListAsync(ct);

    public Task<RefreshToken?> GetByIdForUserAsync(Guid id, Guid userId, CancellationToken ct = default) =>
        db.RefreshTokens.FirstOrDefaultAsync(t => t.Id == id && t.UserId == userId, ct);

    public void Add(RefreshToken token)    => db.RefreshTokens.Add(token);
    public void Update(RefreshToken token) => db.RefreshTokens.Update(token);

    public async Task RevokeAllForUserAsync(Guid userId, CancellationToken ct = default)
    {
        var active = await GetActiveByUserIdAsync(userId, ct);
        foreach (var t in active) t.Revoke();
        db.RefreshTokens.UpdateRange(active);
    }

    public async Task RevokeActiveForUserDeviceAsync(Guid userId, string deviceId, CancellationToken ct = default)
    {
        var active = await db.RefreshTokens
            .Where(t => t.UserId == userId && t.DeviceId == deviceId && t.RevokedAt == null && t.ExpiresAt > DateTime.UtcNow)
            .ToListAsync(ct);
        foreach (var t in active) t.Revoke();
        db.RefreshTokens.UpdateRange(active);
    }
}

