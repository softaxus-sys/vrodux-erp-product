using Microsoft.AspNetCore.DataProtection;
using Softaxis.Restaurant.Application.Abstractions;

namespace Softaxis.Restaurant.Infrastructure.Services;

/// <summary>
/// <see cref="ISecretProtector"/> backed by ASP.NET Core Data Protection — dedicated, versioned
/// purpose string so Restaurant secrets can't be unprotected by other services sharing the gateway's
/// key ring (see CRM's Module 7/11).
/// </summary>
public sealed class DataProtectionSecretProtector : ISecretProtector
{
    private readonly IDataProtector _protector;

    public DataProtectionSecretProtector(IDataProtectionProvider provider)
        => _protector = provider.CreateProtector("Softaxis.Restaurant.Notifications.Secrets.v1");

    public string? Protect(string? plaintext) =>
        string.IsNullOrEmpty(plaintext) ? null : _protector.Protect(plaintext);

    public string? Unprotect(string? protectedValue) =>
        string.IsNullOrEmpty(protectedValue) ? null : _protector.Unprotect(protectedValue);
}
