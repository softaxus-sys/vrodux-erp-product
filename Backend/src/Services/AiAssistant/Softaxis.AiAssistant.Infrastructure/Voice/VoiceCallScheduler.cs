using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Softaxis.AiAssistant.Domain.Entities;
using Softaxis.AiAssistant.Infrastructure.Persistence;
using Softaxis.BuildingBlocks.Application.AiEvents;

namespace Softaxis.AiAssistant.Infrastructure.Voice;

/// <summary>
/// Turns a <c>crm.lead.created</c> inbox event into a <see cref="ScheduledCall"/> when the tenant's
/// voice agent is enabled and the lead has a phone number. Called by the event-inbox processor with
/// the ambient tenant already scoped. The delay is jittered so the call doesn't land suspiciously
/// exactly-N-minutes after the form submit.
/// </summary>
public sealed class VoiceCallScheduler(AiAssistantDbContext db, ILogger<VoiceCallScheduler> logger)
{
    public async Task TryScheduleForEventAsync(AiEventInbox evt, CancellationToken ct)
    {
        if (evt.EventKey != AiEventKeys.CrmLeadCreated || evt.EntityId is not { } leadId)
            return;

        var settings = await db.VoiceSettings.FirstOrDefaultAsync(ct);
        if (settings is null || !settings.Enabled || !settings.HasVapiApiKey ||
            string.IsNullOrEmpty(settings.VapiPhoneNumberId))
            return;

        var lead = ParsePayload(evt.PayloadJson);
        if (string.IsNullOrWhiteSpace(lead.Phone))
        {
            logger.LogInformation("Voice: lead {Lead} has no phone — no call scheduled.", leadId);
            return;
        }

        // One scheduled call per lead — retries re-use the same row, and inbox retries must not duplicate.
        if (await db.ScheduledCalls.AnyAsync(x => x.LeadId == leadId, ct))
            return;

        var dueAt = DateTime.UtcNow
            .AddMinutes(settings.CallDelayMinutes)
            .AddSeconds(Random.Shared.Next(0, 180)); // jitter

        var call = new ScheduledCall(
            leadId,
            leadName:    lead.Name ?? "there",
            phone:       NormalizePhone(lead.Phone),
            language:    settings.DefaultLanguage, // M2: route by phone country code
            dueAt:       dueAt,
            leadContext: evt.PayloadJson);

        db.ScheduledCalls.Add(call);
        await db.SaveChangesAsync(ct);
        logger.LogInformation("Voice: scheduled call {Call} to lead {Lead} at {Due:u}.", call.Id, leadId, dueAt);
    }

    private static (string? Name, string? Phone) ParsePayload(string? payloadJson)
    {
        if (string.IsNullOrWhiteSpace(payloadJson)) return (null, null);
        try
        {
            using var doc = JsonDocument.Parse(payloadJson);
            var root = doc.RootElement;
            var first = Get(root, "firstName");
            var last  = Get(root, "lastName");
            var name  = $"{first} {last}".Trim();
            return (name.Length == 0 ? null : name, Get(root, "phone"));
        }
        catch
        {
            return (null, null);
        }
    }

    private static string? Get(JsonElement root, string camelName)
    {
        // Producers serialize with default (PascalCase) or web (camelCase) options — accept both.
        var pascal = char.ToUpperInvariant(camelName[0]) + camelName[1..];
        if (root.TryGetProperty(camelName, out var el) && el.ValueKind == JsonValueKind.String) return el.GetString();
        if (root.TryGetProperty(pascal, out el) && el.ValueKind == JsonValueKind.String) return el.GetString();
        return null;
    }

    /// <summary>Best-effort E.164 cleanup: strip separators, keep a leading +. National-format
    /// numbers (leading 0, no country code) are left as digits — the dial will fail visibly with a
    /// clear Vapi error rather than silently calling a wrong international number. (M2 infers the
    /// country code from the lead's country.)</summary>
    private static string NormalizePhone(string raw)
    {
        var digits = new string(raw.Where(char.IsDigit).ToArray());
        if (digits.Length == 0) return raw.Trim();
        if (raw.TrimStart().StartsWith('+')) return "+" + digits;
        // "00" international prefix → "+"
        if (digits.StartsWith("00")) return "+" + digits[2..];
        return digits.StartsWith('0') ? digits : "+" + digits;
    }
}
