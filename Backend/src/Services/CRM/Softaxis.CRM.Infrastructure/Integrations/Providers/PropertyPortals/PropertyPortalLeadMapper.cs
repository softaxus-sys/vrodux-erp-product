using System.Globalization;
using System.Text;
using System.Text.Json;
using Softaxis.CRM.Application.LeadIntake;
using Softaxis.CRM.Application.LeadIntake.Dtos;

namespace Softaxis.CRM.Infrastructure.Integrations.Providers.PropertyPortals;

/// <summary>
/// Shared enquiry → <see cref="CanonicalLead"/> mapping for Bayut and Dubizzle.
///
/// <para>Unlike Property Finder, neither portal publishes a partner API (no Atlas-style
/// OAuth/JWT client, no listing-lookup endpoint) — both work the same way: the tenant must be on
/// Bayut's Profolio™ plan and request the "Leads API" be enabled for their account
/// (support@bayut.com), after which the portal's own systems push enquiries to a CRM webhook URL
/// the tenant supplies. Dubizzle Property runs on the same EMPG/Dubizzle Group advertiser backend
/// as Bayut, so a Dubizzle enquiry is delivered the same way, tagged by source. There is therefore
/// no fixed, published JSON schema to code against — this mapper is deliberately tolerant, the
/// same posture Property Finder's own webhook path takes (see its "payload Vrodux understands"
/// setup guide): a nested <c>client</c>/<c>contact</c> object for the enquirer and a nested
/// <c>property</c>/<c>listing</c> object for the ad, with a flat-JSON and
/// <see cref="LeadFieldClassifier"/> fallback for whatever shape actually arrives.</para>
///
/// <para>Bayut's own Leads API documents six enquiry types — call, email, phone view, SMS click,
/// WhatsApp view, WhatsApp lead — carried in a <c>type</c>/<c>lead_type</c>/<c>channel</c>/
/// <c>enquiry_type</c> field. Only the two "view/click" types (phone_view, sms_click) typically
/// carry no message/contact beyond a phone number; the rest behave like a normal enquiry.</para>
/// </summary>
internal static class PropertyPortalLeadMapper
{
    /// <summary>
    /// Maps one enquiry object. <paramref name="platformKey"/>/<paramref name="platformLabel"/>
    /// distinguish Bayut from Dubizzle on the resulting lead (<c>Platform</c>, <c>FormName</c>)
    /// even though the payload shape and parsing are identical.
    /// </summary>
    public static CanonicalLead? Map(JsonElement el, string rawJson, string platformKey, string platformLabel)
    {
        if (el.ValueKind != JsonValueKind.Object) return null;

        // The enquirer may be nested (client/contact/customer/lead/user) or flat on the root —
        // same convention as Property Finder's original webhook shape and Calendly's payload.
        var person = FirstObject(el, "client", "contact", "customer", "lead", "user") ?? el;
        var listing = FirstObject(el, "property", "listing", "ad", "advert");

        var firstName = Str(person, "first_name", "firstname", "fname");
        var lastName  = Str(person, "last_name", "lastname", "lname", "surname");
        var fullName  = Str(person, "name", "full_name", "fullname", "caller_name", "customer_name");
        var email     = Str(person, "email", "email_address");
        var phone     = Str(person, "phone", "phone_number", "mobile", "caller_number", "contact_number");
        var whatsAppField = Str(person, "whatsapp", "whatsapp_number", "wa_number")
                          ?? Str(el, "whatsapp", "whatsapp_number", "wa_number");

        var type = Str(el, "type", "lead_type", "channel", "enquiry_type", "source_type", "event_type");
        var typeLabel = TypeLabel(type);

        // A WhatsApp-typed enquiry means the phone number IS reachable on WhatsApp — a fact from
        // the channel, not a guess (same reasoning Property Finder applies to its own channel field).
        var isWhatsAppChannel = type is not null &&
            type.Contains("whatsapp", StringComparison.OrdinalIgnoreCase);
        var whatsApp = whatsAppField ?? (isWhatsAppChannel ? phone : null);

        // No identity at all = not a workable lead. Most Bayut/Dubizzle enquiry types carry a
        // phone even when they carry nothing else (a call log has no email), so phone alone counts.
        if (phone is null && email is null && whatsApp is null) return null;

        var message = Str(el, "message", "comment", "note", "enquiry_message")
                    ?? Str(person, "message", "comment");

        // "Interested in" — the listing enquired about.
        var title = listing is { } l1 ? Str(l1, "title", "listing_title") : null;
        var reference = listing is { } l2 ? Str(l2, "reference", "reference_number", "permit_number", "ref") : null;
        string? interested = title;
        if (interested is null && reference is not null) interested = $"Ref {reference}";
        else if (interested is not null && reference is not null) interested = $"{interested} (Ref {reference})";

        // Budget — the listing's asking price, labelled with the offering type so it reads as a
        // property price rather than a budget the enquirer stated (same distinction PF's mapper draws).
        string? budget = null;
        if (listing is { } l3)
        {
            var price = Str(l3, "price", "amount");
            var offering = Str(l3, "offering_type", "price_type", "purpose"); // sale | rent | yearly …
            if (!string.IsNullOrWhiteSpace(price))
            {
                budget = price!;
                if (!string.IsNullOrWhiteSpace(offering) && !offering!.Equals("sale", StringComparison.OrdinalIgnoreCase))
                    budget += $" / {Humanize(offering)}";
            }
        }

        var city = listing is { } l4 ? Str(l4, "location", "community", "city", "area") : null;

        var notes = new StringBuilder();
        void Line(string label, string? v) { if (!string.IsNullOrWhiteSpace(v)) notes.Append(label).Append(": ").Append(v).Append('\n'); }
        Line("Enquiry", typeLabel);
        Line("Property", title);
        Line("Reference", reference);
        Line("Location", city);
        if (listing is { } l5)
        {
            Line("Type", Humanize(Str(l5, "type", "property_type")));
            Line("Bedrooms", Str(l5, "bedrooms"));
            Line("Bathrooms", Str(l5, "bathrooms"));
        }

        var canonical = new CanonicalLead
        {
            FirstName = firstName,
            LastName  = lastName,
            FullName  = firstName is null && lastName is null ? fullName : null,
            Email     = email,
            Phone     = phone,
            WhatsApp  = whatsApp,
            InterestedIn = interested,
            Budget       = budget,
            City         = city,
            Message      = message,
            Notes        = notes.Length > 0 ? notes.ToString().TrimEnd() : null,

            Platform            = platformKey,
            FormName            = $"{platformLabel} — {typeLabel ?? "enquiry"}",
            ExternalLeadId      = Str(el, "id", "lead_id", "reference_number", "external_id"),
            PlatformCreatedTime = Str(el, "created_at", "createdat", "timestamp", "date"),
            IsOrganic           = true,   // a portal enquiry is not paid advertising of ours

            RawJson = rawJson.Length > 8000 ? rawJson[..8000] : rawJson,
        };

        void Raw(string k, string? v) { if (!string.IsNullOrWhiteSpace(v)) canonical.RawFields[k] = v; }
        Raw($"{platformKey}_lead_id", Str(el, "id", "lead_id"));
        Raw("enquiry_type", typeLabel);
        Raw("listing_url", listing is { } l6 ? Str(l6, "url", "listing_url") : null);
        Raw("agent", listing is { } l7 ? Str(l7, "agent", "agent_name") : null);

        // Whatever the fixed field names above missed — custom question names or fields Bayut's
        // account-manager-configured payload happens to use — still gets a chance via the
        // normalized classifier, and every raw field lands under the lead's Form Responses so
        // nothing sent is silently dropped even when it isn't understood.
        foreach (var prop in el.EnumerateObject())
        {
            var v = FlatValue(prop.Value);
            if (v is null) continue;
            LeadFieldClassifier.Apply(canonical, prop.Name, v);
            canonical.RawFields[prop.Name] = v;
        }
        if (person.ValueKind == JsonValueKind.Object)
            foreach (var prop in person.EnumerateObject())
            {
                var v = FlatValue(prop.Value);
                if (v is null) continue;
                LeadFieldClassifier.Apply(canonical, prop.Name, v);
                canonical.RawFields.TryAdd(prop.Name, v);
            }

        return canonical;
    }

    private static string? TypeLabel(string? type)
    {
        if (string.IsNullOrWhiteSpace(type)) return null;
        var n = type.Replace('-', '_').Trim().ToLowerInvariant();
        return n switch
        {
            "call" or "call_log" or "call_logs"           => "Phone call",
            "email" or "email_lead"                        => "Email",
            "phone_view" or "phoneview"                     => "Phone number view",
            "sms" or "sms_click" or "smsclick"              => "SMS click",
            "whatsapp_view" or "whatsappview"                => "WhatsApp view",
            "whatsapp_lead" or "whatsapp" or "whatsappview2" => "WhatsApp lead",
            _ => Humanize(type),
        };
    }

    private static string? Humanize(string? s) =>
        string.IsNullOrWhiteSpace(s) ? null
            : CultureInfo.InvariantCulture.TextInfo.ToTitleCase(s.Replace('-', ' ').Replace('_', ' '));

    private static JsonElement? FirstObject(JsonElement el, params string[] names)
    {
        if (el.ValueKind != JsonValueKind.Object) return null;
        foreach (var name in names)
            if (el.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.Object)
                return v;
        return null;
    }

    private static string? Str(JsonElement el, params string[] props)
    {
        if (el.ValueKind != JsonValueKind.Object) return null;
        foreach (var prop in props)
        {
            if (!el.TryGetProperty(prop, out var v)) continue;
            var s = v.ValueKind switch
            {
                JsonValueKind.String => v.GetString(),
                JsonValueKind.Number => v.GetRawText(),
                JsonValueKind.True or JsonValueKind.False => v.GetRawText(),
                _ => null,
            };
            if (!string.IsNullOrWhiteSpace(s)) return s!.Trim();
        }
        return null;
    }

    private static string? FlatValue(JsonElement v) => v.ValueKind switch
    {
        JsonValueKind.String => v.GetString(),
        JsonValueKind.Number => v.GetRawText(),
        JsonValueKind.True or JsonValueKind.False => v.GetRawText(),
        _ => null, // nested objects/arrays (client/property) are read structurally above, not flattened
    };
}
