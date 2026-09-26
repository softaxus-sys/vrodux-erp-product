using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Softaxis.Identity.Application.Abstractions;

namespace Softaxis.Identity.Infrastructure.Services;

/// <summary>
/// RSA-2048 signed license keys for on-premises deployments.
///
/// Format: base64url(utf8(json payload)) + "." + base64url(RSA signature)
///
/// Private key lives on the cloud server only (in appsettings / env var).
/// Public key is embedded here for client-side validation.
///
/// Key generation (run once on server):
///   using var rsa = RSA.Create(2048);
///   privateKeyPem = rsa.ExportRSAPrivateKeyPem();
///   publicKeyPem  = rsa.ExportRSAPublicKeyPem();
/// </summary>
public sealed class LicenseService : ILicenseService
{
    // ── Key pair ──────────────────────────────────────────────────────────────
    // Only the PUBLIC key is compiled in: it is all an installation needs to verify a key, and it
    // is safe to ship. The PRIVATE key must never be in the binary — it used to be embedded here
    // as a fallback, which put the ability to mint any license for any customer inside every
    // on-premises exe. It now comes only from configuration (License:RsaPrivateKeyPem /
    // env License__RsaPrivateKeyPem), which exists only on the cloud server that issues keys.

    private const string EmbeddedPublicKeyPem =
        "-----BEGIN RSA PUBLIC KEY-----\n" +
        "MIIBCgKCAQEA03GkXqQbS4KdL0T10MRqLa1iVlTLlDxG2od2fFfOBe4/CtfP5fJr\n" +
        "CrlzMfsvFM4BJm0v9/KLNlJnExsTj+pYfckv2GZtGOqZk9jR0d8lfgSNO6OQy3Qm\n" +
        "DNe5YO38xJwWn0Ca5oJCfzFsDRkJi8P/6P9b7d4ZpFQuh1SKmFcOnnSrULP0mx9Y\n" +
        "B5A8hB6Iq2wct6+iQqm4sxMESlH02ZEAiY2Ry+GfgtsGEYPhPHYl7wlXyP2btEWJ\n" +
        "nU/VMbCElaisxgpHAgTKX/6eN+abzreHoALmxR2I5EIMl2ze+WYzePIvMMHkrWfP\n" +
        "NBuqKGA2cSR2hhV3MYTvnVJy8wFz4BVF9QIDAQAB\n" +
        "-----END RSA PUBLIC KEY-----";

    private readonly string? _privateKeyPem;

    public bool IsOnPremisesInstall { get; }

    public LicenseService(IConfiguration configuration)
    {
        IsOnPremisesInstall =
            !string.IsNullOrWhiteSpace(configuration["OnPremises:LicenseKey"]) ||
            !string.IsNullOrWhiteSpace(configuration["OnPremises:TenantName"]);

        var fromConfig = configuration["License:RsaPrivateKeyPem"];
        // Env vars often carry the PEM with literal "\n" rather than real newlines.
        _privateKeyPem = string.IsNullOrWhiteSpace(fromConfig) ? null : fromConfig.Replace("\\n", "\n");
    }

    public string ThisMachineCode => MachineFingerprint.Current;

    public string GenerateLicenseKey(LicensePayload payload)
    {
        if (_privateKeyPem is null)
            throw new InvalidOperationException(
                "License signing is not configured on this server. Set License:RsaPrivateKeyPem " +
                "(env License__RsaPrivateKeyPem) — keys can only be issued from the cloud server.");

        using var rsa = RSA.Create();
        rsa.ImportFromPem(_privateKeyPem);

        var json    = JsonSerializer.Serialize(payload);
        var data    = Encoding.UTF8.GetBytes(json);
        var sig     = rsa.SignData(data, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);

        return $"{Base64UrlEncode(data)}.{Base64UrlEncode(sig)}";
    }

    public LicensePayload? ValidateLicenseKey(string licenseKey)
    {
        try
        {
            var parts = licenseKey.Split('.');
            if (parts.Length != 2) return null;

            var data = Base64UrlDecode(parts[0]);
            var sig  = Base64UrlDecode(parts[1]);

            using var rsa = RSA.Create();
            rsa.ImportFromPem(EmbeddedPublicKeyPem);

            var valid = rsa.VerifyData(data, sig, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
            if (!valid) return null;

            var json    = Encoding.UTF8.GetString(data);
            var payload = JsonSerializer.Deserialize<LicensePayload>(json);

            return payload?.ExpiresAt > DateTime.UtcNow ? payload : null;
        }
        catch
        {
            return null;
        }
    }

    public LicensePayload? ValidateForThisMachine(string licenseKey)
    {
        var payload = ValidateLicenseKey(licenseKey);
        return payload is not null && MatchesThisMachine(payload) ? payload : null;
    }

    public bool IsBoundToAnotherMachine(string licenseKey)
    {
        var payload = ValidateLicenseKey(licenseKey);
        return payload is not null && !MatchesThisMachine(payload);
    }

    private static bool MatchesThisMachine(LicensePayload payload) =>
        string.IsNullOrWhiteSpace(payload.MachineId)
        || MachineFingerprint.Normalize(payload.MachineId) == MachineFingerprint.Normalize(MachineFingerprint.Current);

    private static string Base64UrlEncode(byte[] data) =>
        Convert.ToBase64String(data)
               .TrimEnd('=')
               .Replace('+', '-')
               .Replace('/', '_');

    private static byte[] Base64UrlDecode(string s)
    {
        s = s.Replace('-', '+').Replace('_', '/');
        switch (s.Length % 4)
        {
            case 2: s += "=="; break;
            case 3: s += "=";  break;
        }
        return Convert.FromBase64String(s);
    }
}
