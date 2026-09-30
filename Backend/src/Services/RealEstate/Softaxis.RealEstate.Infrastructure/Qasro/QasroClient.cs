using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Softaxis.RealEstate.Infrastructure.Qasro;

/// <summary>
/// Thin hand-rolled HTTP client, mirroring GoogleOAuthClient/MetaGraphClient — this codebase pulls
/// in no SDK for any provider API. Three endpoints expected on Qasro's side; see IQasroClient's own
/// remarks and the module notes for exactly what needs to exist there.
/// </summary>
public sealed class QasroClient(IHttpClientFactory httpFactory, IOptions<QasroOptions> options, ILogger<QasroClient> logger)
    : IQasroClient
{
    private readonly QasroOptions _o = options.Value;

    public string BuildAuthorizeUrl(string redirectUri, string state, string companyNameHint) =>
        $"{_o.SiteUrl.TrimEnd('/')}/oauth/authorize" +
        $"?client_id={Uri.EscapeDataString(_o.ClientId)}" +
        $"&redirect_uri={Uri.EscapeDataString(redirectUri)}" +
        $"&state={Uri.EscapeDataString(state)}" +
        $"&company_name={Uri.EscapeDataString(companyNameHint)}";

    public async Task<string> ExchangeCodeAsync(string code, string redirectUri, CancellationToken ct)
    {
        RequireConfigured();

        var client = Client();
        var body = new
        {
            grant_type   = "authorization_code",
            code,
            redirect_uri = redirectUri,
            client_id    = _o.ClientId,
            client_secret = _o.ClientSecret,
        };

        using var resp = await client.PostAsJsonAsync("/api/oauth/token", body, ct);
        ThrowIfRedirected(resp, "token exchange");
        var text = await resp.Content.ReadAsStringAsync(ct);

        // Qasro's approval gate answers here, distinctly from a bad/expired code — see
        // QasroNotApprovedException's own remarks on why this needs its own message to the tenant.
        if (resp.StatusCode == System.Net.HttpStatusCode.Forbidden)
        {
            var reason = TryGetString(text, "message") ?? "Your Qasro agency isn't approved yet.";
            throw new QasroNotApprovedException(reason);
        }

        if (!resp.IsSuccessStatusCode)
        {
            logger.LogWarning("Qasro token exchange failed ({Status}): {Body}", (int)resp.StatusCode, text);
            throw new InvalidOperationException($"Qasro rejected the connection ({(int)resp.StatusCode}).");
        }

        return TryGetString(text, "agencyId")
            ?? throw new InvalidOperationException("Qasro did not return an agency id.");
    }

    public async Task RegisterPullKeyAsync(string qasroAgencyId, string apiKey, string listingsApiBaseUrl, CancellationToken ct)
    {
        RequireConfigured();

        var client = AuthenticatedClient();
        var body = new { apiKey, listingsApiBaseUrl };

        using var resp = await client.PostAsJsonAsync($"/api/internal/agencies/{qasroAgencyId}/pull-key", body, ct);
        ThrowIfRedirected(resp, "listings key registration");
        var text = await resp.Content.ReadAsStringAsync(ct);

        if (!resp.IsSuccessStatusCode)
        {
            logger.LogWarning("Qasro pull-key registration failed ({Status}) for {AgencyId}: {Body}", (int)resp.StatusCode, qasroAgencyId, text);
            throw new InvalidOperationException($"Qasro accepted the connection but rejected the listings key ({(int)resp.StatusCode}).");
        }
    }

    public async Task UnlinkAgencyAsync(string qasroAgencyId, CancellationToken ct)
    {
        if (!_o.IsConfigured) return; // nothing to tell — a local-only disconnect still succeeds

        try
        {
            var client = AuthenticatedClient();
            using var resp = await client.PostAsync($"/api/internal/agencies/{qasroAgencyId}/unlink", null, ct);
            if ((int)resp.StatusCode is >= 300 and < 400)
                logger.LogWarning(
                    "Qasro unlink-agency call was redirected ({Status}) for {AgencyId} — Qasro:ApiBaseUrl ({BaseUrl}) is " +
                    "probably not the canonical host (redirects strip the Authorization header, so this always 401s " +
                    "downstream). Location: {Location}",
                    (int)resp.StatusCode, qasroAgencyId, _o.ApiBaseUrl, resp.Headers.Location);
            else if (!resp.IsSuccessStatusCode)
                logger.LogWarning("Qasro unlink-agency call failed ({Status}) for {AgencyId}.", (int)resp.StatusCode, qasroAgencyId);
        }
        catch (Exception ex)
        {
            // Best-effort: the tenant's own disconnect must not fail because Qasro is unreachable.
            logger.LogWarning(ex, "Qasro unlink-agency call threw for {AgencyId}.", qasroAgencyId);
        }
    }

    /// <summary>
    /// AllowAutoRedirect is off on this client (see InfrastructureExtensions), so a 3xx here means
    /// Qasro:ApiBaseUrl is pointed at a non-canonical host (e.g. the Vercel apex→www redirect) —
    /// exactly the bug that once produced a baffling downstream 401 on a header-authenticated call
    /// while the body-authenticated token exchange worked fine. Fail loudly with the fix, not with
    /// whatever status code the *next* hop happens to return.
    /// </summary>
    private void ThrowIfRedirected(HttpResponseMessage resp, string action)
    {
        if ((int)resp.StatusCode is not (>= 300 and < 400)) return;

        var location = resp.Headers.Location?.ToString() ?? "(no Location header)";
        logger.LogError("Qasro {Action} was redirected ({Status}) from {BaseUrl} to {Location}",
            action, (int)resp.StatusCode, _o.ApiBaseUrl, location);
        throw new InvalidOperationException(
            $"Qasro's API redirected this request ({(int)resp.StatusCode}) from {_o.ApiBaseUrl} to {location}. " +
            "Cross-host redirects silently drop the Authorization header, which breaks any authenticated call. " +
            "Set Qasro:ApiBaseUrl (env Qasro__ApiBaseUrl) to the exact canonical host shown in that Location URL.");
    }

    private void RequireConfigured()
    {
        if (!_o.IsConfigured)
            throw new InvalidOperationException(
                "Qasro is not configured on this deployment. Set Qasro:ApiBaseUrl and Qasro:ClientSecret " +
                "(env Qasro__ApiBaseUrl / Qasro__ClientSecret).");
    }

    private HttpClient Client()
    {
        var client = httpFactory.CreateClient("qasro");
        client.BaseAddress = new Uri(_o.ApiBaseUrl);
        return client;
    }

    /// <summary>Server-to-server calls after the OAuth handshake authenticate with the client
    /// secret directly — there is no separate per-agency token to carry, since Vrodux never holds
    /// a long-lived Qasro-issued credential (only its own locally-generated pull key, which flows
    /// the other way — see RegisterPullKeyAsync).</summary>
    private HttpClient AuthenticatedClient()
    {
        var client = Client();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", _o.ClientSecret);
        return client;
    }

    private static string? TryGetString(string json, string property)
    {
        try
        {
            using var doc = JsonDocument.Parse(json);
            return doc.RootElement.TryGetProperty(property, out var el) ? el.GetString() : null;
        }
        catch (JsonException)
        {
            return null;
        }
    }
}
