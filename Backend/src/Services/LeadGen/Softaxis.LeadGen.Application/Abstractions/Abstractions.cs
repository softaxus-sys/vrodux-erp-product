namespace Softaxis.LeadGen.Application.Abstractions;

/// <summary>The signed-in user, read from the request's token.</summary>
public interface ICurrentUser
{
    Guid?   Id           { get; }
    string? Name         { get; }
    Guid?   TenantId     { get; }
    bool    IsSuperAdmin { get; }
    /// <summary>Subscription state from the token: "trial", "active", …</summary>
    string? SubscriptionState { get; }
    bool    HasPermission(string permissionKey);
    bool    HasModule(string module);
}

/// <summary>Encrypts what must not sit in the database in the clear: OAuth tokens, mailbox passwords.</summary>
public interface ISecretProtector
{
    string? Protect(string? plaintext);
    string? Unprotect(string? protectedValue);
}
