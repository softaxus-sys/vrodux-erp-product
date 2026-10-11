using System.Globalization;
using System.Net;
using System.Text;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using MimeKit;
using Softaxis.BuildingBlocks.Infrastructure.Email;
using Softaxis.POS.Application.Customers.Credit;

namespace Softaxis.POS.Infrastructure.Services;

internal interface ICreditMailSender
{
    bool IsConfigured { get; }
    Task<bool> SendAsync(string toEmail, string toName, string fromName, string subject, string html, string? cc, CancellationToken ct = default);
}

/// <summary>
/// Uses the shared "Email" config section (one mail account per deployment). Optional
/// "Email:PickupDirectory" writes each message as an .eml file instead of sending, for trying the
/// reminders on a machine with no mail account.
/// </summary>
internal sealed class SmtpCreditMailSender(IConfiguration configuration, ILogger<SmtpCreditMailSender> logger) : ICreditMailSender
{
    private string? PickupDirectory => string.IsNullOrWhiteSpace(configuration["Email:PickupDirectory"]) ? null : configuration["Email:PickupDirectory"];

    public bool IsConfigured
    {
        get
        {
            if (PickupDirectory is not null) return true;
            var s = configuration.GetSection("Email");
            return !string.IsNullOrWhiteSpace(s["SmtpHost"]) && !string.IsNullOrWhiteSpace(s["SmtpUsername"]);
        }
    }

    public async Task<bool> SendAsync(string toEmail, string toName, string fromName, string subject, string html, string? cc, CancellationToken ct = default)
    {
        if (!IsConfigured)
        {
            logger.LogWarning("SMTP not configured. Credit reminder \"{Subject}\" would have gone to {Email}.", subject, toEmail);
            return false;
        }
        var section = configuration.GetSection("Email");
        var port = int.Parse(section["SmtpPort"] ?? "587", CultureInfo.InvariantCulture);

        var message = new MimeMessage();
        // The shop's name is shown; the address stays the deployment's own, or the mail is rejected.
        message.From.Add(new MailboxAddress(fromName, EmailSender.Address(section["FromAddress"])));
        message.To.Add(new MailboxAddress(toName, toEmail));
        if (!string.IsNullOrWhiteSpace(cc)) message.Cc.Add(MailboxAddress.Parse(cc));
        message.Subject = subject;
        message.Body = new TextPart("html") { Text = html };

        try
        {
            if (PickupDirectory is { } pickup)
            {
                Directory.CreateDirectory(pickup);
                await message.WriteToAsync(Path.Combine(pickup, $"{DateTime.UtcNow:yyyyMMdd-HHmmss}-{Guid.NewGuid():N}.eml"), ct);
                return true;
            }
            using var client = new SmtpClient();
            await client.ConnectAsync(section["SmtpHost"], port, port == 465 ? SecureSocketOptions.SslOnConnect : SecureSocketOptions.StartTls, ct);
            await client.AuthenticateAsync(section["SmtpUsername"], section["SmtpPassword"] ?? string.Empty, ct);
            await client.SendAsync(message, ct);
            await client.DisconnectAsync(true, ct);
            return true;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to send credit reminder \"{Subject}\" to {Email}.", subject, toEmail);
            return false;
        }
    }
}

/// <summary>The reminder email. Styles are inlined (mail clients strip stylesheets) and every value is HTML-encoded.</summary>
internal static class CreditEmailTemplate
{
    public static (string Subject, string Html) Build(string kind, string shop, string customer, string currency,
        IReadOnlyList<CreditItemDto> items, decimal totalOwed)
    {
        static string E(string s) => WebUtility.HtmlEncode(s);
        string Money(decimal v) => $"{currency} {v.ToString("N2", CultureInfo.InvariantCulture)}";
        var late = items.Where(i => i.DaysOverdue > 0).ToList();
        var listed = kind == "due_soon" ? items.Where(i => i.DaysOverdue == 0).ToList()
                   : late.Count > 0 ? late : items.ToList();
        var listedTotal = listed.Sum(i => i.Outstanding);

        var (subject, lead) = kind switch
        {
            "due_soon" => ($"A payment to {shop} is due soon",
                $"This is a friendly reminder that {Money(listedTotal)} on your account with {E(shop)} falls due shortly."),
            _ when late.Count > 0 => ($"Overdue payment to {shop}",
                $"Our records show {Money(late.Sum(i => i.Outstanding))} on your account with {E(shop)} is past its due date. If you have already paid, please ignore this message."),
            _ => ($"Your account with {shop}",
                $"Here is a summary of what is outstanding on your account with {E(shop)}."),
        };

        var sb = new StringBuilder();
        sb.Append("<div style=\"font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1f2937\">");
        sb.Append($"<h2 style=\"margin:0 0 12px\">{E(shop)}</h2>");
        sb.Append($"<p>Dear {E(customer)},</p><p>{lead}</p>");
        sb.Append("<table style=\"width:100%;border-collapse:collapse;font-size:14px\"><thead><tr style=\"background:#f3f4f6;text-align:left\">");
        sb.Append("<th style=\"padding:8px\">Invoice</th><th style=\"padding:8px\">Due</th><th style=\"padding:8px;text-align:right\">Amount</th></tr></thead><tbody>");
        foreach (var i in listed)
        {
            var status = i.DaysOverdue > 0 ? $" <span style=\"color:#b91c1c\">({i.DaysOverdue} days late)</span>" : "";
            sb.Append($"<tr><td style=\"padding:8px;border-bottom:1px solid #e5e7eb\">{E(string.IsNullOrWhiteSpace(i.Reference) ? "Sale" : i.Reference)}</td>");
            sb.Append($"<td style=\"padding:8px;border-bottom:1px solid #e5e7eb\">{E(i.DueOn)}{status}</td>");
            sb.Append($"<td style=\"padding:8px;border-bottom:1px solid #e5e7eb;text-align:right\">{Money(i.Outstanding)}</td></tr>");
        }
        sb.Append("</tbody></table>");
        sb.Append($"<p style=\"font-size:15px\"><strong>Total owed on your account: {Money(totalOwed)}</strong></p>");
        sb.Append($"<p>Please arrange payment at your earliest convenience. Thank you,<br/>{E(shop)}</p></div>");
        return (subject, sb.ToString());
    }
}
