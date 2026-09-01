using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Softaxis.CRM.Application.LeadIntake.Abstractions;
using Softaxis.CRM.Application.LeadIntake.Dtos;
using Softaxis.CRM.Domain.Entities.Integrations;
using Softaxis.CRM.Infrastructure.Integrations.Providers.PropertyPortals;

namespace Softaxis.CRM.Infrastructure.Integrations.Providers;

/// <summary>
/// Dubizzle Property enquiries → CRM leads.
///
/// <para>Dubizzle publishes no API of its own — it runs on the same EMPG/Dubizzle Group advertiser
/// backend as Bayut, so a Dubizzle enquiry is delivered through the same "Leads API" push
/// mechanism Bayut offers, tagged by source. Kept as its own catalog entry (rather than folded into
/// <see cref="BayutLeadProvider"/>) because a tenant may run Bayut and Dubizzle as separate
/// listings accounts with their own webhook enablement request and inbound URL, and because the
/// resulting leads should say "Dubizzle" rather than "Bayut" in the CRM. The payload shape and
/// parsing are otherwise identical — see <see cref="PropertyPortalLeadMapper"/>.</para>
///
/// <para>Auth: same posture as every inbound provider — possession of the unguessable inbound URL
/// is the baseline secret; an optional signature header is verified only if the tenant has stored
/// a signing secret.</para>
/// </summary>
public sealed class DubizzleLeadProvider : ILeadProvider, IWebhookLeadProvider
{
    public string Key => "dubizzle";

    public ProviderDescriptor Descriptor => new(
        "dubizzle", "Dubizzle Property", ProviderCategory.RealEstate,
        "Turn Dubizzle property enquiries into CRM leads — request lead delivery via Bayut/Dubizzle support, then point it at your inbound URL.",
        ProviderCapabilities.Webhook | ProviderCapabilities.InboundKey);

    public IReadOnlyList<CanonicalLead> Normalize(string rawPayload, Integration integration)
    {
        var leads = new List<CanonicalLead>();
        foreach (var (el, json) in BayutLeadProvider.ExtractLeads(rawPayload))
            if (PropertyPortalLeadMapper.Map(el, json, "dubizzle", "Dubizzle") is { } lead)
                leads.Add(lead);
        return leads;
    }

    // ── Webhook capability ──────────────────────────────────────────────────────

    public string? TryHandleVerification(IReadOnlyDictionary<string, string> query, Integration integration) => null;

    public bool VerifySignature(string rawBody, IReadOnlyDictionary<string, string> headers, string? decryptedSecret)
    {
        var sig = Header(headers, "X-Dubizzle-Signature")
               ?? Header(headers, "X-Signature")
               ?? Header(headers, "X-Hub-Signature-256")
               ?? Header(headers, "X-Vrodux-Signature");

        if (string.IsNullOrWhiteSpace(sig)) return true;
        if (string.IsNullOrWhiteSpace(decryptedSecret)) return true;

        var provided = sig.StartsWith("sha256=", StringComparison.OrdinalIgnoreCase) ? sig[7..] : sig;
        var computed = Convert.ToHexString(
            HMACSHA256.HashData(Encoding.UTF8.GetBytes(decryptedSecret), Encoding.UTF8.GetBytes(rawBody)));

        return CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(provided.Trim().ToLowerInvariant()),
            Encoding.UTF8.GetBytes(computed.ToLowerInvariant()));
    }

    private static string? Header(IReadOnlyDictionary<string, string> headers, string name) =>
        headers.TryGetValue(name, out var v) ? v : null;
}
