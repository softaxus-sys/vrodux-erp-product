namespace Softaxis.RealEstate.Application.Abstractions;

/// <summary>Encrypts/decrypts the Qasro OAuth state at rest. Same contract as every other service's
/// secret protector (CRM, AiAssistant, POS, SEO, …) — one Data-Protection wrapper per service, own
/// purpose string, all riding the gateway's single shared key ring.</summary>
public interface ISecretProtector
{
    string? Protect(string? plaintext);
    string? Unprotect(string? protectedValue);
}
