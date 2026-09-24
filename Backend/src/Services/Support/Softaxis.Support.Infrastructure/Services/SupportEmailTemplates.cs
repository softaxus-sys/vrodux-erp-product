using System.Net;
using Softaxis.Support.Domain.Entities;

namespace Softaxis.Support.Infrastructure.Services;

/// <summary>Small, dependency-free HTML builders. Every interpolated value is HTML-encoded —
/// a ticket subject or message body is user input and must not be able to break the markup.</summary>
internal static class SupportEmailTemplates
{
    private static string E(string? s) => WebUtility.HtmlEncode(s ?? string.Empty);

    private static string Wrap(string title, string bodyHtml) => $"""
        <div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;color:#0f172a;">
          <div style="background:#0f172a;color:#fff;padding:16px 24px;border-radius:8px 8px 0 0;">
            <strong>{title}</strong>
          </div>
          <div style="border:1px solid #e2e8f0;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
            {bodyHtml}
          </div>
        </div>
        """;

    public static (string Subject, string Html) TicketCreated(SupportTicket t) => (
        $"We've received your request — {E(t.TicketNumber)}",
        Wrap("VroduxERP Support", $"""
            <p>Hi {E(t.RequestingUserName)},</p>
            <p>Thanks for reaching out. We've opened ticket <strong>{E(t.TicketNumber)}</strong> for:</p>
            <p style="background:#f8fafc;border-radius:6px;padding:12px 16px;">{E(t.Subject)}</p>
            <p>A member of our team will follow up here by email, and you can also track and reply
               to this ticket any time from your workspace under <strong>Help &amp; Support</strong>.</p>
            """));

    /// <summary>Operator-side alert on a brand-new ticket — distinct from <see cref="TicketCreated"/>,
    /// which is the customer's own "we got it" confirmation. <paramref name="queueUrl"/> links
    /// straight to the queue (not the specific ticket — there is no per-ticket deep link today);
    /// the ticket number in the subject and body is how an agent finds it from there.</summary>
    public static (string Subject, string Html) NewTicketAlert(SupportTicket t, string queueUrl) => (
        $"New ticket {E(t.TicketNumber)} — {E(t.RequestingTenantName)} ({E(t.Priority)})",
        Wrap("New Support Ticket", $"""
            <p><strong>{E(t.RequestingTenantName)}</strong> ({E(t.RequestingUserName)}, {E(t.RequestingUserEmail)})
               opened ticket <strong>{E(t.TicketNumber)}</strong>:</p>
            <table style="width:100%;border-collapse:collapse;margin:8px 0 16px;">
              <tr><td style="padding:2px 8px 2px 0;color:#64748b;">Category</td><td>{E(t.Category)}</td></tr>
              <tr><td style="padding:2px 8px 2px 0;color:#64748b;">Priority</td><td>{E(t.Priority)}</td></tr>
            </table>
            <p style="background:#f8fafc;border-radius:6px;padding:12px 16px;">{E(t.Subject)}</p>
            <p><a href="{E(queueUrl)}" style="display:inline-block;background:#0f172a;color:#fff;
               text-decoration:none;font-weight:600;padding:10px 18px;border-radius:8px;">Open the queue</a></p>
            """));

    public static (string Subject, string Html) NewReply(SupportTicket t, TicketMessage m, bool toCustomer) => (
        $"New reply on {E(t.TicketNumber)} — {E(t.Subject)}",
        Wrap("VroduxERP Support", $"""
            <p>{(toCustomer ? "Our support team" : E(m.AuthorName))} replied to ticket
               <strong>{E(t.TicketNumber)}</strong>:</p>
            <p style="background:#f8fafc;border-radius:6px;padding:12px 16px;white-space:pre-wrap;">{E(m.Body)}</p>
            <p>{(toCustomer
                 ? "Reply from your workspace under <strong>Help &amp; Support</strong> to continue the conversation."
                 : "Reply from the Support queue to continue the conversation.")}</p>
            """));
}
