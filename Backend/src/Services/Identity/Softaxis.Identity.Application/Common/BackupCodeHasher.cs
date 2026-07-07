using System.Security.Cryptography;
using System.Text;

namespace Softaxis.Identity.Application.Common;

/// <summary>
/// Normalizes and hashes one-time 2FA backup codes. Only the hash is ever stored; the plaintext code
/// is shown to the user once at enrollment. Normalization (upper-case, strip dashes/spaces) means the
/// user can enter "abcd-efgh", "ABCDEFGH", or "abcd efgh" interchangeably.
/// </summary>
public static class BackupCodeHasher
{
    public static string Normalize(string code) =>
        (code ?? string.Empty).Trim().ToUpperInvariant().Replace("-", "").Replace(" ", "");

    public static string Hash(string code) =>
        Convert.ToBase64String(SHA256.HashData(Encoding.UTF8.GetBytes(Normalize(code))));
}
