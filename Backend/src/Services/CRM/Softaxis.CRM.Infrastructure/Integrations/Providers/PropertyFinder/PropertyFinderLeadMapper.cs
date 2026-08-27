using System.Globalization;
using System.Text;
using System.Text.Json;
using Softaxis.CRM.Application.LeadIntake.Dtos;

namespace Softaxis.CRM.Infrastructure.Integrations.Providers.PropertyFinder;

/// <summary>
/// Property Finder <c>Lead</c> → <see cref="CanonicalLead"/>.
///
/// The shape is nothing like a web lead form. A PF lead is an ENQUIRY EVENT:
/// <code>
/// { id, entityType, channel: call|whatsapp|email, status, createdAt,
///   sender: { name, contacts: [{ type: email|phone|whatsappUsername, value }] },
///   publicProfile: { id },        // the agent who owns it
///   listing: { id, reference },   // id + reference ONLY
///   call: { talkTime, waitTime, recordFile }, tags: [] }
/// </code>
/// There is no message, no budget and no timeframe anywhere — so those canonical fields stay null
/// rather than being invented. Measured against the live account (6,962 leads): every lead has a
/// phone, only 1.8% have an email, 76% have a name, and 31% reference a listing.
///
/// Because of that, <b>phone is the identity</b> — dedupe must never be configured on email for
/// this source or 98% of leads would look like they have no identifier at all.
///
/// The property title and price are NOT on the lead; they come from a separate listing lookup and
/// are passed in via <paramref name="listing"/> when available.
/// </summary>
public static class PropertyFinderLeadMapper
{
    /// <summary>Enrichment pulled from <c>GET /v1/listings</c> for the lead's listing.</summary>
    public sealed record ListingInfo(
        string  Id,
        string? Reference,
        string? Title,
        decimal? Price,
        string? PriceType,     // "yearly" (rent) / "sale" …
        string? PropertyType,
        string? Category,
        string? Bedrooms,
        string? Bathrooms,
        string? Size,
        int?    LocationId,
        string? AgentName);

    public static CanonicalLead? Map(JsonElement lead, ListingInfo? listing, string rawJson)
    {
        var id = Str(lead, "id");

        // Contacts are a typed array, not named fields.
        string? phone = null, email = null, waUser = null;
        if (lead.TryGetProperty("sender", out var sender) && sender.ValueKind == JsonValueKind.Object &&
            sender.TryGetProperty("contacts", out var contacts) && contacts.ValueKind == JsonValueKind.Array)
        {
            foreach (var c in contacts.EnumerateArray())
            {
                var type = Str(c, "type");
                var val  = Str(c, "value");
                if (val is null) continue;
                switch (type)
                {
                    case "phone":            phone  ??= val; break;
                    case "email":            email  ??= val; break;
                    case "whatsappUsername": waUser ??= val; break;
                }
            }
        }

        // No contact at all = not a workable lead. (None were observed, but a webhook could differ.)
        if (phone is null && email is null) return null;

        var name    = sender.ValueKind == JsonValueKind.Object ? Str(sender, "name") : null;
        var channel = Str(lead, "channel");        // call | whatsapp | email
        var status  = Str(lead, "status");         // sent | delivered | read | replied | failed
        var entity  = Str(lead, "entityType");
        var created = Str(lead, "createdAt");

        // A WhatsApp enquiry means the sender's number IS reachable on WhatsApp — that is a real
        // fact from the channel, not a guess, and it drives the wa.me link in the lead drawer.
        var whatsApp = channel == "whatsapp" ? (waUser ?? phone) : waUser;

        var listingRef = listing?.Reference
                      ?? (lead.TryGetProperty("listing", out var lst) && lst.ValueKind == JsonValueKind.Object
                            ? Str(lst, "reference") : null);
        var listingId  = listing?.Id
                      ?? (lead.TryGetProperty("listing", out var lst2) && lst2.ValueKind == JsonValueKind.Object
                            ? Str(lst2, "id") : null);

        // "Interested in" — the property enquired about. Falls back to the bare reference when the
        // listing could not be fetched (deleted listings 404), which is still more use than nothing.
        string? interested = listing?.Title;
        if (interested is null && listingRef is not null) interested = $"Ref {listingRef}";
        else if (interested is not null && listingRef is not null) interested = $"{interested} (Ref {listingRef})";

        // Budget — the asking price of the property they enquired about. It is the property's price,
        // not a budget the person stated, so the price type is included to keep that honest:
        // "300,000 / yearly" reads as a rent, not as a declared budget.
        string? budget = null;
        if (listing?.Price is { } price && price > 0)
        {
            budget = price.ToString("#,##0", CultureInfo.InvariantCulture);
            if (!string.IsNullOrWhiteSpace(listing.PriceType) && !listing.PriceType.Equals("sale", StringComparison.OrdinalIgnoreCase))
                budget += $" / {listing.PriceType}";
        }

        var notes = new StringBuilder();
        void Line(string label, string? v) { if (!string.IsNullOrWhiteSpace(v)) notes.Append(label).Append(": ").Append(v).Append('\n'); }
        Line("Enquiry", ChannelLabel(channel));
        Line("Property", listing?.Title);
        Line("Reference", listingRef);
        Line("Type", Humanize(listing?.PropertyType));
        Line("Price", budget);
        Line("Bedrooms", listing?.Bedrooms);
        Line("Bathrooms", listing?.Bathrooms);
        Line("Size", listing?.Size is { } sz ? $"{sz} sqft" : null);
        Line("Agent", listing?.AgentName);

        // Call enquiries carry real engagement signal — a 4-minute conversation is not the same
        // lead as a 3-second misdial, and the recording is the only "message" this source has.
        if (lead.TryGetProperty("call", out var call) && call.ValueKind == JsonValueKind.Object)
        {
            var talk = Num(call, "talkTime");
            if (talk is > 0) Line("Call duration", $"{talk}s");
            Line("Recording", Str(call, "recordFile"));
        }

        var canonical = new CanonicalLead
        {
            FullName     = name,
            Email        = email,
            Phone        = phone,
            WhatsApp     = whatsApp,
            InterestedIn = interested,
            Budget       = budget,
            Notes        = notes.Length > 0 ? notes.ToString().TrimEnd() : null,

            Platform            = "property_finder",
            FormName            = $"Property Finder — {ChannelLabel(channel) ?? "enquiry"}",
            ExternalLeadId      = id,
            // The portal already knows whose enquiry this is. Carried through so intake can give
            // it to that agent instead of round-robining it to whoever is next in the pool.
            ExternalOwnerId     = ProfileId(lead)?.ToString(),
            PlatformCreatedTime = created,
            IsOrganic           = true,   // a portal enquiry is not paid advertising of ours

            RawJson = rawJson.Length > 8000 ? rawJson[..8000] : rawJson,
        };

        void Raw(string k, string? v) { if (!string.IsNullOrWhiteSpace(v)) canonical.RawFields[k] = v; }
        Raw("pf_lead_id", id);
        Raw("channel", ChannelLabel(channel));
        Raw("delivery_status", status);
        Raw("entity_type", entity);
        Raw("listing_id", listingId);
        Raw("listing_reference", listingRef);
        Raw("property_title", listing?.Title);
        Raw("property_type", Humanize(listing?.PropertyType));
        Raw("category", Humanize(listing?.Category));
        Raw("bedrooms", listing?.Bedrooms);
        Raw("bathrooms", listing?.Bathrooms);
        Raw("size_sqft", listing?.Size);
        Raw("listing_agent", listing?.AgentName);
        Raw("pf_agent_profile_id", ProfileId(lead)?.ToString());
        Raw("response_link", Str(lead, "responseLink"));
        if (lead.TryGetProperty("call", out var c2) && c2.ValueKind == JsonValueKind.Object)
        {
            Raw("call_talk_time_seconds", Num(c2, "talkTime")?.ToString());
            Raw("call_wait_time_seconds", Num(c2, "waitTime")?.ToString());
            Raw("call_recording", Str(c2, "recordFile"));
        }
        if (lead.TryGetProperty("tags", out var tags) && tags.ValueKind == JsonValueKind.Array)
        {
            var list = tags.EnumerateArray().Select(t => t.GetString()).Where(t => !string.IsNullOrWhiteSpace(t)).ToList();
            if (list.Count > 0) Raw("tags", string.Join(", ", list));
        }

        return canonical;
    }

    /// <summary>The agent who owns the enquiry — joins to a PF user via <c>publicProfile.id</c>.</summary>
    public static int? ProfileId(JsonElement lead) =>
        lead.TryGetProperty("publicProfile", out var p) && p.ValueKind == JsonValueKind.Object
            ? Num(p, "id") : null;

    /// <summary>Listing id referenced by this lead, if any (only ~31% of leads have one).</summary>
    public static string? ListingId(JsonElement lead) =>
        lead.TryGetProperty("listing", out var l) && l.ValueKind == JsonValueKind.Object ? Str(l, "id") : null;

    /// <summary>Parse a <c>GET /v1/listings</c> result into the enrichment we actually use.</summary>
    public static ListingInfo? ParseListing(JsonElement l)
    {
        var id = Str(l, "id");
        if (id is null) return null;

        // title is localized: { "en": "...", "ar": "..." }
        string? title = null;
        if (l.TryGetProperty("title", out var t))
            title = t.ValueKind == JsonValueKind.Object ? (Str(t, "en") ?? FirstString(t)) : Str(l, "title");

        // price is { amounts: { yearly|monthly|sale: n }, type: "yearly" }
        decimal? price = null; string? priceType = null;
        if (l.TryGetProperty("price", out var p) && p.ValueKind == JsonValueKind.Object)
        {
            priceType = Str(p, "type");
            if (p.TryGetProperty("amounts", out var amounts) && amounts.ValueKind == JsonValueKind.Object)
            {
                // Prefer the amount matching the stated type; otherwise take the first present.
                if (priceType is not null && amounts.TryGetProperty(priceType, out var exact) && exact.TryGetDecimal(out var dv))
                    price = dv;
                else
                    foreach (var a in amounts.EnumerateObject())
                        if (a.Value.TryGetDecimal(out var v)) { price = v; priceType ??= a.Name; break; }
            }
        }

        int? locationId = null;
        if (l.TryGetProperty("location", out var loc) && loc.ValueKind == JsonValueKind.Object)
            locationId = Num(loc, "id");

        string? agent = null;
        if (l.TryGetProperty("assignedTo", out var a2) && a2.ValueKind == JsonValueKind.Object)
            agent = Str(a2, "name");

        return new ListingInfo(
            id, Str(l, "reference"), title, price, priceType,
            Str(l, "type"), Str(l, "category"),
            Str(l, "bedrooms"), Str(l, "bathrooms"),
            l.TryGetProperty("size", out var s) ? (s.ValueKind == JsonValueKind.Number ? s.GetRawText() : Str(l, "size")) : null,
            locationId, agent);
    }

    // ── helpers ─────────────────────────────────────────────────────────────────

    private static string? ChannelLabel(string? channel) => channel switch
    {
        "whatsapp" => "WhatsApp",
        "call"     => "Phone call",
        "email"    => "Email",
        null       => null,
        _          => Humanize(channel),
    };

    private static string? Humanize(string? s) =>
        string.IsNullOrWhiteSpace(s) ? null
            : CultureInfo.InvariantCulture.TextInfo.ToTitleCase(s.Replace('-', ' ').Replace('_', ' '));

    private static string? Str(JsonElement el, string prop)
    {
        if (el.ValueKind != JsonValueKind.Object || !el.TryGetProperty(prop, out var v)) return null;
        return v.ValueKind switch
        {
            JsonValueKind.String => string.IsNullOrWhiteSpace(v.GetString()) ? null : v.GetString()!.Trim(),
            JsonValueKind.Number => v.GetRawText(),
            _ => null,
        };
    }

    private static int? Num(JsonElement el, string prop) =>
        el.ValueKind == JsonValueKind.Object && el.TryGetProperty(prop, out var v) &&
        v.ValueKind == JsonValueKind.Number && v.TryGetInt32(out var i) ? i : null;

    private static string? FirstString(JsonElement obj)
    {
        foreach (var p in obj.EnumerateObject())
            if (p.Value.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(p.Value.GetString()))
                return p.Value.GetString()!.Trim();
        return null;
    }
}
