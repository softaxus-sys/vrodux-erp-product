using Softaxis.BuildingBlocks.Infrastructure.Email;
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
                AccentColor: Get("accentColor", "primaryColor"),
                SignatureUrl: Get("signatureUrl"),
                StampUrl:     Get("stampUrl"));
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
///
/// The message carries the company's letterhead: logo, name, address, phone, tax number. The logo
/// is attached inline (cid:) rather than linked or embedded as a data: URI, because Gmail,
/// Outlook and most webmail strip data: images and block remote ones until the reader opts in —
/// so a data URI would reach the customer as an empty box.
/// </summary>
internal sealed class SmtpQuotationEmailSender(
    IConfiguration configuration,
    ILogger<SmtpQuotationEmailSender> logger) : IQuotationEmailSender
{
    private const string LogoContentId = "company-logo@vrodux";

    public async Task<bool> SendAsync(
        string toEmail, string? toName, string quotationNumber, string? title,
        QuotationBrandingDto brand, bool showLogo, string? accentColor,
        string publicUrl, string? message, string? validUntil,
        string formattedTotal, string? footerNote, CancellationToken ct = default)
    {
        var companyName = brand.CompanyName;
        var section  = configuration.GetSection("Email");
        var host     = section["SmtpHost"];
        var port     = int.TryParse(section["SmtpPort"], out var p) ? p : 587;
        var username = section["SmtpUsername"];
        var password = section["SmtpPassword"];
        var fromAddr = EmailSender.Address(section["FromAddress"]);
        var fromName = !string.IsNullOrWhiteSpace(section["FromName"]) ? section["FromName"]!.Trim()
                     : EmailSender.Name(companyName);

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

        var logo   = showLogo ? ResolveLogo(brand.LogoUrl) : null;
        var accent = SafeColor(accentColor) ?? SafeColor(brand.AccentColor) ?? "#0f172a";

        var body = new BodyBuilder
        {
            HtmlBody = BuildHtml(toName, quotationNumber, title, brand, logo, accent,
                                 publicUrl, message, validUntil, formattedTotal, footerNote),
        };
        if (logo is { Bytes: not null })
        {
            var res = body.LinkedResources.Add("logo", logo.Bytes, ContentType.Parse(logo.MimeType));
            res.ContentId = LogoContentId;
        }

        var msg = new MimeMessage();
        msg.From.Add(new MailboxAddress(fromName, fromAddr));
        msg.To.Add(new MailboxAddress(toName ?? toEmail, toEmail));
        msg.Subject = subject;
        msg.Body = body.ToMessageBody();

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

    // ── Logo ──────────────────────────────────────────────────────────────────
    private sealed record LogoSource(byte[]? Bytes, string MimeType, string? RemoteUrl);

    /// <summary>
    /// The company logo is stored as a data: URI (there is no blob store). Raster formats are
    /// attached inline; a plain https URL is linked as-is; SVG is skipped — mail clients do not
    /// render it, and the company name in the header reads fine without it.
    /// </summary>
    private static LogoSource? ResolveLogo(string? logoUrl)
    {
        if (string.IsNullOrWhiteSpace(logoUrl)) return null;
        var v = logoUrl.Trim();

        if (v.StartsWith("data:", StringComparison.OrdinalIgnoreCase))
        {
            var comma = v.IndexOf(',');
            if (comma < 0) return null;
            var header = v[5..comma];                     // image/png;base64
            var mime   = header.Split(';')[0].ToLowerInvariant();
            if (!header.Contains("base64", StringComparison.OrdinalIgnoreCase)) return null;
            if (mime is not ("image/png" or "image/jpeg" or "image/jpg" or "image/gif" or "image/webp")) return null;
            try   { return new LogoSource(Convert.FromBase64String(v[(comma + 1)..]), mime == "image/jpg" ? "image/jpeg" : mime, null); }
            catch { return null; }
        }

        return v.StartsWith("https://", StringComparison.OrdinalIgnoreCase)
            ? new LogoSource(null, string.Empty, v)
            : null;
    }

    /// <summary>Only a plain hex colour is allowed through — it is written into inline CSS.</summary>
    private static string? SafeColor(string? c) =>
        !string.IsNullOrWhiteSpace(c)
        && System.Text.RegularExpressions.Regex.IsMatch(c.Trim(), "^#[0-9a-fA-F]{3,8}$")
            ? c.Trim() : null;

    private static string BuildHtml(
        string? toName, string number, string? title, QuotationBrandingDto brand,
        LogoSource? logo, string accent, string url, string? message,
        string? validUntil, string total, string? footerNote)
    {
        static string Esc(string? s) => string.IsNullOrEmpty(s)
            ? string.Empty
            : s.Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;").Replace("\"", "&quot;");

        var company  = brand.CompanyName;
        var greeting = string.IsNullOrWhiteSpace(toName) ? "Hello," : $"Hello {Esc(toName)},";
        var heading  = string.IsNullOrWhiteSpace(title) ? $"Quotation {Esc(number)}" : Esc(title);
        var intro    = string.IsNullOrWhiteSpace(message)
            ? $"{Esc(company)} has prepared a quotation for you."
            : Esc(message).Replace("\n", "<br/>");
        var validity = string.IsNullOrWhiteSpace(validUntil)
            ? string.Empty
            : $"<p style=\"margin:0 0 8px;color:#64748b;font-size:13px\">Valid until <strong>{Esc(validUntil)}</strong></p>";

        var logoSrc = logo is null ? null
            : logo.Bytes is not null ? $"cid:{LogoContentId}" : logo.RemoteUrl;
        var logoHtml = logoSrc is null ? string.Empty
            : $"<img src=\"{Esc(logoSrc)}\" alt=\"{Esc(company)}\" style=\"display:block;max-height:52px;max-width:200px;margin:0 0 12px;background:#ffffff;border-radius:6px;padding:6px\"/>";

        // Letterhead lines under the card — what the customer needs to reach or identify the sender.
        var contact = new List<string>();
        if (!string.IsNullOrWhiteSpace(brand.LegalName) && brand.LegalName != company) contact.Add(Esc(brand.LegalName));
        if (!string.IsNullOrWhiteSpace(brand.Address)) contact.Add(Esc(brand.Address).Replace("\n", ", "));
        var reach = new List<string>();
        if (!string.IsNullOrWhiteSpace(brand.Phone))   reach.Add(Esc(brand.Phone));
        if (!string.IsNullOrWhiteSpace(brand.Email))   reach.Add(Esc(brand.Email));
        if (!string.IsNullOrWhiteSpace(brand.Website)) reach.Add(Esc(brand.Website));
        if (reach.Count > 0)   contact.Add(string.Join(" · ", reach));
        if (!string.IsNullOrWhiteSpace(brand.TaxNumber)) contact.Add($"TRN: {Esc(brand.TaxNumber)}");

        var letterhead = contact.Count == 0 ? string.Empty
            : $"<div style=\"padding:16px 28px;border-top:1px solid #e2e8f0;background:#f8fafc;font-size:11.5px;line-height:1.6;color:#64748b\"><strong style=\"color:#334155\">{Esc(company)}</strong><br/>{string.Join("<br/>", contact)}</div>";

        var footer = string.IsNullOrWhiteSpace(footerNote) ? string.Empty
            : $"<p style=\"margin:18px 0 0;font-size:13px;color:#475569\">{Esc(footerNote).Replace("\n", "<br/>")}</p>";

        return $"""
            <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;background:#f8fafc;padding:32px">
              <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
                <div style="background:{accent};color:#ffffff;padding:24px 28px">
                  {logoHtml}
                  <p style="margin:0;font-size:13px;opacity:.85">{Esc(company)}</p>
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
                  <a href="{Esc(url)}" style="display:inline-block;background:{accent};color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px">View &amp; respond</a>
                  <p style="margin:22px 0 0;font-size:12px;color:#94a3b8;line-height:1.6">
                    You can review the full quotation, download it, and accept or decline it online. If the button does not work,
                    paste this link into your browser:<br/>
                    <span style="color:#64748b;word-break:break-all">{Esc(url)}</span>
                  </p>
                  {footer}
                </div>
                {letterhead}
              </div>
            </div>
            """;
    }
}
