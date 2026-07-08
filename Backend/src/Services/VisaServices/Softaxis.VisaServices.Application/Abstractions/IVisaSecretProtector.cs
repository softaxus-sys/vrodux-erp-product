namespace Softaxis.VisaServices.Application.Abstractions;

/// <summary>Encrypts/decrypts channel credentials at rest (over ASP.NET Core Data Protection).</summary>
public interface IVisaSecretProtector
{
    string? Protect(string? plaintext);
    string? Unprotect(string? protectedValue);
}
