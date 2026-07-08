namespace Softaxis.CRM.Domain.Entities;

/// <summary>
/// Automatic rule-based lead scoring. Produces a 0–100 score from the signals available on a
/// <see cref="Lead"/> plus its engagement (number of activities logged). Pure and deterministic
/// (no I/O), so it can be called from create, update, the intake pipeline, and on activity logging.
///
/// Weighting (summed, then clamped to 0–100):
///   Purchase urgency (timeframe)    — max 25   immediate 25 … 6+/researching 3   (see PurchaseUrgency)
///   Contactability (reachability)   — max 20   email 8 · phone 7 · whatsapp 5
///   Buying intent                   — max 20   budget 8 · interested-in 7 · message 5
///   Deal value (estimated)          — max 15   tiered
///   Source quality                  — max 12   referral/partner 12 … cold_call 3
///   Priority (manual rep signal)    — max 8    high 8 · medium 4 · low 0
///   Engagement (activities logged)  — max 10   5 per activity
///
/// Banding used by the UI: ≥70 Hot · ≥40 Warm · &lt;40 Cold.
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

        // Purchase urgency — the strongest buying signal ("immediately" → hot).
        score += PurchaseUrgency.Score(purchaseTimeframe);

        // Contactability — a reachable lead is a workable lead.
        if (Has(email))    score += 8;
        if (Has(phone))    score += 7;
        if (Has(whatsApp)) score += 5;

        // Buying intent — the lead told us what they want / how much.
        if (Has(budget))       score += 8;
        if (Has(interestedIn)) score += 7;
        if (Has(message))      score += 5;

        // Deal value (may be derived from the budget when no explicit value was entered).
        score += ValueScore(estimatedValue);

        // Source quality.
        score += SourceScore(source);

        // Priority (manually set by the rep).
        score += PriorityScore(priority);

        // Engagement — 5 points per logged activity, capped.
        score += Math.Min(Math.Max(activityCount, 0) * 5, 10);

        return Math.Clamp(score, 0, 100);
    }

    private static bool Has(string? s) => !string.IsNullOrWhiteSpace(s);

    private static int SourceScore(string? source) => (source ?? "").Trim().ToLowerInvariant() switch
    {
        "referral" or "partner"                                           => 12,
        "website" or "property-finder" or "property_finder" or "walk_in"  => 9,
        "trade_show"                                                      => 9,
        "linkedin" or "social_media" or "email_campaign"                  => 7,
        "google_ads" or "meta" or "facebook" or "instagram" or "whatsapp" => 7,
        "cold_call"                                                       => 3,
        _                                                                 => 5, // unknown / generic "integration"
    };

    private static int ValueScore(decimal value) => value switch
    {
        >= 500_000 => 15,
        >= 100_000 => 12,
        >= 50_000  => 9,
        >= 10_000  => 6,
        > 0        => 3,
        _          => 0,
    };

    private static int PriorityScore(string? priority) => (priority ?? "").Trim().ToLowerInvariant() switch
    {
        "high"   => 8,
        "medium" => 4,
        _        => 0,
    };
}
