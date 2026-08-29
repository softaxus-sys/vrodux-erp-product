using Microsoft.Extensions.Configuration;

namespace Softaxis.Identity.Infrastructure.Services;

/// <summary>
/// Decides whether outgoing mail is actually usable.
/// <para>
/// Shared by <see cref="SmtpEmailService"/> and the host's startup check so the two can never
/// disagree about what "configured" means — a startup banner saying mail is fine while every send
/// fails is worse than no banner.
/// </para>
/// </summary>
public static class SmtpConfiguration
{
    public static readonly string[] RequiredKeys = ["SmtpHost", "SmtpUsername", "SmtpPassword"];

    /// <summary>
    /// True for a value that is present but is obviously a stand-in. appsettings.json ships
    /// <c>__SET_SMTP_PASSWORD_VIA_ENV_OR_DEV_SETTINGS__</c> so the shape of the config is visible;
    /// a plain empty-check treats that as a real password, hands it to the SMTP server and gets a
    /// 535 on every send. Same convention as the JWT secret placeholder.
    /// </summary>
    public static bool IsPlaceholder(string? value) =>
        value is not null
        && (value.StartsWith("__SET_", StringComparison.Ordinal)
            || value.Contains("CHANGE_ME", StringComparison.OrdinalIgnoreCase));

    public static bool IsSet(string? value) =>
        !string.IsNullOrWhiteSpace(value) && !IsPlaceholder(value);

    /// <summary>The required keys that are missing or still hold a placeholder.</summary>
    public static string[] MissingKeys(IConfiguration configuration)
    {
        var section = configuration.GetSection("Email");
        return [.. RequiredKeys.Where(k => !IsSet(section[k]))];
    }

    public static bool IsConfigured(IConfigurationSection emailSection) =>
        RequiredKeys.All(k => IsSet(emailSection[k]));
}
