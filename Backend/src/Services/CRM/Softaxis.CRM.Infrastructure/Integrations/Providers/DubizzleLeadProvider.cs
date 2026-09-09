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
public sealed class DubizzleLeadProvider(BayutPullApiClient api, ISecretProtector protector)
    : ILeadProvider, IWebhookLeadProvider, IPollSyncLeadProvider
{
    public string Key => "dubizzle";

    public ProviderDescriptor Descriptor => new(
        "dubizzle", "Dubizzle Property", ProviderCategory.RealEstate,
        "Turn Dubizzle property enquiries into CRM leads — request lead delivery via Bayut/Dubizzle support, then point it at your inbound URL.",
        ProviderCapabilities.Webhook | ProviderCapabilities.InboundKey
        | ProviderCapabilities.ApiKey | ProviderCapabilities.PollSync);

    public IReadOnlyList<CanonicalLead> Normalize(string rawPayload, Integration integration)
    {
        var leads = new List<CanonicalLead>();
        foreach (var (el, json) in BayutLeadProvider.ExtractLeads(rawPayload))
            // As Bayut: the documented push payloads are WhatsApp enquiries with no type field.
            if (PropertyPortalLeadMapper.Map(el, json, "dubizzle", "Dubizzle", "WhatsApp lead") is { } lead)
                leads.Add(lead);
        return leads;
    }

    // ── Webhook capability ──────────────────────────────────────────────────────

    public string? TryHandleVerification(IReadOnlyDictionary<string, string> query, Integration integration) => null;

    /// <inheritdoc cref="PropertyPortalSignature"/>
    public bool VerifySignature(string rawBody, IReadOnlyDictionary<string, string> headers, string? decryptedSecret) =>
        PropertyPortalSignature.Verify(rawBody, headers, decryptedSecret);

    // ── Poll sync — the Pull API ────────────────────────────────────────────────

    /// <summary>Same API as Bayut, different host: dubizzle.com/profolio/api-v7/…</summary>
    public Task<IReadOnlyList<CanonicalLead>> FetchAsync(Integration integration, CancellationToken ct) =>
        BayutPullSync.FetchAsync(api, protector, integration,
            BayutPullApiClient.DubizzleBaseUrl, "dubizzle", "Dubizzle", ct);
}
