using Microsoft.AspNetCore.DataProtection;
using Softaxis.Calendar.Application.Abstractions;

namespace Softaxis.Calendar.Infrastructure.Security;

/// <summary>Same Data-Protection-backed pattern every other service uses - own purpose string, rides
/// the gateway's single shared key ring.</summary>
public sealed class DataProtectionSecretProtector : ISecretProtector
{
    private readonly IDataProtector _protector;

    public DataProtectionSecretProtector(IDataProtectionProvider provider)
        => _protector = provider.CreateProtector("Softaxis.Calendar.Google.Secrets.v1");

    public string? Protect(string? plaintext) =>
        string.IsNullOrEmpty(plaintext) ? null : _protector.Protect(plaintext);

    public string? Unprotect(string? protectedValue) =>
        string.IsNullOrEmpty(protectedValue) ? null : _protector.Unprotect(protectedValue);
}
