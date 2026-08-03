using Microsoft.AspNetCore.DataProtection;
using Softaxis.POS.Application.Abstractions;

namespace Softaxis.POS.Infrastructure.Security;

/// <summary>
/// <see cref="ISecretProtector"/> backed by ASP.NET Core Data Protection. Uses a dedicated, versioned
/// purpose string so POS secrets can't be unprotected by other services sharing the same key ring
/// (the gateway's Data Protection key ring is shared process-wide — see CRM's Module 7/11).
/// </summary>
public sealed class DataProtectionSecretProtector : ISecretProtector
{
    private readonly IDataProtector _protector;

    public DataProtectionSecretProtector(IDataProtectionProvider provider)
        => _protector = provider.CreateProtector("Softaxis.POS.PaymentGateway.Secrets.v1");

    public string? Protect(string? plaintext) =>
        string.IsNullOrEmpty(plaintext) ? null : _protector.Protect(plaintext);

    public string? Unprotect(string? protectedValue) =>
        string.IsNullOrEmpty(protectedValue) ? null : _protector.Unprotect(protectedValue);
}
