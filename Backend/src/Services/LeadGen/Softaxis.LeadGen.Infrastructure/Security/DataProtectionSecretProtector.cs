using Microsoft.AspNetCore.DataProtection;
using Softaxis.LeadGen.Application.Abstractions;

namespace Softaxis.LeadGen.Infrastructure.Security;

/// <summary>
/// Same Data-Protection-backed pattern every other service uses: its own purpose string, riding the
/// gateway's single shared key ring. Used for OAuth tokens, mailbox passwords and the signed
/// unsubscribe links — anything that must survive a restart but never sit in the database in clear.
/// </summary>
public sealed class DataProtectionSecretProtector : ISecretProtector
{
    private readonly IDataProtector _protector;

    public DataProtectionSecretProtector(IDataProtectionProvider provider)
        => _protector = provider.CreateProtector("Softaxis.LeadGen.Secrets.v1");

    public string? Protect(string? plaintext) =>
        string.IsNullOrEmpty(plaintext) ? null : _protector.Protect(plaintext);

    public string? Unprotect(string? protectedValue) =>
        string.IsNullOrEmpty(protectedValue) ? null : _protector.Unprotect(protectedValue);
}
