using System.Text.Json;
using Microsoft.Extensions.Logging;
using Softaxis.LeadGen.Application.Scoring;
using Softaxis.LeadGen.Domain.Entities;
using Softaxis.LeadGen.Infrastructure.Providers;

namespace Softaxis.LeadGen.Infrastructure.Services;

public sealed record Enrichment(
    string? Email, string EmailStatus, bool EmailIsRole, string? SocialJson,
    string? Phone, string? PhoneE164, string? PhoneType, bool WebsiteChecked, string? WebsiteNote);

/// <summary>
/// Turns a business with a name, a Google phone number and a website into something reachable: the
/// best email it publishes (checked), a normalised phone, its social profiles. It touches only the
/// network — never the database — so many can run at once while the caller does the saving.
/// </summary>
public interface IEnrichmentService
{
    Task<Enrichment> EnrichAsync(string? website, string? phone, string? knownEmail, string countryCode, CancellationToken ct);
}

internal sealed class EnrichmentService(IWebsiteEnricher website, IEmailChecker emails, ILogger<EnrichmentService> logger)
    : IEnrichmentService
{
    public async Task<Enrichment> EnrichAsync(string? site, string? phone, string? knownEmail, string countryCode, CancellationToken ct)
    {
        var region = countryCode.ToUpperInvariant();
        var phoneInfo = PhoneNormalizer.Normalize(phone, region);

        WebsiteFindings? found = null;
        if (!string.IsNullOrWhiteSpace(site))
        {
            try { found = await website.FetchAsync(site, region, ct); }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogDebug(ex, "Website enrichment failed for {Site}", site);
            }
        }

        // No Google phone? A number the business itself published (tel: / WhatsApp link) is as good.
        if (phoneInfo is null && found is not null)
            foreach (var p in found.Phones)
                if (PhoneNormalizer.Normalize(p, region) is { } n) { phoneInfo = n; break; }

        // Candidate emails in order of preference. Check up to three; take the first that is sendable.
        var candidates = new List<string>();
        if (!string.IsNullOrWhiteSpace(knownEmail)) candidates.Add(knownEmail.Trim().ToLowerInvariant());
        if (found is not null) foreach (var e in found.Emails) if (!candidates.Contains(e)) candidates.Add(e);

        string? bestEmail = null; var bestStatus = EmailStatus.Unknown; var bestRole = false;
        foreach (var candidate in candidates.Take(3))
        {
            var check = await emails.CheckAsync(candidate, ct);
            if (check.Status is EmailStatus.Invalid or EmailStatus.Disposable) continue;   // never keep a dead address

            if (bestEmail is null || Rank(check.Status) > Rank(bestStatus))
            {
                bestEmail = candidate; bestStatus = check.Status; bestRole = check.IsRole;
            }
            if (check.Status == EmailStatus.Valid && !check.IsRole) break;   // cannot do better
        }

        var social = found?.Social.Count > 0 ? JsonSerializer.Serialize(found.Social) : null;
        return new Enrichment(
            bestEmail, bestEmail is null ? EmailStatus.Unknown : bestStatus, bestRole, social,
            phoneInfo?.Display, phoneInfo?.E164, phoneInfo?.Type,
            WebsiteChecked: found?.Reachable == true, found?.Note);
    }

    private static int Rank(string status) => status switch
    {
        EmailStatus.Valid => 4, EmailStatus.Likely => 3, EmailStatus.Risky => 2, EmailStatus.Unknown => 1, _ => 0,
    };
}
