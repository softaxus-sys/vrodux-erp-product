namespace Softaxis.Identity.Application.Abstractions;

/// <summary>
/// RFC 6238 TOTP (time-based one-time password) — the standard behind Google Authenticator / Authy.
/// </summary>
public interface ITotpService
{
    /// <summary>Generate a new Base32-encoded shared secret.</summary>
    string GenerateSecret();

    /// <summary>Build the otpauth:// provisioning URI an authenticator app expects.</summary>
    string BuildOtpAuthUri(string secretBase32, string accountName, string issuer);

    /// <summary>Render the otpauth URI as a PNG data-URI QR code (<c>data:image/png;base64,…</c>).</summary>
    string BuildQrCodeDataUri(string otpAuthUri);

    /// <summary>Verify a 6-digit code with a ±window (default ±1) 30-second-step tolerance.</summary>
    bool VerifyCode(string secretBase32, string code, int window = 1);
}
