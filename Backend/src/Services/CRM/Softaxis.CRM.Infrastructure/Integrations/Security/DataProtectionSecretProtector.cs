using Microsoft.AspNetCore.DataProtection;
using Softaxis.CRM.Application.LeadIntake.Abstractions;

namespace Softaxis.CRM.Infrastructure.Integrations.Security;

/// <summary>
/// <see cref="ISecretProtector"/> backed by ASP.NET Core Data Protection. Uses a dedicated,
/// versioned purpose string so integration secrets can't be unprotected by other components.
/// </summary>
public sealed class DataProtectionSecretProtector : ISecretProtector
{
    private readonly IDataProtector _protector;

    public DataProtectionSecretProtector(IDataProtectionProvider provider)
        => _protector = provider.CreateProtector("Softaxis.CRM.Integrations.Secrets.v1");

    public string? Protect(string? plaintext) =>
        string.IsNullOrEmpty(plaintext) ? null : _protector.Protect(plaintext);

    public string? Unprotect(string? protectedValue) =>
        string.IsNullOrEmpty(protectedValue) ? null : _protector.Unprotect(protectedValue);
}
