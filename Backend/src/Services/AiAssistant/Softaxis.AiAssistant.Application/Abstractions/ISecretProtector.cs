namespace Softaxis.AiAssistant.Application.Abstractions;

/// <summary>Encrypts/decrypts tenant API keys at rest (ASP.NET Core Data Protection).</summary>
public interface ISecretProtector
{
    string? Protect(string? plaintext);
    string? Unprotect(string? protectedValue);
}
