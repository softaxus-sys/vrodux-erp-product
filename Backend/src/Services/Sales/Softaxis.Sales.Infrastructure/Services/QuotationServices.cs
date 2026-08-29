using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using MimeKit;
using Softaxis.Sales.Application.Abstractions;
using Softaxis.Sales.Application.Quotations.Dtos;
using Softaxis.Sales.Infrastructure.Persistence;

namespace Softaxis.Sales.Infrastructure.Services;

/// <summary>
/// Builds customer-facing URLs from configured deployment settings.
///
/// The app's public origin is read from configuration, never from the inbound request: an API
/// call arrives at the gateway's host, so deriving the link from it would email customers a URL
/// pointing at the API rather than the app.
/// </summary>
internal sealed class PublicLinkBuilder(IConfiguration configuration) : IPublicLinkBuilder
{
    public string QuotationUrl(string token)
    {
        var baseUrl = configuration["Integrations:PublicBaseUrl"]
                   ?? configuration["FrontendUrl"]
                   ?? "http://localhost:5173";
        return $"{baseUrl.TrimEnd('/')}/q/{Uri.EscapeDataString(token)}";
    }
}

/// <summary>
/// Reads the issuing company's letterhead out of Identity's <c>app_settings</c>.
///
/// Cross-schema raw SQL against the same physical database, mirroring PosSessionLedger — Sales
/// has no project reference to Identity and should not acquire one just to read six strings.
/// Cached briefly: a public quotation page is unauthenticated and can be refreshed freely, so
/// the same six rows would otherwise be re-read on every hit.
/// </summary>
internal sealed class QuotationBrandingProvider(
    SalesDbContext db,
    IMemoryCache cache,
    ILogger<QuotationBrandingProvider> logger) : IQuotationBrandingProvider
{
    private sealed class SettingRow
    {
        public string SettingKey { get; set; } = string.Empty;
        public string? Value     { get; set; }
    }

    private sealed class TenantRow
    {
        public string Name { get; set; } = string.Empty;
    }

    public async Task<QuotationBrandingDto> GetAsync(Guid? tenantId, CancellationToken ct = default)
    {
        if (tenantId is null) return Fallback("Your Company");

        var key = $"quotation-branding::{tenantId}";
        if (cache.TryGetValue(key, out QuotationBrandingDto? cached) && cached is not null) return cached;

        var branding = await LoadAsync(tenantId.Value, ct);
        cache.Set(key, branding, TimeSpan.FromMinutes(5));
        return branding;
    }

    private async Task<QuotationBrandingDto> LoadAsync(Guid tenantId, CancellationToken ct)
    {
        try
        {
            // Company-wide settings only: UserId IS NULL excludes anyone's personal overrides.
            // "identity" is a reserved SQL Server keyword and MUST be bracketed.
            var rows = await db.Database
                .SqlQuery<SettingRow>($"""
                    SELECT [Key] AS SettingKey, [Value]
                    FROM [identity].[app_settings]
                    WHERE [TenantId] = {tenantId}
                      AND [Category] IN ('company', 'appearance')
                      AND [UserId] IS NULL
                    """)
                .ToListAsync(ct);

            var map = rows
                .Where(r => !string.IsNullOrWhiteSpace(r.Value))
                .GroupBy(r => r.SettingKey, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(g => g.Key, g => g.First().Value!, StringComparer.OrdinalIgnoreCase);

            string? Get(params string[] keys)
            {
                foreach (var k in keys)
                    if (map.TryGetValue(k, out var v) && !string.IsNullOrWhiteSpace(v)) return v.Trim();
                return null;
            }

            // The tenant's registered name is the last-resort letterhead: better a real company
            // name from the tenant record than "Your Company" on a document sent to a customer.
            var fallbackName = await db.Database
                .SqlQuery<TenantRow>($"SELECT TOP 1 [Name] FROM [identity].[tenants] WHERE [Id] = {tenantId}")
                .FirstOrDefaultAsync(ct);

            return new QuotationBrandingDto(
                CompanyName: Get("name", "companyName") ?? fallbackName?.Name ?? "Your Company",
                LegalName:   Get("legalName"),
                Address:     Get("address"),
                Phone:       Get("phone"),
                Email:       Get("email", "supportEmail"),
                Website:     Get("website"),
                TaxNumber:   Get("taxNumber", "trn", "registrationNo"),
                LogoUrl:     Get("logoUrl", "logo"),
                AccentColor: Get("accentColor", "primaryColor"));
        }
        catch (Exception ex)
        {
            // Branding is decoration. A settings-read failure must never stop a customer opening
            // the quotation they were sent.
            logger.LogWarning(ex, "Could not load quotation branding for tenant {TenantId}.", tenantId);
            return Fallback("Your Company");
        }
    }

    private static QuotationBrandingDto Fallback(string name) =>
        new(name, null, null, null, null, null, null, null, null);
}

/// <summary>
/// Emails the quotation link. Reads the same shared "Email" configuration section the gateway
/// already provides for Identity's password-reset mail — one SMTP account per deployment, not
/// one per service.
/// </summary>
internal sealed class SmtpQuotationEmailSender(
    IConfiguration configuration,
    ILogger<SmtpQuotationEmailSender> logger) : IQuotationEmailSender
{
    public async Task<bool> SendAsync(
        string toEmail, string? toName, string quotationNumber, string? title,
        string companyName, string publicUrl, string? message, string? validUntil,
        string formattedTotal, CancellationToken ct = default)
    {
        var section  = configuration.GetSection("Email");
        var host     = section["SmtpHost"];
        var port     = int.TryParse(section["SmtpPort"], out var p) ? p : 587;
        var username = section["SmtpUsername"];
        var password = section["SmtpPassword"];
        var fromAddr = section["FromAddress"] ?? "noreply@softaxis.io";
        var fromName = section["FromName"]    ?? companyName;

        if (string.IsNullOrWhiteSpace(host) || string.IsNullOrWhiteSpace(username))
        {
            // Dev fallback, same as the password-reset and employee-invite mail: log the link so
            // the flow is testable locally, and report false so the caller shows the share link
            // rather than claiming an email went out.
            logger.LogWarning("SMTP not configured. Quotation {Number} link for {Email}: {Url}",
                quotationNumber, toEmail, publicUrl);
            return false;
        }

        var subject = string.IsNullOrWhiteSpace(title)
            ? $"Quotation {quotationNumber} from {companyName}"
            : $"{title} — quotation {quotationNumber}";

        var msg = new MimeMessage();
        msg.From.Add(new MailboxAddress(fromName, fromAddr));
        msg.To.Add(new MailboxAddress(toName ?? toEmail, toEmail));
        msg.Subject = subject;
        msg.Body = new TextPart("html") { Text = BuildHtml(
            toName, quotationNumber, title, companyName, publicUrl, message, validUntil, formattedTotal) };

        try
        {
            using var client = new SmtpClient();
            var options = port == 465 ? SecureSocketOptions.SslOnConnect : SecureSocketOptions.StartTls;
            await client.ConnectAsync(host, port, options, ct);
            await client.AuthenticateAsync(username, password, ct);
            await client.SendAsync(msg, ct);
            await client.DisconnectAsync(true, ct);
            logger.LogInformation("Quotation {Number} emailed to {Email}.", quotationNumber, toEmail);
            return true;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to email quotation {Number} to {Email}.", quotationNumber, toEmail);
            return false;
        }
    }

    private static string BuildHtml(
        string? toName, string number, string? title, string company,
        string url, string? message, string? validUntil, string total)
    {
        static string Esc(string? s) => string.IsNullOrEmpty(s)
            ? string.Empty
            : s.Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;").Replace("\"", "&quot;");

        var greeting = string.IsNullOrWhiteSpace(toName) ? "Hello," : $"Hello {Esc(toName)},";
        var heading  = string.IsNullOrWhiteSpace(title) ? $"Quotation {Esc(number)}" : Esc(title);
        var intro    = string.IsNullOrWhiteSpace(message)
            ? $"{Esc(company)} has prepared a quotation for you."
            : Esc(message).Replace("\n", "<br/>");
        var validity = string.IsNullOrWhiteSpace(validUntil)
            ? string.Empty
            : $"<p style=\"margin:0 0 8px;color:#64748b;font-size:13px\">Valid until <strong>{Esc(validUntil)}</strong></p>";

        return $"""
            <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;background:#f8fafc;padding:32px">
              <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
                <div style="background:#0f172a;color:#ffffff;padding:24px 28px">
                  <p style="margin:0;font-size:13px;opacity:.75">{Esc(company)}</p>
                  <h1 style="margin:6px 0 0;font-size:20px;font-weight:600">{heading}</h1>
                </div>
                <div style="padding:28px">
                  <p style="margin:0 0 14px;font-size:15px;color:#0f172a">{greeting}</p>
                  <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#334155">{intro}</p>
                  <div style="background:#f1f5f9;border-radius:8px;padding:16px 18px;margin-bottom:22px">
                    <p style="margin:0 0 6px;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:.04em">Quotation {Esc(number)}</p>
                    <p style="margin:0 0 8px;font-size:24px;font-weight:700;color:#0f172a">{Esc(total)}</p>
                    {validity}
                  </div>
                  <a href="{Esc(url)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px">View &amp; respond</a>
                  <p style="margin:22px 0 0;font-size:12px;color:#94a3b8;line-height:1.6">
                    You can review the full quotation, accept or decline it online. If the button does not work,
                    paste this link into your browser:<br/>
                    <span style="color:#64748b;word-break:break-all">{Esc(url)}</span>
                  </p>
                </div>
              </div>
            </div>
            """;
    }
}
