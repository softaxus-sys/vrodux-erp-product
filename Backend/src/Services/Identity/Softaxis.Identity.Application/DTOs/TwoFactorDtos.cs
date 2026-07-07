namespace Softaxis.Identity.Application.DTOs;

/// <summary>Returned when a user starts 2FA setup — secret + QR for the authenticator app.</summary>
public sealed record TwoFactorSetupDto(string Secret, string OtpAuthUri, string QrCodeDataUri);

/// <summary>Returned once 2FA is enabled — the plaintext one-time backup codes, shown only this once.</summary>
public sealed record TwoFactorEnableResultDto(IReadOnlyList<string> BackupCodes);

/// <summary>Current 2FA state for a user.</summary>
public sealed record TwoFactorStatusDto(bool Enabled, int BackupCodesRemaining);
