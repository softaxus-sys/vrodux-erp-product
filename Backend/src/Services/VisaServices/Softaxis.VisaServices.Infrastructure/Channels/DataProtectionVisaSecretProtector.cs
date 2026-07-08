using Microsoft.AspNetCore.DataProtection;
using Softaxis.VisaServices.Application.Abstractions;

namespace Softaxis.VisaServices.Infrastructure.Channels;

public sealed class DataProtectionVisaSecretProtector : IVisaSecretProtector
{
    private readonly IDataProtector _protector;

    public DataProtectionVisaSecretProtector(IDataProtectionProvider provider)
        => _protector = provider.CreateProtector("Softaxis.VisaServices.Channels.Secrets.v1");

    public string? Protect(string? plaintext) =>
        string.IsNullOrEmpty(plaintext) ? null : _protector.Protect(plaintext);

    public string? Unprotect(string? protectedValue) =>
        string.IsNullOrEmpty(protectedValue) ? null : _protector.Unprotect(protectedValue);
}
