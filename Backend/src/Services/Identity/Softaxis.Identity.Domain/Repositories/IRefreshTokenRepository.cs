using Softaxis.Identity.Domain.Entities;

namespace Softaxis.Identity.Domain.Repositories;

public interface IRefreshTokenRepository
{
    Task<RefreshToken?> GetByHashAsync(string tokenHash, CancellationToken ct = default);
    Task<IReadOnlyList<RefreshToken>> GetActiveByUserIdAsync(Guid userId, CancellationToken ct = default);
    void Add(RefreshToken token);
    void Update(RefreshToken token);
    Task RevokeAllForUserAsync(Guid userId, CancellationToken ct = default);
}
