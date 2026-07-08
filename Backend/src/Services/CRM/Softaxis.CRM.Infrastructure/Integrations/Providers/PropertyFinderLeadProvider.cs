using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Softaxis.CRM.Application.LeadIntake.Abstractions;
using Softaxis.CRM.Application.LeadIntake.Dtos;
using Softaxis.CRM.Domain.Entities.Integrations;

namespace Softaxis.CRM.Infrastructure.Integrations.Providers;

/// <summary>
/// Property Finder listing enquiries → CRM leads. Property Finder delivers each buyer/tenant
/// enquiry (email, phone-call, WhatsApp or SMS) as a JSON payload posted to this integration's
/// inbound URL. The person is nested under <c>client</c>/<c>contact</c> and the listing under
/// <c>property</c>/<c>listing</c> — a shape the generic JSON provider can't read — so this provider
/// understands it and attaches the real-estate context (property, reference, price, offering type,
/// location, beds/baths) to the lead: the enquiry <c>message</c> → Message, the property → Interested
/// In, the price → Budget, and every listing detail is stashed for the lead's Form Responses.
///
/// Auth: possession of the unguessable inbound URL is the baseline secret (as with the other inbound
/// providers). If the tenant stores a Property Finder signing secret on the integration, a present
/// signature header is additionally verified; an unsigned request is still accepted on the inbound key.
/// </summary>
public sealed class PropertyFinderLeadProvider : ILeadProvider, IWebhookLeadProvider
{
    public string Key => "property-finder";

    public ProviderDescriptor Descriptor => new(
        "property-finder", "Property Finder", ProviderCategory.RealEstate,
        "Turn Property Finder listing enquiries (email, call, WhatsApp) into CRM leads — with the property, price and message attached.",
        ProviderCapabilities.Webhook | ProviderCapabilities.InboundKey | ProviderCapabilities.ApiKey);

    public IReadOnlyList<CanonicalLead> Normalize(string rawPayload, Integration integration)
    {
        if (string.IsNullOrWhiteSpace(rawPayload)) return [];

        JsonElement root;
        try { root = JsonDocument.Parse(rawPayload).RootElement; }
        catch { return []; }

        var items = root.ValueKind switch
        {
            JsonValueKind.Array  => root.EnumerateArray().ToList(),
            JsonValueKind.Object => Unwrap(root),
            _ => new List<JsonElement>(),
        };

        var leads = new List<CanonicalLead>();
        foreach (var el in items)
            if (el.ValueKind == JsonValueKind.Object && MapOne(el, rawPayload) is { } lead)
                leads.Add(lead);
        return leads;
    }

    // Accept a single object, a bare array, or { "leads": [...] } / { "data": [...] }.
    private static List<JsonElement> Unwrap(JsonElement obj)
    {
        foreach (var w in new[] { "leads", "data", "items", "results" })
            if (obj.TryGetProperty(w, out var inner) && inner.ValueKind == JsonValueKind.Array)
                return inner.EnumerateArray().ToList();
        return [obj];
    }

    private static CanonicalLead? MapOne(JsonElement el, string rawJson)
    {
        // The enquirer may be nested (client / contact / customer / lead / user) or flat on the root.
        var person = Obj(el, "client") ?? Obj(el, "contact") ?? Obj(el, "customer")
                  ?? Obj(el, "lead") ?? Obj(el, "user") ?? el;

        var fullName = Val(person, "name") ?? Val(person, "full_name") ?? Val(person, "fullname");
        var first    = Val(person, "first_name") ?? Val(person, "firstname");
        var last     = Val(person, "last_name") ?? Val(person, "lastname");
        var email    = Val(person, "email") ?? Val(person, "email_address");
        var phone    = Val(person, "phone") ?? Val(person, "mobile")
                    ?? Val(person, "phone_number") ?? Val(person, "contact_number");
        var whatsapp = Val(person, "whatsapp") ?? Val(el, "whatsapp");

        var leadType = (Val(el, "type") ?? Val(el, "lead_type") ?? Val(el, "enquiry_type")
                     ?? Val(el, "channel") ?? "").ToLowerInvariant();
        var message  = Val(el, "message") ?? Val(el, "comment") ?? Val(el, "enquiry")
                    ?? Val(el, "note") ?? Val(el, "text");

        // WhatsApp enquiries: the contact number IS the WhatsApp number.
        if (whatsapp is null && leadType.Contains("whatsapp")) whatsapp = phone;

        // Property / listing the enquiry is about.
        var prop = Obj(el, "property") ?? Obj(el, "listing");
        string? propTitle = null, propRef = null, propUrl = null, propLoc = null,
                propPrice = null, propType = null, offering = null, beds = null, baths = null, size = null;
        if (prop is { } pv)
        {
            propTitle = Val(pv, "title") ?? Val(pv, "name");
            propRef   = Val(pv, "reference") ?? Val(pv, "ref") ?? Val(pv, "reference_number") ?? Val(pv, "listing_reference");
            propUrl   = Val(pv, "url") ?? Val(pv, "link") ?? Val(pv, "permalink");
            propLoc   = Val(pv, "location") ?? Val(pv, "community") ?? Val(pv, "area") ?? Val(pv, "city");
            propPrice = Val(pv, "price") ?? Val(pv, "amount");
            propType  = Val(pv, "type") ?? Val(pv, "property_type") ?? Val(pv, "category");
            offering  = Val(pv, "offering_type") ?? Val(pv, "offering") ?? Val(pv, "purpose");
            beds      = Val(pv, "bedrooms") ?? Val(pv, "beds");
            baths     = Val(pv, "bathrooms") ?? Val(pv, "baths");
            size      = Val(pv, "size") ?? Val(pv, "area_size") ?? Val(pv, "builtup_area");
        }

        var externalId = Val(el, "lead_id") ?? Val(el, "id") ?? Val(el, "reference");

        // Need at least one contact identifier to be a usable lead.
        if (email is null && phone is null && fullName is null && first is null)
            return null;

        // "Interested in" = the property being enquired about.
        var interested = propTitle;
        if (propRef is not null) interested = interested is null ? $"Ref {propRef}" : $"{interested} (Ref {propRef})";

        // Budget = listing price + offering type (e.g. "120,000 · Rent").
        var budget = propPrice;
        if (budget is not null && !string.IsNullOrWhiteSpace(offering)) budget = $"{budget} · {Cap(offering)}";

        // Human-readable summary so agents see the whole enquiry at a glance.
        var notes = new StringBuilder();
        void Line(string label, string? v) { if (!string.IsNullOrWhiteSpace(v)) notes.Append(label).Append(": ").Append(v).Append('\n'); }
        Line("Enquiry", string.IsNullOrWhiteSpace(leadType) ? null : Cap(leadType));
        Line("Property", propTitle);
        Line("Reference", propRef);
        Line("Type", propType);
        Line("Offering", offering is null ? null : Cap(offering));
        Line("Price", propPrice);
        Line("Location", propLoc);
        Line("Bedrooms", beds);
        Line("Bathrooms", baths);
        Line("Size", size);
        Line("Listing", propUrl);
        if (!string.IsNullOrWhiteSpace(message)) notes.Append("Message: ").Append(message).Append('\n');

        var lead = new CanonicalLead
        {
            FirstName = first,
            LastName  = last,
            FullName  = first is null && last is null ? fullName : null,
            Email     = email,
            Phone     = phone,
            WhatsApp  = whatsapp,
            Message   = message,
            InterestedIn = interested,
            Budget    = budget,
            City      = propLoc,
            Notes     = notes.Length > 0 ? notes.ToString().TrimEnd() : null,
            Platform  = "property_finder",
            FormName  = string.IsNullOrWhiteSpace(leadType) ? "Property Finder enquiry" : $"Property Finder — {Cap(leadType)} enquiry",
            ExternalLeadId = externalId,
            PlatformCreatedTime = Val(el, "created_at") ?? Val(el, "created") ?? Val(el, "timestamp"),
            RawJson   = rawJson.Length > 8000 ? rawJson[..8000] : rawJson,
        };

        // Stash structured listing details so they show under Form Responses and are field-mappable.
        void Raw(string k, string? v) { if (!string.IsNullOrWhiteSpace(v)) lead.RawFields[k] = v; }
        Raw("property_reference", propRef);
        Raw("property_title", propTitle);
        Raw("property_type", propType);
        Raw("offering_type", offering);
        Raw("price", propPrice);
        Raw("location", propLoc);
        Raw("bedrooms", beds);
        Raw("bathrooms", baths);
        Raw("size", size);
        Raw("listing_url", propUrl);
        Raw("enquiry_type", leadType);
        Raw("agent", Obj(el, "agent") is { } ag ? (Val(ag, "name") ?? Val(ag, "email")) : Val(el, "agent"));

        return lead;
    }

    // ── Webhook capability ──────────────────────────────────────────────────────

    public string? TryHandleVerification(IReadOnlyDictionary<string, string> query, Integration integration) => null;

    public bool VerifySignature(string rawBody, IReadOnlyDictionary<string, string> headers, string? decryptedSecret)
    {
        var sig = Header(headers, "X-PropertyFinder-Signature")
               ?? Header(headers, "X-Signature")
               ?? Header(headers, "X-Vrodux-Signature")
               ?? Header(headers, "X-Hub-Signature-256");

        if (string.IsNullOrWhiteSpace(sig)) return true;              // unsigned — inbound key is the secret
        if (string.IsNullOrWhiteSpace(decryptedSecret)) return true;  // no key stored — can't verify, don't reject

        var provided = sig.StartsWith("sha256=", StringComparison.OrdinalIgnoreCase) ? sig[7..] : sig;
        var computed = Convert.ToHexString(
            new HMACSHA256(Encoding.UTF8.GetBytes(decryptedSecret)).ComputeHash(Encoding.UTF8.GetBytes(rawBody)));

        return CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(provided.ToLowerInvariant()),
            Encoding.UTF8.GetBytes(computed.ToLowerInvariant()));
    }

    // ── helpers ─────────────────────────────────────────────────────────────────

    private static JsonElement? Obj(JsonElement el, string prop) =>
        el.ValueKind == JsonValueKind.Object && el.TryGetProperty(prop, out var v) && v.ValueKind == JsonValueKind.Object
            ? v : null;

    private static string? Val(JsonElement el, string prop)
    {
        if (el.ValueKind != JsonValueKind.Object || !el.TryGetProperty(prop, out var v)) return null;
        return v.ValueKind switch
        {
            JsonValueKind.String => string.IsNullOrWhiteSpace(v.GetString()) ? null : v.GetString()!.Trim(),
            JsonValueKind.Number => v.GetRawText(),
            _ => null,
        };
    }

    private static string Cap(string s) => string.IsNullOrEmpty(s) ? s : char.ToUpperInvariant(s[0]) + s[1..];

    private static string? Header(IReadOnlyDictionary<string, string> headers, string name) =>
        headers.TryGetValue(name, out var v) ? v : null;
}
