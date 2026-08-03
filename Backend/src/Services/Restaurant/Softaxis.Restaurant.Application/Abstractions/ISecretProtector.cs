namespace Softaxis.Restaurant.Application.Abstractions;

/// <summary>
/// Encrypts/decrypts secrets (SMS/WhatsApp provider credentials) at rest — over ASP.NET Core Data
/// Protection, same pattern as CRM's integration secrets / POS's payment-gateway secrets / Identity's
/// TOTP secrets. Never persist a secret without passing it through <see cref="Protect"/> first.
/// </summary>
public interface ISecretProtector
{
    string? Protect(string? plaintext);
    string? Unprotect(string? protectedValue);
}
