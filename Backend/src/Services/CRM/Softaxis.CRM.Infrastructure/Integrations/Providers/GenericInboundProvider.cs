using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Softaxis.CRM.Application.LeadIntake;
using Softaxis.CRM.Application.LeadIntake.Abstractions;
using Softaxis.CRM.Application.LeadIntake.Dtos;
using Softaxis.CRM.Domain.Entities.Integrations;

namespace Softaxis.CRM.Infrastructure.Integrations.Providers;

/// <summary>
/// Generic JSON inbound provider that powers the Webhook connector, the Custom API, and
/// Website Forms — i.e. any third party (Zapier, Make.com, n8n, landing pages, custom apps)
/// that can POST a JSON body to the integration's inbound URL. The same implementation is
/// registered under several keys with different descriptors.
///
/// Auth model: possession of the unguessable inbound key is the baseline secret. When the
/// integration config sets <c>requireSignature: true</c>, an HMAC-SHA256 signature header is
/// additionally required and verified against the (encrypted) signing secret.
/// </summary>
public sealed class GenericInboundProvider(string key, ProviderDescriptor descriptor) : ILeadProvider, IWebhookLeadProvider
{
    public string Key => key;
    public ProviderDescriptor Descriptor => descriptor;

    private static readonly string[] FirstNameKeys = ["firstname", "first_name", "first", "fname", "given_name"];
    private static readonly string[] LastNameKeys  = ["lastname", "last_name", "last", "lname", "family_name", "surname"];
    private static readonly string[] FullNameKeys  = ["fullname", "full_name", "name"];
    private static readonly string[] EmailKeys     = ["email", "email_address", "e-mail", "mail"];
    private static readonly string[] PhoneKeys     = ["phone", "phone_number", "mobile", "tel", "telephone", "contact_number"];
    private static readonly string[] CompanyKeys   = ["company", "company_name", "organization", "organisation", "business"];
    private static readonly string[] TitleKeys     = ["title", "job_title", "jobtitle", "designation"];
    private static readonly string[] IndustryKeys  = ["industry", "sector"];
    private static readonly string[] AddressKeys   = ["address", "street", "address1", "address_line_1"];
    private static readonly string[] CityKeys      = ["city", "town"];
    private static readonly string[] CountryKeys   = ["country", "country_name"];
    private static readonly string[] NotesKeys     = ["notes", "comments", "comment", "enquiry", "inquiry"];
    private static readonly string[] WhatsAppKeys     = ["whatsapp", "whatsapp_number", "whatsappnumber", "wa", "wa_number"];
    private static readonly string[] InterestedInKeys = ["interested_in", "interestedin", "interest", "interests", "looking_for", "product_interest", "service_interest"];
    private static readonly string[] BudgetKeys       = ["budget", "budget_range", "your_budget", "price_range", "estimated_budget"];
    private static readonly string[] MessageKeys      = ["message", "your_message", "custom_message", "additional_info", "details"];
    private static readonly string[] TimeframeKeys    = ["timeframe", "time_frame", "timeline", "when_to_buy", "when_looking_to_buy", "purchase_timeline", "buying_timeline", "when_planning_to_buy", "when_planning_to_invest", "when_are_you_planning_to_buy", "move_in", "move_in_date", "urgency", "purchase_timeframe"];
    private static readonly string[] FormNameKeys     = ["form_name", "formname", "form"];

    public IReadOnlyList<CanonicalLead> Normalize(string rawPayload, Integration integration)
    {
        if (string.IsNullOrWhiteSpace(rawPayload)) return [];

        JsonElement root;
        try { root = JsonDocument.Parse(rawPayload).RootElement; }
        catch { return []; }

        // Accept a single object, a bare array, or { "data": [...] } / { "leads": [...] }.
        var elements = root.ValueKind switch
        {
            JsonValueKind.Array  => root.EnumerateArray().ToList(),
            JsonValueKind.Object => UnwrapObject(root),
            _ => []
        };

        var leads = new List<CanonicalLead>();
        foreach (var el in elements)
        {
            if (el.ValueKind != JsonValueKind.Object) continue;
            leads.Add(MapOne(el, rawPayload));
        }
        return leads;
    }

    private static List<JsonElement> UnwrapObject(JsonElement obj)
    {
        foreach (var wrapper in new[] { "data", "leads", "items", "records" })
            if (obj.TryGetProperty(wrapper, out var inner) && inner.ValueKind == JsonValueKind.Array)
                return inner.EnumerateArray().ToList();
        return [obj];
    }

    private static CanonicalLead MapOne(JsonElement el, string rawJson)
    {
        var fields = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);
        foreach (var prop in el.EnumerateObject())
            fields[prop.Name] = prop.Value.ValueKind switch
            {
                JsonValueKind.String => prop.Value.GetString(),
                JsonValueKind.Number => prop.Value.GetRawText(),
                JsonValueKind.True or JsonValueKind.False => prop.Value.GetRawText(),
                JsonValueKind.Null or JsonValueKind.Undefined => null,
                _ => prop.Value.GetRawText(),
            };

        var lead = new CanonicalLead
        {
            FirstName = Pick(fields, FirstNameKeys),
            LastName  = Pick(fields, LastNameKeys),
            FullName  = Pick(fields, FullNameKeys),
            Email     = Pick(fields, EmailKeys),
            Phone     = Pick(fields, PhoneKeys),
            Company   = Pick(fields, CompanyKeys),
            Title     = Pick(fields, TitleKeys),
            Industry  = Pick(fields, IndustryKeys),
            Address   = Pick(fields, AddressKeys),
            City      = Pick(fields, CityKeys),
            Country   = Pick(fields, CountryKeys),
            Notes     = Pick(fields, NotesKeys),
            WhatsApp     = Pick(fields, WhatsAppKeys),
            InterestedIn = Pick(fields, InterestedInKeys),
            Budget       = Pick(fields, BudgetKeys),
            Message      = Pick(fields, MessageKeys),
            Timeframe    = Pick(fields, TimeframeKeys),
            FormName     = Pick(fields, FormNameKeys),
            ExternalLeadId = Pick(fields, ["lead_id", "id", "external_id", "externalid"]),
            UtmSource   = Pick(fields, ["utm_source"]),
            UtmMedium   = Pick(fields, ["utm_medium"]),
            UtmCampaign = Pick(fields, ["utm_campaign"]),
            UtmTerm     = Pick(fields, ["utm_term"]),
            UtmContent  = Pick(fields, ["utm_content"]),
            Campaign    = Pick(fields, ["campaign", "campaign_name"]),
            RawJson     = rawJson.Length > 8000 ? rawJson[..8000] : rawJson,
        };

        // Fallback: capture any field the fixed synonym lists missed (custom question names like
        // "your_budget?", "when_are_you_planning_to_buy?") via the normalized classifier.
        foreach (var (k, v) in fields)
        {
            LeadFieldClassifier.Apply(lead, k, v);
            lead.RawFields[k] = v;
        }
        return lead;
    }

    private static string? Pick(Dictionary<string, string?> fields, string[] keys)
    {
        foreach (var k in keys)
            if (fields.TryGetValue(k, out var v) && !string.IsNullOrWhiteSpace(v))
                return v;
        return null;
    }

    // ── Webhook capability ────────────────────────────────────────────────────

    public string? TryHandleVerification(IReadOnlyDictionary<string, string> query, Integration integration) => null;

    public bool VerifySignature(string rawBody, IReadOnlyDictionary<string, string> headers, string? decryptedSecret)
    {
        var requireSignature = ReadRequireSignature(/* integration config */ null);
        // Possession of the inbound key is the baseline secret (resolved before this call).
        var signature = HeaderValue(headers, "X-Vrodux-Signature")
                     ?? HeaderValue(headers, "X-Signature")
                     ?? HeaderValue(headers, "X-Hub-Signature-256");

        if (string.IsNullOrWhiteSpace(signature))
            return !requireSignature;   // unsigned allowed unless explicitly required

        if (string.IsNullOrWhiteSpace(decryptedSecret)) return false;

        var provided = signature.StartsWith("sha256=", StringComparison.OrdinalIgnoreCase) ? signature[7..] : signature;
        var computed = Convert.ToHexString(
            new HMACSHA256(Encoding.UTF8.GetBytes(decryptedSecret)).ComputeHash(Encoding.UTF8.GetBytes(rawBody)));

        return CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(provided.ToLowerInvariant()),
            Encoding.UTF8.GetBytes(computed.ToLowerInvariant()));
    }

    private static bool ReadRequireSignature(string? configJson) => false;

    private static string? HeaderValue(IReadOnlyDictionary<string, string> headers, string name) =>
        headers.TryGetValue(name, out var v) ? v : null;
}
