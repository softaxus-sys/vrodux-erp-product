namespace Softaxis.RealEstate.Infrastructure.Qasro;

/// <summary>
/// Server-to-server calls to Qasro's own backend, made only at connect/disconnect time — never
/// per-listing. Qasro pulls a tenant's published listings itself, on its own schedule, via the
/// existing PublicListingsController (GET /api/real-estate/website/properties, X-Api-Key header)
/// using the key this client hands it. There is no push-per-listing call: fewer moving parts, and
/// it reuses the read API this codebase already built, tested and rate-limits for the "own
/// website" integration.
/// </summary>
public interface IQasroClient
{
    /// <summary>
    /// Creates or links the Qasro-side agency record for this tenant and hands it the API key it
    /// should use to pull listings going forward. Returns Qasro's own agency id.
    /// </summary>
    Task<string> LinkAgencyAsync(QasroLinkRequest request, CancellationToken ct);

    /// <summary>Tells Qasro to stop pulling for this agency and take its listings down. Best-effort
    /// — a failure here should not block a local disconnect (see DisconnectQasroHandler).</summary>
    Task UnlinkAgencyAsync(string qasroAgencyId, CancellationToken ct);
}

/// <param name="TenantId">Vrodux tenant id — Qasro's own reference back to "whose agency is this",
/// independent of the API key (which can be rotated without losing the link).</param>
/// <param name="CompanyName">Pre-filled from the tenant's General Settings company profile.</param>
/// <param name="ContactEmail">Pre-filled from the tenant's General Settings, shown as the agency's
/// public contact on Qasro.</param>
/// <param name="ApiKey">The plaintext key — sent once, over this server-to-server call only.
/// Qasro stores it (hashed, the same way this side never stores it back) and presents it as
/// X-Api-Key when pulling listings.</param>
/// <param name="ListingsApiBaseUrl">Where Qasro pulls from — this deployment's own
/// /api/real-estate/website base, so Qasro never has to be told or guess the host.</param>
public sealed record QasroLinkRequest(
    Guid TenantId,
    string CompanyName,
    string? ContactEmail,
    string? ContactPhone,
    string? LogoUrl,
    string ApiKey,
    string ListingsApiBaseUrl);
