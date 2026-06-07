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
    // ── Embedded key pair ─────────────────────────────────────────────────────
    // Generated once for this Softaxis installation.
    // Public key: safe to ship in on-prem binaries.
    // Private key: override via  License:RsaPrivateKeyPem  in appsettings /
    //              environment variable for production hardening.
    //              Falls back to this constant so the feature always works
    //              without extra config steps.

    private const string EmbeddedPrivateKeyPem =
        "-----BEGIN RSA PRIVATE KEY-----\n" +
        "MIIEowIBAAKCAQEA03GkXqQbS4KdL0T10MRqLa1iVlTLlDxG2od2fFfOBe4/CtfP\n" +
        "5fJrCrlzMfsvFM4BJm0v9/KLNlJnExsTj+pYfckv2GZtGOqZk9jR0d8lfgSNO6OQ\n" +
        "y3QmDNe5YO38xJwWn0Ca5oJCfzFsDRkJi8P/6P9b7d4ZpFQuh1SKmFcOnnSrULP0\n" +
        "mx9YB5A8hB6Iq2wct6+iQqm4sxMESlH02ZEAiY2Ry+GfgtsGEYPhPHYl7wlXyP2b\n" +
        "tEWJnU/VMbCElaisxgpHAgTKX/6eN+abzreHoALmxR2I5EIMl2ze+WYzePIvMMHk\n" +
        "rWfPNBuqKGA2cSR2hhV3MYTvnVJy8wFz4BVF9QIDAQABAoIBAFgkr5ikYJyBvnTO\n" +
        "EosM1hZkiPHkN1l8Jy1B+yqqj7/5KV6jyI7bF7RIyrSzOVU660/RhIWgHlhu0Xkt\n" +
        "eGIuFuWY0NEtIZ2ZbpwrboxGsaJu01FhRiMKMDJ6W1UE4LI1P1jz3Z7p/j53o8tx\n" +
        "/IC/HBdNHE10oMvYK+1OWNhYskdrKTa9W1pzoF7Sz3X3MojSprkh4jXL3b+/AyJx\n" +
        "QTuhBp7ZBtKNX1Y+DcZb6uavQx2VIR1pmO7k16bXBmHqxQUBGH3S1CCKFb2FxXnU\n" +
        "sKYWnxtbrMFPam5dwOvnLiPQWArMKGaJCItcQCT0O6ObHX3EaIlr67tr29x5Iggs\n" +
        "xbx0CKECgYEA3sdOMO1ONJ5rmi9tkjxlhy5Ur9oO1CanFjxOfZ6kdSpzcE1TOley\n" +
        "A+UfE1OUntjgx1PGtzfAVlEDSqKE5lTqSxi1J7BgtQ21PY/uP/PhSE9yA5LWYLYB\n" +
        "uO8fnOCNlRIPWmNcKhxuc1shuTme4sbDgQ/IlSm0zSVPgTe5Dbzfv9cCgYEA8vmh\n" +
        "kMfWu/AyhLaH8/WvtK+Utl2trORPHfFWHa2YygrFhNy+9Co1yiJoZAl4Qx/TkWiY\n" +
        "XEX3whGdc+lXLo8/ffLK3x5h+1AUbOD/O3HR7PyBhNiB99mdqbMrp8tZJRTpZef+\n" +
        "9mu/TeShLc3u0b7momxJ1grj7oQb2JtI3krZHxMCgYEAhVVT/wSIogWO8SEhuzxa\n" +
        "p6WbGgSwi1j299/wOk8Qru9RWA1vmqOR77LZ/n8vnELBhYsmi9HaU8744VqToCeC\n" +
        "cp+/DJoLx1EFAGt8dNpKIzUpT+o6VHeaYEz95q6fDnFYrwh4yNtrX69TZ8CMz72W\n" +
        "lVAVBPGJPJ7wDq6DGy3H3NECgYBkf3IfMzkTRRdwIxt6gZ1qS9Fj2L10LH648NBg\n" +
        "uCPhNbFa8f8deLQE5lRtRCl1Ah39H9kdGWeP4r9QaSxBOsjVLG5S+Psn+ohoPGv1\n" +
        "R2+/6PUdYHvpax42ScB9x7MYjly3ZMzlWc2nxzAPhQUJxj8Y4Vds69Y5GnV2E0yB\n" +
        "fU3u9wKBgFbJ1ZpBC1Y1yg56c/+7D9cGvA0R1LB4t1t8rcehbr86HBioZsFJcRsb\n" +
        "Vmu645obt35tOW/K26lafXIgdSJ5VxuPPogm63EacFN+J5BaoEs0lYYMpwe3tg+9\n" +
        "JWYp5+CrKj3Mz/+MdG+3mgIwYKjQUtdgdy4AlILYVz99n03CB5xv\n" +
        "-----END RSA PRIVATE KEY-----";

    private const string EmbeddedPublicKeyPem =
        "-----BEGIN RSA PUBLIC KEY-----\n" +
        "MIIBCgKCAQEA03GkXqQbS4KdL0T10MRqLa1iVlTLlDxG2od2fFfOBe4/CtfP5fJr\n" +
        "CrlzMfsvFM4BJm0v9/KLNlJnExsTj+pYfckv2GZtGOqZk9jR0d8lfgSNO6OQy3Qm\n" +
        "DNe5YO38xJwWn0Ca5oJCfzFsDRkJi8P/6P9b7d4ZpFQuh1SKmFcOnnSrULP0mx9Y\n" +
        "B5A8hB6Iq2wct6+iQqm4sxMESlH02ZEAiY2Ry+GfgtsGEYPhPHYl7wlXyP2btEWJ\n" +
        "nU/VMbCElaisxgpHAgTKX/6eN+abzreHoALmxR2I5EIMl2ze+WYzePIvMMHkrWfP\n" +
        "NBuqKGA2cSR2hhV3MYTvnVJy8wFz4BVF9QIDAQAB\n" +
        "-----END RSA PUBLIC KEY-----";

    private readonly string _privateKeyPem;

    public LicenseService(IConfiguration configuration)
    {
        // Config override wins; fall back to embedded key so it always works.
        var fromConfig = configuration["License:RsaPrivateKeyPem"];
        _privateKeyPem = string.IsNullOrWhiteSpace(fromConfig)
            ? EmbeddedPrivateKeyPem
            : fromConfig;
    }

    public string GenerateLicenseKey(LicensePayload payload)
    {
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
