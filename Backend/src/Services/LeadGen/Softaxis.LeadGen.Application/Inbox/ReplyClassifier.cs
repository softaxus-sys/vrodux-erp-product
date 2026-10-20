using System.Text.RegularExpressions;
using Softaxis.LeadGen.Domain.Entities;

namespace Softaxis.LeadGen.Application.Inbox;

/// <summary>
/// Labels an incoming reply from what the person actually wrote. Deliberately rule-based and
/// conservative: a wrong "unsubscribe" silences a real prospect, so only unambiguous phrases trigger
/// it, and anything unclear stays unlabelled for a human to read. Labels are suggestions the user can
/// change — except unsubscribe, which is honoured at once because the law and common decency expect it.
/// </summary>
public static partial class ReplyClassifier
{
    [GeneratedRegex(@"^\s*(on .{5,120} wrote:|le .{5,120} a écrit|-{2,}\s*original message|-{2,}\s*forwarded|from:\s.+@|sent from my )", RegexOptions.IgnoreCase | RegexOptions.Multiline)]
    private static partial Regex QuoteStart();

    /// <summary>Only what the person wrote, without the quoted copy of our own email beneath it.</summary>
    public static string NewText(string? body)
    {
        if (string.IsNullOrWhiteSpace(body)) return "";
        var text = body.Replace("\r\n", "\n");
        var m = QuoteStart().Match(text);
        if (m.Success) text = text[..m.Index];
        var lines = text.Split('\n').TakeWhile(l => !l.TrimStart().StartsWith('>')).ToArray();
        var cut = string.Join("\n", lines).Trim();
        return cut.Length > 4000 ? cut[..4000] : cut;
    }

    private static readonly string[] Unsubscribe =
    [
        "unsubscribe", "remove me", "remove us", "stop emailing", "stop sending", "stop contacting", "do not contact",
        "don't contact", "do not email", "don't email", "take me off", "take us off", "opt out", "opt-out", "delete my",
        "إلغاء الاشتراك", "لا تراسلوني", "لا ترسل",
    ];

    private static readonly string[] NotInterested =
    [
        "not interested", "no thanks", "no thank you", "not looking", "don't need", "do not need", "already have",
        "not relevant", "no need", "we're good", "we are good", "not at this time", "غير مهتم", "لا نحتاج",
    ];

    private static readonly string[] Interested =
    [
        "interested", "tell me more", "send me", "send us", "more details", "more information", "pricing", "price list",
        "quote", "quotation", "call me", "call us", "let's talk", "let us talk", "schedule", "book a", "demo", "meeting",
        "yes please", "sounds good", "مهتم", "ارسل", "أرسل", "اتصل",
    ];

    public static string Classify(string? subject, string? body, bool isAutoReply)
    {
        if (isAutoReply) return ThreadClass.OutOfOffice;

        var text = NewText(body).ToLowerInvariant();
        var head = ((subject ?? "").ToLowerInvariant() + " " + (text.Length > 700 ? text[..700] : text));

        if (Unsubscribe.Any(head.Contains)) return ThreadClass.Unsubscribe;
        if (NotInterested.Any(head.Contains)) return ThreadClass.NotInterested;
        if (Interested.Any(head.Contains)) return ThreadClass.Interested;
        if (text.Contains('?')) return ThreadClass.Question;
        return ThreadClass.None;
    }
}
