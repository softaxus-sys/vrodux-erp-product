namespace Softaxis.Calendar.Application.Abstractions;

/// <summary>Reads the authenticated user from the request's JWT claims.</summary>
public interface ICurrentUser
{
    Guid?   Id       { get; }
    string? Username { get; }
    string? Email    { get; }
    bool    IsSuperAdmin { get; }
    Guid?   TenantId { get; }
}

/// <summary>Encrypts/decrypts Google tokens at rest (Data Protection, own purpose string).</summary>
public interface ISecretProtector
{
    string? Protect(string? plaintext);
    string? Unprotect(string? protectedValue);
}
