using Softaxis.Identity.Application.Abstractions;

namespace Softaxis.Identity.Infrastructure.Services;

public sealed class BcryptPasswordHasher : IPasswordHasher
{
    // Work factor 12 — ~250ms on modern hardware; adjust up over time
    public string Hash(string password)   => BCrypt.Net.BCrypt.HashPassword(password, workFactor: 12);
    public bool   Verify(string password, string hash) => BCrypt.Net.BCrypt.Verify(password, hash);
}
