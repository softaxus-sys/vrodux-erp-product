using System.Security.Cryptography;
using System.Text;
using QRCoder;
using Softaxis.Identity.Application.Abstractions;

namespace Softaxis.Identity.Infrastructure.Services;

/// <summary>
/// Self-contained RFC 6238 TOTP (HMAC-SHA1, 6 digits, 30-second step) — compatible with Google
/// Authenticator, Microsoft Authenticator, Authy, 1Password, etc. No external OTP dependency.
/// </summary>
public sealed class TotpService : ITotpService
{
    private const int    Digits        = 6;
    private const int    PeriodSeconds = 30;
    private const string Base32Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; // RFC 4648

    public string GenerateSecret() =>
        Base32Encode(RandomNumberGenerator.GetBytes(20)); // 160-bit secret

    public string BuildOtpAuthUri(string secretBase32, string accountName, string issuer)
    {
        var label     = Uri.EscapeDataString($"{issuer}:{accountName}");
        var issuerEnc = Uri.EscapeDataString(issuer);
        return $"otpauth://totp/{label}?secret={secretBase32}&issuer={issuerEnc}&algorithm=SHA1&digits={Digits}&period={PeriodSeconds}";
    }

    public string BuildQrCodeDataUri(string otpAuthUri)
    {
        using var generator = new QRCodeGenerator();
        using var data      = generator.CreateQrCode(otpAuthUri, QRCodeGenerator.ECCLevel.Q);
        var png = new PngByteQRCode(data).GetGraphic(6);
        return $"data:image/png;base64,{Convert.ToBase64String(png)}";
    }

    public bool VerifyCode(string secretBase32, string code, int window = 1)
    {
        if (string.IsNullOrWhiteSpace(code)) return false;
        code = code.Trim();
        if (code.Length != Digits || !code.All(char.IsDigit)) return false;

        var key     = Base32Decode(secretBase32);
        if (key.Length == 0) return false;
        var counter = DateTimeOffset.UtcNow.ToUnixTimeSeconds() / PeriodSeconds;

        for (var i = -window; i <= window; i++)
            if (CryptographicOperations.FixedTimeEquals(
                    Encoding.ASCII.GetBytes(Compute(key, counter + i)),
                    Encoding.ASCII.GetBytes(code)))
                return true;

        return false;
    }

    private static string Compute(byte[] key, long counter)
    {
        var msg = BitConverter.GetBytes(counter);
        if (BitConverter.IsLittleEndian) Array.Reverse(msg);

        var hash   = HMACSHA1.HashData(key, msg);
        var offset = hash[^1] & 0x0F;
        var binary = ((hash[offset]     & 0x7F) << 24)
                   | ((hash[offset + 1] & 0xFF) << 16)
                   | ((hash[offset + 2] & 0xFF) << 8)
                   |  (hash[offset + 3] & 0xFF);
        var otp = binary % (int)Math.Pow(10, Digits);
        return otp.ToString().PadLeft(Digits, '0');
    }

    // ── Base32 (RFC 4648, no padding) ─────────────────────────────────────────

    private static string Base32Encode(byte[] data)
    {
        var sb = new StringBuilder();
        int bits = 0, value = 0;
        foreach (var b in data)
        {
            value = (value << 8) | b;
            bits += 8;
            while (bits >= 5)
            {
                sb.Append(Base32Alphabet[(value >> (bits - 5)) & 31]);
                bits -= 5;
            }
        }
        if (bits > 0)
            sb.Append(Base32Alphabet[(value << (5 - bits)) & 31]);
        return sb.ToString();
    }

    private static byte[] Base32Decode(string input)
    {
        input = input.Trim().TrimEnd('=').ToUpperInvariant().Replace(" ", "");
        var bytes = new List<byte>(input.Length * 5 / 8 + 1);
        int bits = 0, value = 0;
        foreach (var c in input)
        {
            var idx = Base32Alphabet.IndexOf(c);
            if (idx < 0) continue;
            value = (value << 5) | idx;
            bits += 5;
            if (bits >= 8)
            {
                bytes.Add((byte)((value >> (bits - 8)) & 0xFF));
                bits -= 8;
            }
        }
        return bytes.ToArray();
    }
}
