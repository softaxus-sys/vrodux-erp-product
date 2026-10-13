namespace Softaxis.Identity.Application.Abstractions;

/// <summary>What the ad platform needs to recognise and de-duplicate one trial signup.</summary>
public sealed record TrialConversion(
    string  Email,
    string  FullName,
    string? Country,
    string? EventId,        // same id the browser Pixel used, so Meta counts the pair once
    string? Fbp,            // _fbp cookie
    string? Fbc,            // _fbc cookie / fbclid-derived
    string? ClientIp,
    string? UserAgent,
    string? SourceUrl,
    string? Plan);

/// <summary>Server-side (Conversions API) mirror of the browser Pixel's StartTrial event.</summary>
public interface IConversionTracker
{
    /// <summary>Best-effort. Never throws and never blocks signup; a no-op when not configured.</summary>
    Task TrackTrialStartedAsync(TrialConversion conversion, CancellationToken ct);
}
