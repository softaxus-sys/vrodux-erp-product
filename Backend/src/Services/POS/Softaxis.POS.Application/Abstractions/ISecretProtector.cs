namespace Softaxis.POS.Application.Abstractions;

/// <summary>
/// Encrypts/decrypts secrets (payment gateway API keys) at rest. Implemented over ASP.NET Core Data
/// Protection (no extra dependency) — same pattern as CRM's integration secrets / Identity's TOTP
/// secrets / VisaServices' channel credentials. Never persist a secret without passing it through
/// <see cref="Protect"/> first.
/// </summary>
public interface ISecretProtector
{
    /// <summary>Encrypt a plaintext secret. Returns null for null/empty input.</summary>
    string? Protect(string? plaintext);

    /// <summary>Decrypt a protected secret. Returns null for null/empty input.</summary>
    string? Unprotect(string? protectedValue);
}
