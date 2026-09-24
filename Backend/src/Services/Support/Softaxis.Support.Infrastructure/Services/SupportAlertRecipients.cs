using Microsoft.Extensions.Configuration;
using Softaxis.BuildingBlocks.Infrastructure.Email;

namespace Softaxis.Support.Infrastructure.Services;

/// <summary>
/// Who at Softaxis hears about ticket activity.
///
/// <para>Defaults to the same <c>Email:FromAddress</c> (env <c>Email__FromAddress</c>) every other
/// notification in this app already sends FROM — noreply@vrodux.com is monitored, so there is no
/// separate inbox to configure. <c>Support:AlertEmails</c> (env <c>Support__AlertEmails</c>,
/// comma/semicolon-separated) is an optional override — set it only if support alerts should ever
/// go somewhere else, or to more than one address, without touching the sender identity everything
/// else relies on.</para>
/// </summary>
internal static class SupportAlertRecipients
{
    public static IReadOnlyList<string> Get(IConfiguration configuration)
    {
        var configured = configuration["Support:AlertEmails"];
        if (!string.IsNullOrWhiteSpace(configured))
            return configured.Split([',', ';'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        return [EmailSender.Address(configuration["Email:FromAddress"])];
    }
}
