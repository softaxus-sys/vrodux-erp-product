using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Softaxis.RealEstate.Infrastructure.Qasro;

/// <summary>
/// Thin hand-rolled HTTP client, mirroring GoogleOAuthClient/MetaGraphClient — this codebase pulls
/// in no SDK for any provider API. Two endpoints expected on Qasro's side; see this class's own
/// remarks on IQasroClient and the module notes for exactly what needs to exist there.
/// </summary>
public sealed class QasroClient(IHttpClientFactory httpFactory, IOptions<QasroOptions> options, ILogger<QasroClient> logger)
    : IQasroClient
{
    private readonly QasroOptions _o = options.Value;

    public async Task<string> LinkAgencyAsync(QasroLinkRequest request, CancellationToken ct)
    {
        if (!_o.IsConfigured)
            throw new InvalidOperationException(
                "Qasro is not configured on this deployment. Set Qasro:BaseUrl and Qasro:ServiceSecret " +
                "(env Qasro__BaseUrl / Qasro__ServiceSecret).");

        var client = Client();
        var body = new
        {
            vroduxTenantId = request.TenantId,
            companyName    = request.CompanyName,
            contactEmail   = request.ContactEmail,
            contactPhone   = request.ContactPhone,
            logoUrl        = request.LogoUrl,
            apiKey         = request.ApiKey,
            listingsApiBaseUrl = request.ListingsApiBaseUrl,
        };

        using var resp = await client.PostAsJsonAsync("/api/internal/agencies/link", body, ct);
        var text = await resp.Content.ReadAsStringAsync(ct);

        if (!resp.IsSuccessStatusCode)
        {
            logger.LogWarning("Qasro link-agency call failed ({Status}): {Body}", (int)resp.StatusCode, text);
            throw new InvalidOperationException($"Qasro rejected the connection request ({(int)resp.StatusCode}).");
        }

        using var doc = JsonDocument.Parse(text);
        return doc.RootElement.GetProperty("agencyId").GetString()
            ?? throw new InvalidOperationException("Qasro did not return an agency id.");
    }

    public async Task UnlinkAgencyAsync(string qasroAgencyId, CancellationToken ct)
    {
        if (!_o.IsConfigured) return; // nothing to tell — a local-only disconnect still succeeds

        try
        {
            var client = Client();
            using var resp = await client.PostAsync($"/api/internal/agencies/{qasroAgencyId}/unlink", null, ct);
            if (!resp.IsSuccessStatusCode)
                logger.LogWarning("Qasro unlink-agency call failed ({Status}) for {AgencyId}.", (int)resp.StatusCode, qasroAgencyId);
        }
        catch (Exception ex)
        {
            // Best-effort: the tenant's own disconnect must not fail because Qasro is unreachable.
            // A stale agency on Qasro's side with no live key just fails its own next pull silently.
            logger.LogWarning(ex, "Qasro unlink-agency call threw for {AgencyId}.", qasroAgencyId);
        }
    }

    private HttpClient Client()
    {
        var client = httpFactory.CreateClient("qasro");
        client.BaseAddress = new Uri(_o.BaseUrl);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", _o.ServiceSecret);
        return client;
    }
}
