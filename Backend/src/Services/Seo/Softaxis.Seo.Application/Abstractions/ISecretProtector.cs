namespace Softaxis.Seo.Application.Abstractions;

/// <summary>Encrypts/decrypts Google OAuth tokens at rest. Same contract as every other service's
/// secret protector (CRM, AiAssistant, POS, …) — one Data-Protection wrapper per service, own
/// purpose string, all riding the gateway's single shared key ring.</summary>
public interface ISecretProtector
{
    string? Protect(string? plaintext);
    string? Unprotect(string? protectedValue);
}
