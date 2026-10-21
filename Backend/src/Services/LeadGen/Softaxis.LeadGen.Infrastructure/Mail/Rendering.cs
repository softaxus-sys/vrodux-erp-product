using System.Net;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Options;
using Softaxis.LeadGen.Application.Abstractions;
using Softaxis.LeadGen.Application.Campaigns;
using Softaxis.LeadGen.Domain.Entities;
using Softaxis.LeadGen.Infrastructure.Options;
using Softaxis.LeadGen.Infrastructure.Services;

namespace Softaxis.LeadGen.Infrastructure.Mail;

public sealed record RenderedEmail(string Subject, string Text, string Html);

internal interface IEmailRenderer
{
    RenderedEmail Render(string subjectTemplate, string bodyTemplate, Prospect prospect, LeadGenProfile? profile,
        string? senderName, string unsubscribeUrl);
}

/// <summary>
/// Turns a campaign step into the email a person receives. The footer is not optional: a cold email
/// must say who it is from, where they are, and how to stop receiving it — that is both the law in
/// most countries and what keeps a sending domain out of spam folders.
/// </summary>
internal sealed partial class EmailRenderer : IEmailRenderer
{
    [GeneratedRegex(@"(https?://[^\s<>""]+[^\s<>"".,;:!?)])")]
    private static partial Regex Url();

    public RenderedEmail Render(string subjectTemplate, string bodyTemplate, Prospect p, LeadGenProfile? profile,
        string? senderName, string unsubscribeUrl)
    {
        var values = new Dictionary<string, string?>
        {
            ["business_name"] = p.Name,
            ["category"] = ProspectSupport.LabelOf(p.Category)?.ToLowerInvariant(),
            ["area"] = p.Area ?? p.City ?? p.Region,
            ["city"] = p.City ?? p.Region,
            ["region"] = p.Region,
            ["website"] = p.Domain,
            ["sender_name"] = senderName ?? profile?.SenderBusinessName,
            ["sender_business"] = profile?.SenderBusinessName,
        };

        var subject = MergeFields.Render(subjectTemplate, values).Replace("\r", " ").Replace("\n", " ").Trim();
        var body = Reflow(MergeFields.Render(bodyTemplate, values).Replace("\r\n", "\n").Trim());

        var footerLines = new List<string>();
        if (!string.IsNullOrWhiteSpace(profile?.SenderBusinessName)) footerLines.Add(profile!.SenderBusinessName!);
        if (!string.IsNullOrWhiteSpace(profile?.SenderAddress)) footerLines.Add(profile!.SenderAddress!);
        var footerNote = "You are receiving this because your business is publicly listed. If you would rather not hear from us, unsubscribe here:";

        var text = new StringBuilder(body).Append("\n\n--\n");
        foreach (var l in footerLines) text.Append(l).Append('\n');
        text.Append(footerNote).Append('\n').Append(unsubscribeUrl);

        return new RenderedEmail(subject, text.ToString(), ToHtml(body, footerLines, footerNote, unsubscribeUrl));
    }

    /// <summary>
    /// Templates are often typed or pasted with hard line breaks every ~70 characters (a text editor's
    /// wrap), which made a sentence break mid-line in the received email. A single newline inside a
    /// paragraph is joined with a space when the line is long and does not end a sentence; short lines
    /// (greetings, "Best regards,", the signature) and blank-line paragraph breaks are kept as written.
    /// </summary>
    internal static string Reflow(string body)
    {
        var paragraphs = Regex.Split(body, @"\n{2,}");
        var result = new List<string>();
        foreach (var para in paragraphs)
        {
            var lines = para.Split('\n');
            var sb = new StringBuilder(lines[0]);
            for (var i = 1; i < lines.Length; i++)
            {
                var prev = lines[i - 1].TrimEnd();
                var softWrap = prev.Length >= 40 && !".!?:".Contains(prev[^1]);
                sb.Append(softWrap ? " " : "\n").Append(lines[i].TrimStart());
            }
            result.Add(sb.ToString());
        }
        return string.Join("\n\n", result);
    }

    private static string ToHtml(string body, List<string> footer, string note, string unsubscribeUrl)
    {
        string Para(string block)
        {
            var enc = WebUtility.HtmlEncode(block).Replace("\n", "<br>");
            return "<p style=\"margin:0 0 14px 0\">" + Url().Replace(enc, m => $"<a href=\"{m.Value}\">{m.Value}</a>") + "</p>";
        }

        var sb = new StringBuilder("<div style=\"font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:#1f2937\">");
        foreach (var block in Regex.Split(body, @"\n{2,}")) if (block.Trim().Length > 0) sb.Append(Para(block.Trim()));
        sb.Append("<div style=\"margin-top:22px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:11px;line-height:1.5;color:#6b7280\">");
        foreach (var l in footer) sb.Append(WebUtility.HtmlEncode(l)).Append("<br>");
        sb.Append(WebUtility.HtmlEncode(note)).Append(" <a href=\"").Append(WebUtility.HtmlEncode(unsubscribeUrl)).Append("\" style=\"color:#6b7280\">Unsubscribe</a>");
        sb.Append("</div></div>");
        return sb.ToString();
    }

    /// <summary>Plain reply text to HTML, with no marketing footer — a reply inside a conversation is a person talking.</summary>
    public static string ReplyHtml(string text)
    {
        var enc = WebUtility.HtmlEncode(text.Trim()).Replace("\n", "<br>");
        return "<div style=\"font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:#1f2937\">" +
               Url().Replace(enc, m => $"<a href=\"{m.Value}\">{m.Value}</a>") + "</div>";
    }
}

/// <summary>
/// Signed unsubscribe links. The token carries the workspace and the address, sealed by Data
/// Protection so it cannot be forged or edited; it has no expiry, because an unsubscribe link in an
/// old email must still work.
/// </summary>
internal interface IUnsubscribeTokens
{
    string Create(Guid tenantId, string email, Guid? campaignId);
    (Guid TenantId, string Email, Guid? CampaignId)? Read(string token);
    string UrlFor(Guid tenantId, string email, Guid? campaignId);
}

internal sealed class UnsubscribeTokens(ISecretProtector protector, IOptions<LeadGenOptions> options, Microsoft.Extensions.Configuration.IConfiguration config)
    : IUnsubscribeTokens
{
    public string Create(Guid tenantId, string email, Guid? campaignId) =>
        protector.Protect($"{tenantId}|{email.Trim().ToLowerInvariant()}|{campaignId}")!;

    public (Guid, string, Guid?)? Read(string token)
    {
        try
        {
            var parts = (protector.Unprotect(token) ?? "").Split('|');
            if (parts.Length != 3 || !Guid.TryParse(parts[0], out var tenant) || !parts[1].Contains('@')) return null;
            return (tenant, parts[1], Guid.TryParse(parts[2], out var c) ? c : null);
        }
        catch { return null; }
    }

    public string UrlFor(Guid tenantId, string email, Guid? campaignId)
    {
        var apiBase = (options.Value.PublicApiUrl ?? options.Value.PublicBaseUrl ?? config["Billing:PublicBaseUrl"] ?? "http://localhost:5000").TrimEnd('/');
        return $"{apiBase}/api/leadgen/unsubscribe/{Create(tenantId, email, campaignId)}";
    }
}
