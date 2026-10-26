using System.Net;
using System.Text;

namespace Softaxis.BuildingBlocks.Infrastructure.Email;

public enum EmailTone { Info, Success, Warning, Danger }

/// <summary>One "label: value" line in an email's details table.</summary>
public sealed record EmailDetail(string Label, string Value);

/// <summary>
/// The one look for Vrodux's own system emails (account, security, billing, receipts).
///
/// Written for mail clients, not browsers: table layout, every style inlined (Gmail and Outlook strip
/// stylesheets), no remote images (blocked by default, so a logo would arrive as a broken box — the
/// brand is set as text), and a "bulletproof" button built from a table cell so it renders in
/// Outlook. A hidden preheader gives the inbox preview line something better than "Hi Ahmed,".
///
/// Callers pass <c>bodyHtml</c> as HTML they have already encoded; every other string
/// (title, details, link text, notes) is encoded here, because names and workspaces are user input
/// and one unescaped ampersand breaks the markup.
/// </summary>
public static class BrandedEmail
{
    public static string E(string? s) => WebUtility.HtmlEncode(s ?? string.Empty);

    private static (string Bar, string Band, string Text) Palette(EmailTone tone) => tone switch
    {
        EmailTone.Success => ("#16a34a", "#f0fdf4", "#166534"),
        EmailTone.Warning => ("#d97706", "#fffbeb", "#92400e"),
        EmailTone.Danger  => ("#dc2626", "#fef2f2", "#991b1b"),
        _                 => ("#2563eb", "#eff6ff", "#1e40af"),
    };

    /// <param name="title">The heading.</param>
    /// <param name="bodyHtml">Paragraphs, already HTML-encoded by the caller. Use <see cref="P"/> to build them.</param>
    /// <param name="preheader">Inbox preview text.</param>
    /// <param name="ctaText">Button label (needs <paramref name="ctaUrl"/>).</param>
    /// <param name="ctaUrl">Where the button goes. Also shown as a copyable link underneath.</param>
    /// <param name="details">Optional label/value table (plan, amount, dates…).</param>
    /// <param name="note">Optional highlighted box, coloured by <paramref name="tone"/>.</param>
    /// <param name="footerNote">The "why you got this" line.</param>
    public static string Render(
        string title,
        string bodyHtml,
        string? preheader = null,
        string? ctaText = null,
        string? ctaUrl = null,
        IReadOnlyList<EmailDetail>? details = null,
        string? note = null,
        EmailTone tone = EmailTone.Info,
        string? footerNote = null)
    {
        var (bar, band, text) = Palette(tone);
        var sb = new StringBuilder(4096);

        sb.Append("<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">");
        sb.Append("<meta name=\"color-scheme\" content=\"light only\"><title>").Append(E(title)).Append("</title></head>");
        sb.Append("<body style=\"margin:0;padding:0;background:#f1f5f9;-webkit-text-size-adjust:100%\">");

        if (!string.IsNullOrWhiteSpace(preheader))
            sb.Append("<div style=\"display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px\">")
              .Append(E(preheader)).Append("&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>");

        sb.Append("<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"background:#f1f5f9;padding:28px 12px\"><tr><td align=\"center\">");
        sb.Append("<table role=\"presentation\" width=\"600\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"width:100%;max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif\">");

        // Brand bar
        sb.Append("<tr><td style=\"background:#0f172a;padding:20px 32px\">")
          .Append("<span style=\"display:inline-block;width:28px;height:28px;line-height:28px;text-align:center;border-radius:8px;background:").Append(bar)
          .Append(";color:#ffffff;font-size:16px;font-weight:700;vertical-align:middle\">V</span>")
          .Append("<span style=\"color:#ffffff;font-size:18px;font-weight:700;letter-spacing:.2px;vertical-align:middle;padding-left:10px\">Vrodux ERP</span>")
          .Append("</td></tr>");
        sb.Append("<tr><td style=\"height:4px;background:").Append(bar).Append(";font-size:0;line-height:0\">&nbsp;</td></tr>");

        // Body
        sb.Append("<tr><td style=\"padding:32px 32px 8px;color:#334155;font-size:15px;line-height:1.6\">");
        sb.Append("<h1 style=\"margin:0 0 16px;font-size:22px;line-height:1.3;color:#0f172a;font-weight:700\">").Append(E(title)).Append("</h1>");
        sb.Append(bodyHtml);

        if (details is { Count: > 0 })
        {
            sb.Append("<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"margin:20px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px\"><tr><td style=\"padding:6px 18px\">");
            sb.Append("<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\">");
            for (var i = 0; i < details.Count; i++)
            {
                var border = i < details.Count - 1 ? "border-bottom:1px solid #e2e8f0;" : "";
                sb.Append("<tr><td style=\"padding:11px 12px 11px 0;color:#64748b;font-size:13px;").Append(border).Append("width:40%;vertical-align:top\">")
                  .Append(E(details[i].Label)).Append("</td><td style=\"padding:11px 0;color:#0f172a;font-size:14px;font-weight:600;text-align:right;").Append(border).Append("vertical-align:top\">")
                  .Append(E(details[i].Value)).Append("</td></tr>");
            }
            sb.Append("</table></td></tr></table>");
        }

        if (!string.IsNullOrWhiteSpace(note))
            sb.Append("<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"margin:18px 0\"><tr><td style=\"background:")
              .Append(band).Append(";border-left:4px solid ").Append(bar).Append(";border-radius:8px;padding:14px 16px;color:").Append(text)
              .Append(";font-size:14px;line-height:1.5\">").Append(note).Append("</td></tr></table>");

        if (!string.IsNullOrWhiteSpace(ctaText) && !string.IsNullOrWhiteSpace(ctaUrl))
        {
            var url = E(ctaUrl);
            sb.Append("<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"margin:26px 0 8px\"><tr><td align=\"center\" style=\"border-radius:10px;background:#2563eb\">")
              .Append("<a href=\"").Append(url).Append("\" target=\"_blank\" style=\"display:inline-block;padding:14px 30px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;background:#2563eb\">")
              .Append(E(ctaText)).Append("</a></td></tr></table>");
            sb.Append("<p style=\"margin:18px 0 0;font-size:12px;line-height:1.5;color:#64748b\">Button not working? Copy this link into your browser:<br>")
              .Append("<a href=\"").Append(url).Append("\" style=\"color:#2563eb;word-break:break-all\">").Append(url).Append("</a></p>");
        }

        sb.Append("</td></tr>");
        sb.Append("<tr><td style=\"padding:0 32px 28px\">&nbsp;</td></tr>");

        // Footer
        sb.Append("<tr><td style=\"background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 32px;color:#94a3b8;font-size:12px;line-height:1.6\">");
        if (!string.IsNullOrWhiteSpace(footerNote)) sb.Append(E(footerNote)).Append("<br>");
        sb.Append("Sent by Vrodux ERP &middot; <a href=\"https://vrodux.com\" style=\"color:#94a3b8\">vrodux.com</a><br>")
          .Append("&copy; ").Append(DateTime.UtcNow.Year).Append(" Vrodux. All rights reserved.");
        sb.Append("</td></tr>");

        sb.Append("</table></td></tr></table></body></html>");
        return sb.ToString();
    }

    /// <summary>A body paragraph. <paramref name="html"/> must already be encoded (use <see cref="E"/> and <see cref="B"/>).</summary>
    public static string P(string html) => $"<p style=\"margin:0 0 14px\">{html}</p>";

    /// <summary>Bold, encoded — for names inside a paragraph.</summary>
    public static string B(string? text) => $"<strong style=\"color:#0f172a\">{E(text)}</strong>";
}
