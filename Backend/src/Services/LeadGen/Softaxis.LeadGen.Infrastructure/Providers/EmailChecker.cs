using System.Net.Mail;
using System.Text.Json;
using System.Text.RegularExpressions;
using DnsClient;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Softaxis.LeadGen.Application.Scoring;
using Softaxis.LeadGen.Domain.Entities;
using Softaxis.LeadGen.Infrastructure.Options;

namespace Softaxis.LeadGen.Infrastructure.Providers;

public sealed record EmailCheck(string Status, bool IsRole, string? Reason);

/// <summary>
/// Decides how far an address can be trusted before it is ever sent to.
///
/// Three layers, cheapest first. (1) Syntax and a list of throwaway-mailbox domains. (2) DNS: the
/// domain must publish somewhere to deliver mail. (3) Optionally a verification provider that asks
/// the mail server about the specific mailbox. We never probe mailboxes ourselves over SMTP — from a
/// shared server it is unreliable, gets the address blocklisted and is exactly what a spammer does.
///
/// Honest status: without a provider the best an address can be is <c>likely</c> ("the domain takes
/// mail"); only <c>valid</c> means a provider confirmed the mailbox.
/// </summary>
public interface IEmailChecker
{
    bool ProviderConfigured { get; }
    Task<EmailCheck> CheckAsync(string email, CancellationToken ct);
}

internal sealed partial class EmailChecker(
    IHttpClientFactory http, IOptions<LeadGenOptions> options, ILogger<EmailChecker> logger) : IEmailChecker
{
    private static readonly LookupClient Dns = new(new LookupClientOptions { UseCache = true, Timeout = TimeSpan.FromSeconds(4), Retries = 1 });

    public bool ProviderConfigured => options.Value.EmailVerifier.IsConfigured;

    [GeneratedRegex(@"^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$")]
    private static partial Regex Syntax();

    public async Task<EmailCheck> CheckAsync(string email, CancellationToken ct)
    {
        email = (email ?? "").Trim().ToLowerInvariant();
        var isRole = email.Contains('@') && ProspectScoring.IsRoleAddress(email);

        if (email.Length is < 6 or > 254 || !Syntax().IsMatch(email)) return new(EmailStatus.Invalid, isRole, "Not a valid address");
        try { _ = new MailAddress(email); } catch (FormatException) { return new(EmailStatus.Invalid, isRole, "Not a valid address"); }

        var domain = email[(email.IndexOf('@') + 1)..];
        if (Disposable.Contains(domain)) return new(EmailStatus.Disposable, isRole, "Throwaway mailbox domain");
        if (PlaceholderDomains.Contains(domain) || domain.EndsWith(".png") || domain.EndsWith(".jpg") || domain.EndsWith(".webp") || domain.EndsWith(".svg"))
            return new(EmailStatus.Invalid, isRole, "Not a real mailbox");

        // DNS: a domain that publishes neither MX nor an address record cannot receive mail.
        try
        {
            var mx = await Dns.QueryAsync(domain, QueryType.MX, cancellationToken: ct);
            var hasMx = mx.Answers.MxRecords().Any(r => !string.IsNullOrWhiteSpace(r.Exchange.Value) && r.Exchange.Value != ".");
            if (!hasMx)
            {
                var a = await Dns.QueryAsync(domain, QueryType.A, cancellationToken: ct);
                if (!a.Answers.ARecords().Any()) return new(EmailStatus.Invalid, isRole, "The domain cannot receive email");
            }
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            // DNS being unreachable says nothing about the address. Do not condemn it.
            logger.LogDebug(ex, "DNS lookup failed for {Domain}", domain);
            return new(EmailStatus.Unknown, isRole, "Could not check the domain");
        }

        if (!ProviderConfigured) return new(EmailStatus.Likely, isRole, "Domain accepts email; mailbox not confirmed");
        return await VerifyWithProviderAsync(email, isRole, ct);
    }

    private async Task<EmailCheck> VerifyWithProviderAsync(string email, bool isRole, CancellationToken ct)
    {
        try
        {
            using var client = http.CreateClient("leadgen-api");
            var url = $"https://api.zerobounce.net/v2/validate?api_key={Uri.EscapeDataString(options.Value.EmailVerifier.ApiKey!)}&email={Uri.EscapeDataString(email)}";
            using var res = await client.GetAsync(url, ct);
            if (!res.IsSuccessStatusCode) return new(EmailStatus.Likely, isRole, "Verifier unavailable");

            using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync(ct));
            var status = doc.RootElement.TryGetProperty("status", out var s) ? s.GetString() : null;
            return status switch
            {
                "valid"                                          => new(EmailStatus.Valid, isRole, "Mailbox confirmed"),
                "catch-all"                                      => new(EmailStatus.Likely, isRole, "Server accepts any address"),
                "invalid" or "spamtrap" or "abuse" or "do_not_mail" => new(EmailStatus.Invalid, isRole, "Mailbox does not exist or must not be emailed"),
                "unknown"                                        => new(EmailStatus.Risky, isRole, "Mailbox could not be confirmed"),
                _                                                => new(EmailStatus.Likely, isRole, "Verifier gave no clear answer"),
            };
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning(ex, "Email verifier failed");
            return new(EmailStatus.Likely, isRole, "Verifier unavailable");
        }
    }

    private static readonly HashSet<string> PlaceholderDomains = new(StringComparer.OrdinalIgnoreCase)
    {
        "example.com", "example.org", "test.com", "domain.com", "yourdomain.com", "your-domain.com", "email.com",
        "sentry.io", "sentry-next.wixpress.com", "wixpress.com", "godaddy.com", "mysite.com", "company.com",
    };

    private static readonly HashSet<string> Disposable = new(StringComparer.OrdinalIgnoreCase)
    {
        "mailinator.com", "guerrillamail.com", "10minutemail.com", "tempmail.com", "temp-mail.org", "throwawaymail.com",
        "yopmail.com", "trashmail.com", "getnada.com", "maildrop.cc", "sharklasers.com", "dispostable.com", "fakeinbox.com",
        "mailnesia.com", "mintemail.com", "mohmal.com", "emailondeck.com", "burnermail.io", "spamgourmet.com",
        "tempinbox.com", "mytemp.email", "mailcatch.com", "tempail.com", "moakt.com", "33mail.com", "anonbox.net",
        "guerrillamail.net", "guerrillamail.org", "grr.la", "spam4.me", "mailforspam.com", "inboxkitten.com",
    };
}
