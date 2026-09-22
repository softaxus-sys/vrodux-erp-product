namespace Softaxis.BuildingBlocks.Infrastructure.Email;

/// <summary>
/// Resolves the From header every service's SMTP sender uses, from the shared <c>Email</c> config
/// section (<c>Email:FromAddress</c> / <c>Email:FromName</c>, env <c>Email__FromAddress</c>).
///
/// Blank counts as missing, not just null: docker-compose passes an unset <c>${SMTP_FROM_ADDRESS}</c>
/// through as an empty string, which a plain <c>??</c> lets through as an empty From address that
/// every SMTP relay rejects.
///
/// The SMTP login is deliberately NOT used as a fallback — with ZeptoMail the username is the literal
/// <c>emailapikey</c>, not a mailbox.
/// </summary>
public static class EmailSender
{
    public const string DefaultAddress = "noreply@vrodux.com";
    public const string DefaultName    = "Vrodux ERP";

    public static string Address(string? configured) =>
        string.IsNullOrWhiteSpace(configured) ? DefaultAddress : configured.Trim();

    public static string Name(string? configured) =>
        string.IsNullOrWhiteSpace(configured) ? DefaultName : configured.Trim();
}
