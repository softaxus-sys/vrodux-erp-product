using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Options;
using Softaxis.Identity.Application.Abstractions;

namespace Softaxis.Identity.Infrastructure.Services;

/// <summary>
/// Encrypts the TOTP shared secret at rest with AES-256-GCM. The key is derived deterministically from
/// the configured JWT secret, so ciphertext survives restarts and redeploys without a separate key store
/// (the JWT secret is already a required, stable, high-entropy configuration value).
/// </summary>
public sealed class TotpSecretProtector : ITotpSecretProtector
{
    private const int NonceSize = 12;   // AES-GCM standard nonce
    private const int TagSize   = 16;   // 128-bit auth tag
    private readonly byte[] _key;

    public TotpSecretProtector(IOptions<JwtSettings> jwt)
        => _key = SHA256.HashData(Encoding.UTF8.GetBytes("vrodux::totp-secret::" + jwt.Value.Secret));

    public string Protect(string plaintext)
    {
        var nonce  = RandomNumberGenerator.GetBytes(NonceSize);
        var plain  = Encoding.UTF8.GetBytes(plaintext);
        var cipher = new byte[plain.Length];
        var tag    = new byte[TagSize];

        using var aes = new AesGcm(_key, TagSize);
        aes.Encrypt(nonce, plain, cipher, tag);

        var combined = new byte[NonceSize + TagSize + cipher.Length];
        Buffer.BlockCopy(nonce,  0, combined, 0,                    NonceSize);
        Buffer.BlockCopy(tag,    0, combined, NonceSize,            TagSize);
        Buffer.BlockCopy(cipher, 0, combined, NonceSize + TagSize,  cipher.Length);
        return Convert.ToBase64String(combined);
    }

    public string Unprotect(string ciphertext)
    {
        var combined = Convert.FromBase64String(ciphertext);
        var nonce  = combined.AsSpan(0, NonceSize).ToArray();
        var tag    = combined.AsSpan(NonceSize, TagSize).ToArray();
        var cipher = combined.AsSpan(NonceSize + TagSize).ToArray();
        var plain  = new byte[cipher.Length];

        using var aes = new AesGcm(_key, TagSize);
        aes.Decrypt(nonce, cipher, tag, plain);
        return Encoding.UTF8.GetString(plain);
    }
}
