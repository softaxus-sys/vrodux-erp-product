namespace Softaxis.Seo.Domain.Entities;

/// <summary>
/// A tenant's connected website. Ownership is proven the same way <c>Integration.InboundKey</c>
/// proves it elsewhere in this codebase: possession of the opaque <see cref="SnippetKey"/> embedded
/// in the tenant's own page is the evidence — the first real ping from that domain flips
/// <see cref="VerificationStatus"/> to verified. No separate DNS/meta-tag verification system.
/// </summary>
public sealed class SeoSite
{
    private SeoSite() { }

    public SeoSite(string domain, string displayName, string scanFrequency)
    {
        Id                  = Guid.NewGuid();
        Domain              = NormalizeDomain(domain);
        DisplayName         = displayName.Trim();
        ScanFrequency       = string.IsNullOrWhiteSpace(scanFrequency) ? ScanFrequencies.Weekly : scanFrequency.Trim().ToLowerInvariant();
        SnippetKey          = GenerateSnippetKey();
        VerificationStatus  = "pending";
        Status              = "active";
        NextScanAt          = DateTime.UtcNow.AddMinutes(5); // first scan runs soon after connect
        CreatedAt           = DateTime.UtcNow;
    }

    public Guid      Id                 { get; private set; }
    public string    Domain             { get; private set; } = string.Empty;
    public string    DisplayName        { get; private set; } = string.Empty;
    /// <summary>Opaque, unguessable key embedded in the tenant's snippet URL.</summary>
    public string     SnippetKey         { get; private set; } = string.Empty;
    public string     ScanFrequency      { get; private set; } = ScanFrequencies.Weekly;
    public DateTime?  NextScanAt         { get; private set; }
    public string     VerificationStatus { get; private set; } = "pending"; // pending | verified
    public DateTime?  VerifiedAt         { get; private set; }
    public DateTime?  LastSeenAt         { get; private set; }
    public DateTime?  LastScanAt         { get; private set; }
    public string     Status             { get; private set; } = "active"; // active | paused

    public bool      IsDeleted { get; private set; }
    public DateTime  CreatedAt { get; private set; }
    public DateTime? UpdatedAt { get; private set; }

    public void Rename(string displayName)      { DisplayName = displayName.Trim(); Touch(); }
    public void SetScanFrequency(string freq)   { ScanFrequency = freq.Trim().ToLowerInvariant(); Touch(); }

    /// <summary>Called on every snippet load — the verification signal and the freshness heartbeat.</summary>
    public void RecordPing()
    {
        LastSeenAt = DateTime.UtcNow;
        if (VerificationStatus != "verified")
        {
            VerificationStatus = "verified";
            VerifiedAt = DateTime.UtcNow;
        }
        Touch();
    }

    public void ScheduleNextScan(DateTime nextRunAt)         { NextScanAt = nextRunAt; Touch(); }
    public void RecordScanCompleted(DateTime completedAt)    { LastScanAt = completedAt; Touch(); }

    public void Pause()  { Status = "paused"; Touch(); }
    public void Resume() { Status = "active"; Touch(); }
    public void Delete() { IsDeleted = true; Touch(); }

    public void RotateSnippetKey() { SnippetKey = GenerateSnippetKey(); Touch(); }

    private void Touch() => UpdatedAt = DateTime.UtcNow;

    private static string GenerateSnippetKey() =>
        Convert.ToHexString(System.Security.Cryptography.RandomNumberGenerator.GetBytes(20)).ToLowerInvariant();

    private static string NormalizeDomain(string domain)
    {
        var d = domain.Trim().ToLowerInvariant();
        if (d.StartsWith("https://", StringComparison.Ordinal)) d = d["https://".Length..];
        else if (d.StartsWith("http://", StringComparison.Ordinal)) d = d["http://".Length..];
        return d.TrimEnd('/');
    }
}

public static class ScanFrequencies
{
    public const string Weekly  = "weekly";
    public const string Monthly = "monthly";

    public static DateTime NextRun(string frequency, DateTime from) =>
        frequency == Monthly ? from.AddMonths(1) : from.AddDays(7);
}
