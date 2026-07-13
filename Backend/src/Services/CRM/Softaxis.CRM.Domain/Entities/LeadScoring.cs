namespace Softaxis.CRM.Domain.Entities;

/// <summary>
/// Automatic rule-based lead scoring. Produces a 0–100 score from the signals available on a
/// <see cref="Lead"/> plus its engagement (number of activities logged). Pure and deterministic
/// (no I/O), so it can be called from create, update, the intake pipeline, and on activity logging.
///
/// Intent-first weighting (summed, then clamped to 0–100). Buying intent dominates so the score
/// reflects how HOT a lead is, not just how much data it has:
///   Purchase urgency (timeframe)        — max 28   immediate 28 · 1mo 22 · 1-3mo 14 · 3-6mo 7 · 6+ 3
///   Intent keywords (message/interest)  — max 12   "ready to buy", "cash", "urgent", "site visit", …
///   Budget stated                       — max 10   a lead who gave a budget is serious
///   Interested-in stated                — max 6
///   Contactability                      — max 15   phone 6 · whatsapp 5 · email 4
///   Deal value (estimated, unreliable)  — max 8    tiered, low weight (raw budget text is the human signal)
///   Source quality                      — max 8
///   Priority (manual rep signal)        — max 5
///   Engagement (activities logged)      — max 8    4 per activity
///
/// Banding used by the UI: ≥70 Hot · ≥40 Warm · &lt;40 Cold.  (Intent factors alone can reach ~56.)
/// </summary>
public static class LeadScoring
{
    public static int Calculate(
        string? email, string? phone, string? whatsApp,
        string? budget, string? interestedIn, string? message,
        string? source, string? priority, decimal estimatedValue,
        int activityCount, string? purchaseTimeframe)
    {
        var score = 0;

        // ── Buying intent (the bulk of the score) ────────────────────────────────
        score += PurchaseUrgency.Score(purchaseTimeframe);   // when they want to buy — strongest signal
        score += IntentKeywordScore(message, interestedIn);  // what they said
        if (Has(budget))       score += 10;                  // gave a budget → serious
        if (Has(interestedIn)) score += 6;                   // knows what they want

        // ── Contactability ───────────────────────────────────────────────────────
        if (Has(phone))    score += 6;
        if (Has(whatsApp)) score += 5;
        if (Has(email))    score += 4;

        // ── Supporting factors ───────────────────────────────────────────────────
        score += ValueScore(estimatedValue);   // low weight — derived value is only a rough estimate
        score += SourceScore(source);
        score += PriorityScore(priority);
        score += Math.Min(Math.Max(activityCount, 0) * 4, 8); // engagement

        return Math.Clamp(score, 0, 100);
    }

    private static bool Has(string? s) => !string.IsNullOrWhiteSpace(s);

    // Strong buying-intent phrases a lead may use in the message / interest field.
    private static readonly string[] IntentKeywords =
    [
        "ready to buy", "ready to invest", "ready to move", "want to buy", "looking to buy",
        "interested to buy", "cash buyer", "cash", "urgent", "urgently", "asap", "immediately",
        "pre-approved", "preapproved", "finance ready", "loan approved", "mortgage approved",
        "serious buyer", "serious", "book now", "booking", "site visit", "viewing", "final",
        "need urgently", "confirm", "invest",
    ];

    private static int IntentKeywordScore(string? message, string? interestedIn)
    {
        var t = ((message ?? string.Empty) + " " + (interestedIn ?? string.Empty)).Trim().ToLowerInvariant();
        if (t.Length == 0) return 0;
        var hits = 0;
        foreach (var k in IntentKeywords) if (t.Contains(k)) hits++;
        return Math.Min(hits * 4, 12);
    }

    private static int SourceScore(string? source) => (source ?? "").Trim().ToLowerInvariant() switch
    {
        "referral" or "partner"                                           => 8,
        "website" or "property-finder" or "property_finder" or "walk_in"  => 6,
        "trade_show"                                                      => 6,
        "linkedin" or "social_media" or "email_campaign"                  => 5,
        "google_ads" or "meta" or "facebook" or "instagram" or "whatsapp" => 5,
        "cold_call"                                                       => 2,
        _                                                                 => 4, // unknown / generic "integration"
    };

    private static int ValueScore(decimal value) => value switch
    {
        >= 1_000_000 => 8,
        >= 500_000   => 7,
        >= 100_000   => 5,
        >= 50_000    => 3,
        > 0          => 1,
        _            => 0,
    };

    private static int PriorityScore(string? priority) => (priority ?? "").Trim().ToLowerInvariant() switch
    {
        "high"   => 5,
        "medium" => 3,
        _        => 0,
    };
}
