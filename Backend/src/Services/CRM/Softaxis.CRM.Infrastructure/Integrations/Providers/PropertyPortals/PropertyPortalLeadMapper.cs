using System.Globalization;
using System.Text;
using System.Text.Json;
using Softaxis.CRM.Application.LeadIntake;
using Softaxis.CRM.Application.LeadIntake.Dtos;

namespace Softaxis.CRM.Infrastructure.Integrations.Providers.PropertyPortals;

/// <summary>
/// Shared enquiry → <see cref="CanonicalLead"/> mapping for Bayut and Dubizzle.
///
/// <para>Both portals run on the same EMPG/Dubizzle Group backend, and Bayut's integration team
/// supplies two documented mechanisms, both handled here:</para>
/// <list type="bullet">
/// <item><b>Pull</b> — <c>GET /api-v7/stats/website-client-leads</c>, Bearer-authenticated. The
/// enquirer arrives as <c>inquirer_details</c> {name, cell, email, message} beside a
/// <c>listing_details</c>, <c>agent_details</c> or <c>agency_details</c> object.</item>
/// <item><b>Push</b> — WhatsApp enquiries POSTed to the tenant's inbound URL, where the enquirer
/// is <c>enquirer</c> {name, phone_number, intent} beside <c>agent</c>/<c>listing</c> or a
/// TruBroker <c>story</c>.</item>
/// </list>
///
/// <para>The documented names are matched FIRST; the older tolerant names (<c>client</c>/
/// <c>contact</c>, <c>property</c>/<c>listing</c>) and the <see cref="LeadFieldClassifier"/>
/// fallback are kept because Bayut configures the push payload per account, so an undocumented
/// field still lands in <c>RawFields</c> rather than being dropped.</para>
///
/// <para>Bayut's Leads API covers six enquiry types — call, email, phone view, SMS click,
/// WhatsApp view, WhatsApp lead. Pull responses carry NO type field (it is the request's own
/// <c>type</c> parameter), so the caller supplies it via the typeLabelOverride argument.</para>
/// </summary>
internal static class PropertyPortalLeadMapper
{
    /// <summary>
    /// Maps one enquiry object. <paramref name="platformKey"/>/<paramref name="platformLabel"/>
    /// distinguish Bayut from Dubizzle on the resulting lead (<c>Platform</c>, <c>FormName</c>)
    /// even though the payload shape and parsing are identical.
    /// </summary>
    /// <param name="typeLabelOverride">
    /// The enquiry type for payloads that do not state one — every pull response, where the type
    /// lives in the request rather than the body. Ignored when the payload names its own.
    /// </param>
    public static CanonicalLead? Map(JsonElement el, string rawJson, string platformKey, string platformLabel,
        string? typeLabelOverride = null)
    {
        if (el.ValueKind != JsonValueKind.Object) return null;

        // Documented names first, tolerant fallbacks after.
        var person = FirstObject(el, "inquirer_details", "enquirer", "client", "contact", "customer", "lead", "user") ?? el;
        // A story lead wraps its property inside story_details — unwrap it so the lead still names
        // the listing the enquirer was looking at.
        var story = FirstObject(el, "story_details", "story");
        // A story carries its property either nested (pull: story_details.listing_details) or flat
        // on the story object itself (push: story.listing_title / listing_reference).
        var listing = FirstObject(el, "listing_details", "property", "listing", "ad", "advert")
                   ?? (story is { } st ? FirstObject(st, "listing_details") : null);
        // Push story payloads keep the listing fields flat on the story object, so the story
        // doubles as the listing. Flagged because its own "type" means the STORY kind
        // (property/project/loc_purpose), not the property type — reading it as the latter would
        // label every story lead's property "Property".
        var listingIsStory = listing is null && story is not null;
        if (listingIsStory) listing = story;
        var agent  = FirstObject(el, "agent_details", "agent");
        var agency = FirstObject(el, "agency_details", "agency");

        var firstName = Str(person, "first_name", "firstname", "fname");
        var lastName  = Str(person, "last_name", "lastname", "lname", "surname");
        var fullName  = Str(person, "name", "full_name", "fullname", "caller_name", "customer_name");
        var email     = Str(person, "email", "email_address");
        // "cell" is the pull API's name for it, "phone_number" the push API's.
        var phone     = Str(person, "cell", "phone_number", "phone", "mobile", "caller_number", "contact_number");
        var whatsAppField = Str(person, "whatsapp", "whatsapp_number", "wa_number")
                          ?? Str(el, "whatsapp", "whatsapp_number", "wa_number");

        var type = Str(el, "type", "lead_type", "channel", "enquiry_type", "source_type", "event_type");
        var typeLabel = TypeLabel(type) ?? typeLabelOverride;

        // A WhatsApp-typed enquiry means the phone number IS reachable on WhatsApp — a fact from
        // the channel, not a guess (same reasoning Property Finder applies to its own channel field).
        var isWhatsAppChannel =
            (type is not null && type.Contains("whatsapp", StringComparison.OrdinalIgnoreCase)) ||
            (typeLabelOverride?.Contains("whatsapp", StringComparison.OrdinalIgnoreCase) ?? false);
        var whatsApp = whatsAppField ?? (isWhatsAppChannel ? phone : null);

        // No identity at all = not a workable lead. Most Bayut/Dubizzle enquiry types carry a
        // phone even when they carry nothing else (a call log has no email), so phone alone counts.
        if (phone is null && email is null && whatsApp is null) return null;

        var message = Str(el, "message", "comment", "note", "enquiry_message")
                    ?? Str(person, "message", "comment");

        // "Interested in" — the listing enquired about.
        var title = listing is { } l1 ? Str(l1, "title", "listing_title") : null;
        // Bayut's WhatsApp push states the Listing Reference Number so the lead can reach the listing's
        // agent; it may sit on the listing object or flat on the payload itself.
        var reference = (listing is { } l2
                ? Str(l2, "listing_reference", "listing_reference_number", "reference", "reference_number", "permit_number", "ref")
                : null)
            ?? Str(el, "listing_reference", "listing_reference_number", "listing_ref", "property_reference");

        // Bayut's tracked reply link — the agent's response time is only measured when they reply through it.
        var contactLink = Str(el, "contact_link", "contactLink", "contact_url")
                       ?? Str(person, "contact_link", "contactLink")
                       ?? (story is { } cs ? Str(cs, "contact_link") : null);
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

        // What the enquirer wants to do. Documented values: Buying/Renting, Selling/Leasing,
        // Investing, General inquiry.
        var intent = Str(person, "intent", "visitor_intent") ?? Str(el, "visitor_intent", "intent");

        var notes = new StringBuilder();
        void Line(string label, string? v) { if (!string.IsNullOrWhiteSpace(v)) notes.Append(label).Append(": ").Append(v).Append('\n'); }
        Line("Enquiry", typeLabel);
        Line("Intent", intent);
        Line("Property", title);
        Line("Reference", reference);
        Line("Location", city);
        if (listing is { } l5)
        {
            // current_type is the pull API's property-type field.
            Line("Type", Humanize(listingIsStory
                ? Str(l5, "current_type", "property_type")
                : Str(l5, "current_type", "type", "property_type")));
            Line("Bedrooms", Str(l5, "bedrooms"));
            Line("Bathrooms", Str(l5, "bathrooms"));
        }
        // An agent- or agency-targeted enquiry names no property; record who was approached, or
        // the lead reads as though it came from nowhere.
        if (agent is { } ag)
        {
            Line("Agent", Str(ag, "name"));
            Line("Agent email", Str(ag, "email"));
        }
        if (agency is { } agy) Line("Agency", Str(agy, "name"));
        if (story is { } st2)
        {
            Line("Story", Str(st2, "listing_title", "project_title"));
            Line("Purpose", Humanize(Str(st2, "purpose")));
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
            // lead_id ("email|dffb56c2-…") is Bayut's stable per-enquiry id and the only safe
            // dedupe key: the pull API re-returns everything after `timestamp` on every poll.
            ExternalLeadId      = Str(el, "lead_id", "id", "call_log_id", "reference_number", "external_id"),
            PlatformCreatedTime = Str(el, "date_time", "received_at", "call_time", "created_at", "createdat", "timestamp", "date"),

            // An agent-targeted enquiry already belongs to someone at the portal; with external_map
            // routing the lead goes to that agent instead of round-robin.
            ExternalOwnerId     = agent is { } ao ? Str(ao, "email") ?? Str(ao, "id") ?? Str(ao, "url") : null,
            ListingReference    = reference,
            ContactLink         = contactLink,
            IsOrganic           = true,   // a portal enquiry is not paid advertising of ours

            RawJson = rawJson.Length > 8000 ? rawJson[..8000] : rawJson,
        };

        void Raw(string k, string? v) { if (!string.IsNullOrWhiteSpace(v)) canonical.RawFields[k] = v; }
        Raw($"{platformKey}_lead_id", Str(el, "lead_id", "id"));
        Raw("enquiry_type", typeLabel);
        Raw("intent", intent);
        Raw("listing_id", listing is { } li ? Str(li, "listing_id") : null);
        Raw("listing_reference", reference);
        Raw("agent_name", agent is { } a2 ? Str(a2, "name") : null);
        Raw("agency_name", agency is { } ay2 ? Str(ay2, "name") : null);
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
