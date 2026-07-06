using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Softaxis.CRM.Application.LeadIntake.Abstractions;
using Softaxis.CRM.Application.LeadIntake.Dtos;
using Softaxis.CRM.Domain.Entities.Integrations;

namespace Softaxis.CRM.Infrastructure.Integrations.Providers;

/// <summary>
/// Calendly bookings → leads. The tenant adds a Calendly webhook subscription (invitee.created /
/// invitee.canceled) pointing at this integration's inbound URL; each new booking becomes a lead.
/// Calendly nests the person under <c>payload</c>, so the generic JSON provider can't read it —
/// this one understands the Calendly shape and pulls phone numbers out of the booking's
/// questions_and_answers.
///
/// Auth: possession of the unguessable inbound URL is the baseline secret (same as the other
/// inbound providers). If the tenant stores their Calendly signing key as the integration secret,
/// a present <c>Calendly-Webhook-Signature</c> header is additionally verified; an unsigned or
/// unverifiable request is still accepted on the strength of the inbound key.
/// </summary>
public sealed class CalendlyLeadProvider : ILeadProvider, IWebhookLeadProvider
{
    public string Key => "calendly";

    public ProviderDescriptor Descriptor => new(
        "calendly", "Calendly", ProviderCategory.Forms,
        "Create leads from new Calendly bookings — point a Calendly webhook at your inbound URL.",
        ProviderCapabilities.Webhook | ProviderCapabilities.InboundKey, ComingSoon: false);

    public IReadOnlyList<CanonicalLead> Normalize(string rawPayload, Integration integration)
    {
        if (string.IsNullOrWhiteSpace(rawPayload)) return [];

        JsonElement root;
        try { root = JsonDocument.Parse(rawPayload).RootElement; }
        catch { return []; }

        // Only act on new bookings; ignore cancellations / other event types.
        if (root.TryGetProperty("event", out var ev) && ev.ValueKind == JsonValueKind.String)
        {
            var name = ev.GetString();
            if (!string.IsNullOrEmpty(name) && !name.Equals("invitee.created", StringComparison.OrdinalIgnoreCase))
                return [];
        }

        // The invitee lives under "payload" (Calendly v2); fall back to the root for flat posts.
        var p = root.TryGetProperty("payload", out var payload) && payload.ValueKind == JsonValueKind.Object
            ? payload
            : root;

        var email = Str(p, "email");
        var fullName = Str(p, "name");
        var first = Str(p, "first_name");
        var last = Str(p, "last_name");
        var phone = Str(p, "text_reminder_number");

        // Q&A carries custom fields — mine it for a phone number and collect the rest as notes.
        var notes = new StringBuilder();
        if (p.TryGetProperty("questions_and_answers", out var qa) && qa.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in qa.EnumerateArray())
            {
                var q = Str(item, "question");
                var a = Str(item, "answer");
                if (string.IsNullOrWhiteSpace(a)) continue;
                if (phone is null && LooksLikePhone(q, a)) phone = a;
                if (!string.IsNullOrWhiteSpace(q)) notes.Append(q).Append(": ");
                notes.Append(a).Append('\n');
            }
        }

        // Event name (e.g. "30 Minute Meeting") is useful context on the lead.
        var eventName = p.TryGetProperty("scheduled_event", out var se) && se.ValueKind == JsonValueKind.Object
            ? Str(se, "name")
            : null;
        if (!string.IsNullOrWhiteSpace(eventName))
            notes.Insert(0, $"Calendly booking: {eventName}\n");

        if (email is null && phone is null && fullName is null && first is null)
            return [];

        var lead = new CanonicalLead
        {
            FirstName = first,
            LastName = last,
            FullName = first is null && last is null ? fullName : null,
            Email = email,
            Phone = phone,
            Notes = notes.Length > 0 ? notes.ToString().Trim() : null,
            ExternalLeadId = Str(p, "uri") ?? Str(p, "uuid"),
            RawJson = rawPayload.Length > 8000 ? rawPayload[..8000] : rawPayload,
        };

        // UTM tracking, when Calendly forwards it.
        if (p.TryGetProperty("tracking", out var t) && t.ValueKind == JsonValueKind.Object)
        {
            lead.UtmSource = Str(t, "utm_source");
            lead.UtmMedium = Str(t, "utm_medium");
            lead.UtmCampaign = Str(t, "utm_campaign");
            lead.UtmContent = Str(t, "utm_content");
            lead.UtmTerm = Str(t, "utm_term");
        }

        return [lead];
    }

    // ── Webhook capability ────────────────────────────────────────────────────

    public string? TryHandleVerification(IReadOnlyDictionary<string, string> query, Integration integration) => null;

    public bool VerifySignature(string rawBody, IReadOnlyDictionary<string, string> headers, string? decryptedSecret)
    {
        if (!headers.TryGetValue("Calendly-Webhook-Signature", out var header) || string.IsNullOrWhiteSpace(header))
            return true;   // unsigned — accepted on the strength of the inbound key

        if (string.IsNullOrWhiteSpace(decryptedSecret)) return true;   // no key stored — can't verify, don't reject

        // Header format: "t=<unix>,v1=<hex-hmac>". Signed payload is "<t>.<rawBody>".
        string? t = null, v1 = null;
        foreach (var part in header.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries))
        {
            var eq = part.IndexOf('=');
            if (eq <= 0) continue;
            var k = part[..eq];
            var val = part[(eq + 1)..];
            if (k == "t") t = val;
            else if (k == "v1") v1 = val;
        }
        if (t is null || v1 is null) return true;   // unrecognised format — don't hard-fail

        var signed = $"{t}.{rawBody}";
        var computed = Convert.ToHexString(
            new HMACSHA256(Encoding.UTF8.GetBytes(decryptedSecret)).ComputeHash(Encoding.UTF8.GetBytes(signed)));

        return CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(v1.ToLowerInvariant()),
            Encoding.UTF8.GetBytes(computed.ToLowerInvariant()));
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private static string? Str(JsonElement el, string prop) =>
        el.ValueKind == JsonValueKind.Object
        && el.TryGetProperty(prop, out var v)
        && v.ValueKind == JsonValueKind.String
        && !string.IsNullOrWhiteSpace(v.GetString())
            ? v.GetString()!.Trim()
            : null;

    private static bool LooksLikePhone(string? question, string answer)
    {
        if (!string.IsNullOrWhiteSpace(question)
            && (question.Contains("phone", StringComparison.OrdinalIgnoreCase)
             || question.Contains("mobile", StringComparison.OrdinalIgnoreCase)
             || question.Contains("number", StringComparison.OrdinalIgnoreCase)))
            return true;

        var digits = answer.Count(char.IsDigit);
        return digits >= 7 && answer.All(c => char.IsDigit(c) || c is '+' or '-' or ' ' or '(' or ')');
    }
}
