using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Softaxis.CRM.Application.LeadIntake;
using Softaxis.CRM.Application.LeadIntake.Abstractions;
using Softaxis.CRM.Application.LeadIntake.Dtos;
using Softaxis.CRM.Domain.Entities.Integrations;

namespace Softaxis.CRM.Infrastructure.Integrations.Providers.Meta;

/// <summary>
/// Facebook &amp; Instagram Lead Ads provider. Connects via OAuth (page selection), receives
/// leadgen webhooks (verified with the app secret), and retrieves each lead from the Graph API
/// using the selected page's stored (encrypted) access token. Also supports scheduled polling.
/// </summary>
public sealed class MetaLeadProvider(
    IOptions<MetaOptions> options,
    MetaGraphClient graph,
    ISecretProtector protector,
    ILogger<MetaLeadProvider> logger)
    : ILeadProvider, IOAuthLeadProvider, IWebhookLeadProvider, IAsyncLeadProvider, IPollSyncLeadProvider
{
    private readonly MetaOptions _o = options.Value;

    public string Key => "meta";

    public ProviderDescriptor Descriptor => new(
        "meta", "Facebook & Instagram Lead Ads", ProviderCategory.SocialAds,
        "Capture leads from Facebook & Instagram Lead Ads instant forms in real time.",
        ProviderCapabilities.OAuth | ProviderCapabilities.Webhook | ProviderCapabilities.PollSync,
        ComingSoon: !_o.IsConfigured);

    // Meta payloads only reference a lead — real work happens in NormalizeAsync.
    public IReadOnlyList<CanonicalLead> Normalize(string rawPayload, Integration integration) => [];

    // ── OAuth ───────────────────────────────────────────────────────────────
    public string BuildAuthorizationUrl(string redirectUri, string state) => graph.BuildLoginUrl(redirectUri, state);

    public async Task<OAuthResult> ExchangeCodeAsync(string code, string redirectUri, CancellationToken ct)
    {
        var (token, expiresAt) = await graph.ExchangeCodeAsync(code, redirectUri, ct);
        var name = await graph.GetUserNameAsync(token, ct);
        return new OAuthResult(token, RefreshToken: null, expiresAt, name);
    }

    public Task<OAuthResult?> RefreshAsync(Integration integration, CancellationToken ct) => Task.FromResult<OAuthResult?>(null);

    // ── Webhook ─────────────────────────────────────────────────────────────
    public string? TryHandleVerification(IReadOnlyDictionary<string, string> query, Integration integration)
    {
        if (query.TryGetValue("hub.mode", out var mode) && mode == "subscribe"
            && query.TryGetValue("hub.verify_token", out var token) && token == _o.VerifyToken
            && query.TryGetValue("hub.challenge", out var challenge))
            return challenge;
        return null;
    }

    public bool VerifySignature(string rawBody, IReadOnlyDictionary<string, string> headers, string? decryptedSecret)
    {
        if (!headers.TryGetValue("X-Hub-Signature-256", out var sig) || string.IsNullOrWhiteSpace(sig))
            return false;
        if (string.IsNullOrWhiteSpace(_o.AppSecret)) return false;

        var provided = sig.StartsWith("sha256=", StringComparison.OrdinalIgnoreCase) ? sig[7..] : sig;
        var computed = Convert.ToHexString(
            new HMACSHA256(Encoding.UTF8.GetBytes(_o.AppSecret)).ComputeHash(Encoding.UTF8.GetBytes(rawBody)))
            .ToLowerInvariant();
        return CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(provided.ToLowerInvariant()), Encoding.UTF8.GetBytes(computed));
    }

    // ── Async retrieval (webhook → Graph fetch) ───────────────────────────────
    public async Task<IReadOnlyList<CanonicalLead>> NormalizeAsync(string rawPayload, Integration integration, CancellationToken ct)
    {
        JsonElement root;
        try { root = JsonDocument.Parse(rawPayload).RootElement; }
        catch { return []; }

        if (!root.TryGetProperty("entry", out var entries) || entries.ValueKind != JsonValueKind.Array) return [];

        var results = new List<CanonicalLead>();
        foreach (var entry in entries.EnumerateArray())
        {
            if (!entry.TryGetProperty("changes", out var changes)) continue;
            foreach (var change in changes.EnumerateArray())
            {
                if (!change.TryGetProperty("field", out var f) || f.GetString() != "leadgen") continue;
                if (!change.TryGetProperty("value", out var v)) continue;

                var pageId    = Str(v, "page_id");
                var leadgenId = Str(v, "leadgen_id");
                if (string.IsNullOrEmpty(leadgenId)) continue;

                var pageToken = ResolvePageToken(integration, pageId);
                if (pageToken is null)
                {
                    logger.LogWarning("Meta: no stored token for page {Page} (integration {Integration}).", pageId, integration.Id);
                    continue;
                }

                try
                {
                    var lead = await graph.GetLeadAsync(leadgenId, pageToken, ct);
                    results.Add(MapLead(lead, pageId));
                }
                catch (Exception ex)
                {
                    logger.LogWarning(ex, "Meta: failed to fetch leadgen {Lead}.", leadgenId);
                    throw; // let the inbox retry with backoff
                }
            }
        }
        return results;
    }

    // ── Poll sync ─────────────────────────────────────────────────────────────
    public async Task<IReadOnlyList<CanonicalLead>> FetchAsync(Integration integration, CancellationToken ct)
    {
        var results = new List<CanonicalLead>();
        var forms = integration.Resources.Where(r => r.ResourceType == "form" && r.Enabled).ToList();
        foreach (var form in forms)
        {
            var pageToken = ResolvePageToken(integration, form.ParentExternalId);
            if (pageToken is null) continue;
            var leads = await graph.GetFormLeadsAsync(form.ExternalId, pageToken, integration.LastSuccessAt, ct);
            results.AddRange(leads.Select(l => MapLead(l, form.ParentExternalId)));
        }
        return results;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    private string? ResolvePageToken(Integration integration, string? pageId)
    {
        var page = integration.Resources.FirstOrDefault(r =>
            r.ResourceType == "page" && (pageId == null || r.ExternalId == pageId));
        return page?.AccessToken is { } enc ? protector.Unprotect(enc) : null;
    }

    private static CanonicalLead MapLead(JsonElement lead, string? pageId)
    {
        var isOrganic = lead.TryGetProperty("is_organic", out var org) && org.ValueKind == JsonValueKind.True
            ? true
            : lead.TryGetProperty("is_organic", out var org2) && org2.ValueKind == JsonValueKind.False ? false : (bool?)null;

        var lc = new CanonicalLead
        {
            ExternalLeadId = Str(lead, "id"),
            Platform   = Str(lead, "platform") ?? "facebook",
            CampaignId = Str(lead, "campaign_id"),
            Campaign   = Str(lead, "campaign_name"),
            AdSetId    = Str(lead, "adset_id"),
            AdSetName  = Str(lead, "adset_name"),
            AdId       = Str(lead, "ad_id"),
            AdName     = Str(lead, "ad_name"),
            FormId     = Str(lead, "form_id"),
            FormName   = Str(lead, "form_name"),
            IsOrganic  = isOrganic,
            PageId     = pageId,
            PlatformCreatedTime = Str(lead, "created_time"),
            UtmSource  = "meta",
            UtmMedium  = Str(lead, "platform") ?? "facebook",
            RawJson    = lead.GetRawText().Length > 8000 ? lead.GetRawText()[..8000] : lead.GetRawText(),
        };

        if (lead.TryGetProperty("field_data", out var fields) && fields.ValueKind == JsonValueKind.Array)
        {
            foreach (var field in fields.EnumerateArray())
            {
                var name  = Str(field, "name");
                var value = field.TryGetProperty("values", out var vals) && vals.ValueKind == JsonValueKind.Array
                    ? vals.EnumerateArray().FirstOrDefault().GetString() : null;
                if (string.IsNullOrEmpty(name) || string.IsNullOrEmpty(value)) continue;

                lc.RawFields[name] = value;
                switch (name.ToLowerInvariant())
                {
                    case "full_name": case "name":            lc.FullName  ??= value; break;
                    case "first_name":                        lc.FirstName ??= value; break;
                    case "last_name":                         lc.LastName  ??= value; break;
                    case "email":                             lc.Email     ??= value; break;
                    case "phone_number": case "phone":        lc.Phone     ??= value; break;
                    case "company_name": case "company":      lc.Company   ??= value; break;
                    case "job_title":                         lc.Title     ??= value; break;
                    case "city":                              lc.City      ??= value; break;
                    case "country":                           lc.Country   ??= value; break;
                    case "street_address": case "address":    lc.Address   ??= value; break;
                    case "whatsapp": case "whatsapp_number":   lc.WhatsApp     ??= value; break;
                    case "message": case "your_message":       lc.Message      ??= value; break;
                    case "budget": case "your_budget":         lc.Budget       ??= value; break;
                    case "interested_in": case "interest":     lc.InterestedIn ??= value; break;
                    case "timeframe": case "timeline": case "when_to_buy": case "when_looking_to_buy":
                    case "purchase_timeline": case "buying_timeline": case "when_planning_to_invest":
                    case "move_in": case "urgency":            lc.Timeframe    ??= value; break;
                }

                // Fallback: real Meta question names ("your_budget?", "when_are_you_planning_to_buy?",
                // "what_are_you_interested_in?", "whatsapp_number") don't match the exact cases above —
                // the normalized classifier captures them so budget/timeframe/interest aren't lost.
                LeadFieldClassifier.Apply(lc, name, value);
            }
        }
        return lc;
    }

    private static string? Str(JsonElement el, string prop)
    {
        if (el.ValueKind != JsonValueKind.Object || !el.TryGetProperty(prop, out var v)) return null;
        return v.ValueKind switch
        {
            JsonValueKind.String => v.GetString(),
            JsonValueKind.Number => v.GetRawText(),
            _ => null,
        };
    }
}
