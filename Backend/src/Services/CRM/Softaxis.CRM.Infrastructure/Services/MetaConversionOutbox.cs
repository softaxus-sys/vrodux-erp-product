using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using Softaxis.CRM.Domain.Entities;
using Softaxis.CRM.Domain.Entities.Integrations;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Services;

/// <summary>
/// Meta matches an event to a person by comparing HASHED contact details against its own. If our
/// normalisation differs from Meta's by even one character the hashes differ and the event matches nobody
/// — silently — so the rules here follow Meta's published ones exactly and are unit-tested.
/// </summary>
internal static class MetaHashing
{
    /// <summary>SHA-256, lower-case hex — the only form Meta accepts.</summary>
    public static string Sha256(string normalised) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(normalised))).ToLowerInvariant();

    public static string? Email(string? email)
    {
        var e = email?.Trim().ToLowerInvariant();
        return string.IsNullOrEmpty(e) || !e.Contains('@') ? null : Sha256(e);
    }

    /// <summary>
    /// Digits only, country code included, no leading zeros or "+" — e.g. 971501234567.
    /// A number we cannot complete (a local "050…" with no calling code to add) returns null rather than a
    /// hash of something Meta will never match: an unmatched event is worse than an omitted field.
    /// </summary>
    public static string? Phone(string? phone, string? defaultCallingCode)
    {
        if (string.IsNullOrWhiteSpace(phone)) return null;
        var raw = phone.Trim();
        var digits = new string(raw.Where(char.IsAsciiDigit).ToArray());
        if (digits.Length == 0) return null;

        if (raw.StartsWith('+')) { /* already international */ }
        else if (digits.StartsWith("00")) digits = digits[2..];
        else if (digits.StartsWith('0'))
        {
            if (string.IsNullOrEmpty(defaultCallingCode)) return null;
            digits = defaultCallingCode + digits.TrimStart('0');
        }
        else if (digits.Length is >= 7 and < 11 && !string.IsNullOrEmpty(defaultCallingCode)
                 && !digits.StartsWith(defaultCallingCode))
        {
            // A national number written without its leading zero (9 digits for the UAE).
            digits = defaultCallingCode + digits;
        }

        return digits.Length is >= 8 and <= 15 ? Sha256(digits) : null;
    }

    /// <summary>Lower-case, letters only — Meta strips punctuation, digits and spaces from names before hashing.</summary>
    public static string? Name(string? name)
    {
        var n = new string((name ?? "").Where(c => char.IsLetter(c) || c == ' ').ToArray()).Trim().ToLowerInvariant();
        return n.Length == 0 ? null : Sha256(n);
    }

    /// <summary>City: lower-case letters, no spaces.</summary>
    public static string? City(string? city)
    {
        var c = new string((city ?? "").Where(char.IsLetter).ToArray()).ToLowerInvariant();
        return c.Length == 0 ? null : Sha256(c);
    }
}

/// <summary>Builds the rows the outbox stores. Pure, so the rules are testable without a database.</summary>
internal static class MetaConversionBuilder
{
    /// <summary>The hashed identity block (Meta's <c>user_data</c>) as stored on an event.</summary>
    public static string BuildUserData(Lead lead, string metaLeadId, string? defaultCallingCode)
    {
        var u = new JsonObject();
        void Add(string key, string? hash) { if (hash is not null) u[key] = new JsonArray(hash); }

        Add("em", MetaHashing.Email(lead.Email));
        // Phone and WhatsApp are both numbers the person gave us; either may be the one Meta knows.
        var ph = new JsonArray();
        foreach (var h in new[] { MetaHashing.Phone(lead.Phone, defaultCallingCode), MetaHashing.Phone(lead.WhatsApp, defaultCallingCode) }
                     .Where(h => h is not null).Distinct())
            ph.Add(h!);
        if (ph.Count > 0) u["ph"] = ph;
        Add("fn", MetaHashing.Name(lead.FirstName));
        Add("ln", MetaHashing.Name(lead.LastName));
        Add("ct", MetaHashing.City(lead.City));

        // Meta's lead id is a 15–17 digit number and is documented as a number; send it as one.
        if (long.TryParse(metaLeadId, out var id)) u["lead_id"] = id; else u["lead_id"] = metaLeadId;
        return u.ToJsonString();
    }

    /// <summary>
    /// A deal's value to report: what it actually closed at once won, the quoted value before that.
    /// Null when there is nothing meaningful to say — a zero would tell Meta the sale was worth nothing.
    /// </summary>
    public static (decimal? Value, string? Currency) DealValue(Deal deal, string stage, bool sendValue)
    {
        if (!sendValue) return (null, null);
        var v = stage == "won" ? deal.RealizedValue : deal.Value;
        return v > 0 ? (Math.Round(v, 2), string.IsNullOrWhiteSpace(deal.Currency) ? null : deal.Currency.ToUpperInvariant()) : (null, null);
    }

    public static MetaConversionEvent? ForLead(MetaConversionSettings s, Lead lead, MetaLeadRef src, string status, DateTime at)
    {
        var name = s.LeadEventFor(status);
        if (name is null) return null;
        return new MetaConversionEvent(src.IntegrationId, lead.Id, null, name, at, src.ExternalLeadId,
            BuildUserData(lead, src.ExternalLeadId, s.DefaultCallingCode), null, null);
    }

    public static MetaConversionEvent? ForDeal(MetaConversionSettings s, Lead lead, MetaLeadRef src, Deal deal, string stage, DateTime at)
    {
        var name = s.DealEventFor(stage);
        if (name is null) return null;
        var (value, currency) = DealValue(deal, stage, s.SendDealValue);
        return new MetaConversionEvent(src.IntegrationId, lead.Id, deal.Id, name, at, src.ExternalLeadId,
            BuildUserData(lead, src.ExternalLeadId, s.DefaultCallingCode), value, currency);
    }
}

/// <summary>The Meta enquiry a lead came from: which integration, and Meta's own id for the lead.</summary>
internal sealed record MetaLeadRef(Guid IntegrationId, string ExternalLeadId)
{
    public static MetaLeadRef? From(LeadSource s) =>
        string.Equals(s.ProviderKey, "meta", StringComparison.OrdinalIgnoreCase)
        && s.IntegrationId is { } id && !string.IsNullOrWhiteSpace(s.ExternalLeadId)
            ? new MetaLeadRef(id, s.ExternalLeadId!.Trim()) : null;
}

/// <summary>
/// Queues "this lead just moved to this stage" for Meta. Called from the same places that already record
/// stage history, so every path that moves a lead or an opportunity is covered by one rule.
///
/// <para>Nothing here ever throws or blocks: reporting to Meta is a side effect, and failing to queue an
/// event must never stop a salesperson from moving their lead. Rows are added to the caller's context and
/// saved by the caller's own save, so the event and the change commit — or fail — together.</para>
/// </summary>
public interface IMetaConversionOutbox
{
    /// <summary>A lead just arrived from Meta (intake path; the lead and its source are not saved yet).</summary>
    Task OnLeadCreatedAsync(Lead lead, LeadSource source, CancellationToken ct);

    /// <summary>A lead's status changed.</summary>
    Task OnLeadStatusAsync(Lead lead, string status, DateTime at, CancellationToken ct);

    /// <summary>An opportunity changed stage. Reported against the lead it was converted from, if that lead came from Meta.</summary>
    Task OnDealStageAsync(Deal deal, string stage, DateTime at, CancellationToken ct);
}

internal sealed class MetaConversionOutbox(CrmDbContext db, ILogger<MetaConversionOutbox> logger) : IMetaConversionOutbox
{
    public async Task OnLeadCreatedAsync(Lead lead, LeadSource source, CancellationToken ct)
    {
        try
        {
            if (MetaLeadRef.From(source) is not { } meta) return;
            var settings = await ReadySettingsAsync(meta.IntegrationId, ct);
            if (settings is null) return;
            await QueueAsync(MetaConversionBuilder.ForLead(settings, lead, meta, lead.Status, DateTime.UtcNow), lead, ct);
        }
        catch (Exception ex) { logger.LogWarning(ex, "Meta conversions: could not queue the 'new lead' event for {Lead}.", lead.Id); }
    }

    public async Task OnLeadStatusAsync(Lead lead, string status, DateTime at, CancellationToken ct)
    {
        try
        {
            var source = await MetaSourceAsync(lead.Id, ct);
            if (source is null) return;
            var settings = await ReadySettingsAsync(source.IntegrationId, ct);
            if (settings is null) return;
            await QueueAsync(MetaConversionBuilder.ForLead(settings, lead, source, status, at), lead, ct);
        }
        catch (Exception ex) { logger.LogWarning(ex, "Meta conversions: could not queue a status event for lead {Lead}.", lead.Id); }
    }

    public async Task OnDealStageAsync(Deal deal, string stage, DateTime at, CancellationToken ct)
    {
        try
        {
            // The opportunity carries no Meta lead id of its own; it is reached through the lead it was converted from.
            var dealKey = deal.Id.ToString();
            var lead = await db.Leads.AsNoTracking().FirstOrDefaultAsync(l => l.ConvertedDealId == dealKey && !l.IsDeleted, ct);
            if (lead is null) return;
            var source = await MetaSourceAsync(lead.Id, ct);
            if (source is null) return;
            var settings = await ReadySettingsAsync(source.IntegrationId, ct);
            if (settings is null) return;
            await QueueAsync(MetaConversionBuilder.ForDeal(settings, lead, source, deal, stage, at), lead: null, ct);
        }
        catch (Exception ex) { logger.LogWarning(ex, "Meta conversions: could not queue a stage event for deal {Deal}.", deal.Id); }
    }

    /// <summary>
    /// The Meta enquiry a lead came from — the earliest one, since later rows are repeat enquiries.
    /// Only the two columns needed are read: a source row also carries the whole raw payload.
    /// </summary>
    private async Task<MetaLeadRef?> MetaSourceAsync(Guid leadId, CancellationToken ct)
    {
        var row = await db.LeadSources.AsNoTracking()
            .Where(s => s.LeadId == leadId && s.ProviderKey == "meta" && s.IntegrationId != null && s.ExternalLeadId != null)
            .OrderBy(s => s.ReceivedAt)
            .Select(s => new { s.IntegrationId, s.ExternalLeadId })
            .FirstOrDefaultAsync(ct);
        return row is null || string.IsNullOrWhiteSpace(row.ExternalLeadId)
            ? null : new MetaLeadRef(row.IntegrationId!.Value, row.ExternalLeadId.Trim());
    }

    private Task<MetaConversionSettings?> ReadySettingsAsync(Guid integrationId, CancellationToken ct) =>
        db.MetaConversionSettings.AsNoTracking()
            .FirstOrDefaultAsync(s => s.IntegrationId == integrationId && s.Enabled
                                      && s.DatasetId != null && s.AccessToken != null, ct);

    /// <summary>
    /// Each event name is reported once per lead (and once per opportunity for stage events). Meta counts every
    /// event it receives, so a rep flipping a lead Contacted → New → Contacted would otherwise report
    /// "Contacted" twice and inflate the figures. A failed or skipped event does not count as reported, so the
    /// stage can still be sent when it comes round again.
    /// </summary>
    private async Task<bool> AlreadyReportedAsync(MetaConversionEvent ev, CancellationToken ct)
    {
        // Rows added earlier in this same unit of work are not in the database yet.
        if (db.MetaConversionEvents.Local.Any(e => e.IntegrationId == ev.IntegrationId && e.LeadId == ev.LeadId
                && e.DealId == ev.DealId && e.EventName == ev.EventName))
            return true;

        return await db.MetaConversionEvents.AsNoTracking().AnyAsync(e =>
            e.IntegrationId == ev.IntegrationId && e.LeadId == ev.LeadId && e.DealId == ev.DealId
            && e.EventName == ev.EventName
            && e.Status != MetaConversionStatus.Failed && e.Status != MetaConversionStatus.Skipped, ct);
    }

    private async Task QueueAsync(MetaConversionEvent? ev, Lead? lead, CancellationToken ct)
    {
        if (ev is null) return;
        if (await AlreadyReportedAsync(ev, ct)) return;
        db.MetaConversionEvents.Add(ev);

        // The intake path runs from an anonymous webhook, where the ambient tenant is not what stamps new
        // rows. Take it from the lead being created when we can; otherwise SaveChanges stamps it as usual.
        if (lead is not null && db.Entry(lead).State != EntityState.Detached
            && db.Entry(lead).Property(TenantIsolation.Column).CurrentValue is Guid tenantId)
            db.Entry(ev).Property(TenantIsolation.Column).CurrentValue = tenantId;
    }
}
