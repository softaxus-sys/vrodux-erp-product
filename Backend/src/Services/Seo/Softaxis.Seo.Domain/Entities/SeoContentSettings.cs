namespace Softaxis.Seo.Domain.Entities;

/// <summary>
/// Per-site content-generation configuration. One row per site, lazily created the same way
/// SeoSite itself always exists once a site is connected — Enabled defaults to false, so connecting
/// a site never starts writing content until the tenant explicitly turns it on.
/// </summary>
public sealed class SeoContentSettings
{
    private SeoContentSettings() { }

    public SeoContentSettings(Guid siteId)
    {
        Id              = Guid.NewGuid();
        SiteId          = siteId;
        Enabled         = false;
        Frequency       = ContentFrequencies.Weekly;
        ArticlesPerRun  = 1;
        TargetWordCount = 900;
        CreatedAt       = DateTime.UtcNow;
    }

    public Guid     Id              { get; private set; }
    public Guid     SiteId          { get; private set; }
    public bool     Enabled         { get; private set; }
    public string   Frequency       { get; private set; } = ContentFrequencies.Weekly; // weekly | biweekly | monthly
    public int      ArticlesPerRun  { get; private set; } = 1;
    public int      TargetWordCount { get; private set; } = 900;
    /// <summary>Free-text steer for the AI — what the site is about / who it's for. Crawled pages
    /// alone often don't say enough (a thin homepage, a single-page site) to pick good topics.</summary>
    public string?  NicheHint       { get; private set; }
    /// <summary>Comma-separated competitor domains the tenant names manually — there is no automatic
    /// "find my competitors" step (see ContentResearch's own remarks on why).</summary>
    public string?  CompetitorDomainsCsv { get; private set; }
    public DateTime? NextRunAt      { get; private set; }
    public DateTime? LastRunAt      { get; private set; }

    public DateTime  CreatedAt { get; private set; }
    public DateTime? UpdatedAt { get; private set; }

    public void Update(bool enabled, string frequency, int articlesPerRun, int targetWordCount,
        string? nicheHint, string? competitorDomainsCsv)
    {
        var wasEnabled = Enabled;
        Enabled              = enabled;
        Frequency            = string.IsNullOrWhiteSpace(frequency) ? ContentFrequencies.Weekly : frequency.Trim().ToLowerInvariant();
        ArticlesPerRun       = Math.Clamp(articlesPerRun, 1, 5);
        TargetWordCount      = Math.Clamp(targetWordCount, 300, 3000);
        NicheHint            = string.IsNullOrWhiteSpace(nicheHint) ? null : nicheHint.Trim();
        CompetitorDomainsCsv = string.IsNullOrWhiteSpace(competitorDomainsCsv) ? null : competitorDomainsCsv.Trim();

        // Turning it on for the first time (or re-enabling) schedules the first run soon, mirroring
        // SeoSite's own "first scan runs soon after connect" — otherwise a monthly cadence would
        // leave the tenant waiting up to a month to see anything happen.
        if (enabled && (!wasEnabled || NextRunAt is null)) NextRunAt = DateTime.UtcNow.AddMinutes(10);
        if (!enabled) NextRunAt = null;
        Touch();
    }

    public void ScheduleNextRun(DateTime nextRunAt) { NextRunAt = nextRunAt; Touch(); }
    public void RecordRunCompleted(DateTime completedAt) { LastRunAt = completedAt; Touch(); }

    private void Touch() => UpdatedAt = DateTime.UtcNow;
}

public static class ContentFrequencies
{
    public const string Weekly   = "weekly";
    public const string Biweekly = "biweekly";
    public const string Monthly  = "monthly";

    public static DateTime NextRun(string frequency, DateTime from) => frequency switch
    {
        Biweekly => from.AddDays(14),
        Monthly  => from.AddMonths(1),
        _        => from.AddDays(7),
    };
}
