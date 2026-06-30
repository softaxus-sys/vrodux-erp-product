namespace Softaxis.CRM.Application.LeadIntake.Abstractions;

/// <summary>
/// Encrypts/decrypts integration secrets (OAuth tokens, API keys, signing secrets) at rest.
/// Implemented over ASP.NET Core Data Protection (no extra dependency). Never persist a
/// secret without passing it through <see cref="Protect"/> first.
/// </summary>
public interface ISecretProtector
{
    /// <summary>Encrypt a plaintext secret. Returns null for null/empty input.</summary>
    string? Protect(string? plaintext);

    /// <summary>Decrypt a protected secret. Returns null for null/empty input.</summary>
    string? Unprotect(string? protectedValue);
}
