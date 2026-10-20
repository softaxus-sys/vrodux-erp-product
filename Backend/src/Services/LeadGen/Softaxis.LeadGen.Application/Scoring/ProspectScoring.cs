using System.Text.Json;
using Softaxis.LeadGen.Domain.Entities;

namespace Softaxis.LeadGen.Application.Scoring;

/// <summary>What the scorer needs to know about a prospect — plain values, so it is easy to test.</summary>
public sealed record ScoreInput(
    string? PhoneE164, string? PhoneType, string? Website, bool WebsiteChecked, string? Email, string EmailStatus,
    bool EmailIsRole, bool HasSocial, string? BusinessStatus, decimal? Rating, int? ReviewCount, string? Address,
    string? Category, string? CategoryKey, string? Region, string? Name);

public sealed record ScoreProfile(
    IReadOnlyList<string> PreferredCategories, IReadOnlyList<string> PreferredRegions, IReadOnlyList<string> ExcludeWords);

public sealed record ScoreResult(int Quality, int Fit, IReadOnlyList<string> Notes);

/// <summary>
/// Two scores a user reads at a glance. Quality is "can I actually reach them" — how complete and
/// how verified the contact data is. Fit is "should I" — how well the business matches what the
/// workspace sells. Both are deterministic: the same inputs always give the same numbers, and every
/// number comes with the reasons behind it.
/// </summary>
public static class ProspectScoring
{
    public static ScoreResult Score(ScoreInput p, ScoreProfile? profile)
    {
        var notes = new List<string>();
        var q = 0;

        // Phone — a UAE mobile is also very likely a WhatsApp number, which is where business gets done.
        if (!string.IsNullOrWhiteSpace(p.PhoneE164))
        {
            if (p.PhoneType == "mobile") { q += 22; notes.Add("Mobile number — WhatsApp likely"); }
            else if (p.PhoneType == "landline") { q += 15; notes.Add("Landline number"); }
            else { q += 12; notes.Add("Phone number"); }
        }
        else notes.Add("No phone number");

        // Email — the heaviest factor, because email is what the module sends.
        switch (p.EmailStatus)
        {
            case EmailStatus.Valid when !p.EmailIsRole:  q += 36; notes.Add("Verified personal email"); break;
            case EmailStatus.Valid:                       q += 26; notes.Add("Verified company email"); break;
            case EmailStatus.Likely when !p.EmailIsRole:  q += 26; notes.Add("Personal email, domain accepts mail"); break;
            case EmailStatus.Likely:                      q += 17; notes.Add("Company email (info@ style) — lower reply rate"); break;
            case EmailStatus.Risky:                       q += 7;  notes.Add("Email may not be deliverable"); break;
            case EmailStatus.Invalid:
            case EmailStatus.Disposable:                  notes.Add("Email failed verification"); break;
            default:
                notes.Add(string.IsNullOrWhiteSpace(p.Email) ? "No email found" : "Email not verified");
                break;
        }

        if (!string.IsNullOrWhiteSpace(p.Website)) { q += 8; if (p.WebsiteChecked) q += 4; } else notes.Add("No website");
        if (p.HasSocial) { q += 5; notes.Add("Social profiles found"); }
        if (!string.IsNullOrWhiteSpace(p.Address)) q += 4;

        if (p.ReviewCount is >= 50) { q += 8; notes.Add("Well established (50+ reviews)"); }
        else if (p.ReviewCount is >= 10) q += 5;
        if (p.Rating is >= 4.0m && p.ReviewCount is >= 10) q += 3;

        if (p.BusinessStatus == "OPERATIONAL" || p.BusinessStatus is null) q += 8;
        else { q = Math.Min(q, 8); notes.Add(p.BusinessStatus == "CLOSED_PERMANENTLY" ? "Permanently closed" : "Temporarily closed"); }

        // Fit — only meaningful when the workspace has told us what it sells.
        var fit = 55;
        if (profile is not null)
        {
            if (profile.PreferredCategories.Count > 0)
            {
                if (p.CategoryKey is not null && profile.PreferredCategories.Contains(p.CategoryKey, StringComparer.OrdinalIgnoreCase))
                { fit += 25; notes.Add("In one of your target categories"); }
                else fit -= 10;
            }
            if (profile.PreferredRegions.Count > 0)
            {
                if (p.Region is not null && profile.PreferredRegions.Contains(p.Region, StringComparer.OrdinalIgnoreCase)) fit += 10;
                else fit -= 5;
            }
            var hay = $"{p.Name} {p.Category}".ToLowerInvariant();
            if (profile.ExcludeWords.Any(w => w.Length > 1 && hay.Contains(w.ToLowerInvariant())))
            { fit -= 35; notes.Add("Matches a word you excluded"); }
        }
        if (p.ReviewCount is >= 20) fit += 8; else if (p.ReviewCount is null or < 3) fit -= 5;
        if (p.BusinessStatus is not (null or "OPERATIONAL")) fit = Math.Min(fit, 10);

        return new ScoreResult(Math.Clamp(q, 0, 100), Math.Clamp(fit, 0, 100), notes);
    }

    public static string NotesJson(IReadOnlyList<string> notes) => JsonSerializer.Serialize(notes);

    public static IReadOnlyList<string> ParseList(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return [];
        try { return JsonSerializer.Deserialize<List<string>>(json) ?? []; } catch { return []; }
    }

    /// <summary>"info@", "sales@" … reaches a desk, not a person.</summary>
    public static bool IsRoleAddress(string email)
    {
        var local = email.Split('@')[0].ToLowerInvariant();
        return RoleLocals.Contains(local) || RoleLocals.Any(r => local.StartsWith(r + ".") || local.StartsWith(r + "-"));
    }

    private static readonly HashSet<string> RoleLocals = new(StringComparer.OrdinalIgnoreCase)
    {
        "info", "contact", "sales", "admin", "office", "hello", "enquiry", "enquiries", "inquiry", "inquiries",
        "support", "reception", "mail", "team", "customerservice", "service", "bookings", "booking", "reservations",
        "accounts", "hr", "careers", "jobs", "marketing", "orders", "general", "help", "care", "projects",
    };
}
