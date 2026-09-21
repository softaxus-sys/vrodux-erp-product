using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace Softaxis.CRM.Infrastructure.Integrations.Providers.PropertyPortals;

/// <summary>Raised when the portal rejects the API key (401/403) — the integration is misconfigured,
/// not merely having a bad day, so the caller should mark it unhealthy rather than retry forever.</summary>
public sealed class BayutPullAuthException(string message) : PortalPullConfigurationException(message);

/// <summary>
/// One (type, target) slice of a sweep: the rows it returned, or why it returned none.
///
/// <para>The error is carried back rather than only logged because the caller needs to tell two
/// cases apart that used to look identical: a slice that legitimately had nothing, and a slice the
/// portal refused. Only the second should make the integration unhealthy, and only the second has
/// anything worth showing the user.</para>
/// </summary>
/// <param name="Error">null on success — including a successful empty slice.</param>
public readonly record struct BayutPullSlice(IReadOnlyList<JsonElement> Items, string? Error)
{
    public static BayutPullSlice Ok(IReadOnlyList<JsonElement> items) => new(items, null);
    public static BayutPullSlice Failed(string error) => new([], error);
}

/// <summary>
/// Client for the Bayut / Dubizzle "Pull API" — <c>GET …/api-v7/stats/website-client-leads</c>.
///
/// <para>Auth is a single per-account key sent as <c>Authorization: Bearer &lt;key&gt;</c>.</para>
///
/// <para>One request returns ONE combination of <c>type</c> × <c>target</c>, so a full sweep is
/// several calls (email/whatsapp × listing/agent/agency, plus call_logs). The response is a bare
/// JSON array with no paging parameters of any kind: <c>timestamp</c> is the only filter, and
/// everything after it comes back every time. That is why the caller must dedupe on
/// <c>lead_id</c> — see <see cref="BayutPullSync"/>.</para>
///
/// <para><b>is_trulead is the dangerous parameter.</b> 1 returns real enquiries carrying
/// <c>inquirer_details</c>; 0 returns aggregate VIEW COUNTS (<c>"whatsapp_views": 8</c>) with no
/// enquirer at all. The two differ by one character in the query string and would otherwise import
/// view tallies as if they were people, so this client never sends 0.</para>
/// </summary>
public sealed class BayutPullApiClient(IHttpClientFactory httpFactory, ILogger<BayutPullApiClient> logger)
{
    /// <summary>Named <see cref="HttpClient"/> registered in InfrastructureExtensions.</summary>
    public const string HttpClientName = "bayut-portal";

    /// <summary>Bayut's own account endpoint. Documented without a scheme; HTTPS is required.</summary>
    public const string BayutBaseUrl = "https://www.bayut.com/api-v7/stats/website-client-leads";

    /// <summary>Dubizzle sits on the same API behind a different host and a /profolio prefix.</summary>
    public const string DubizzleBaseUrl = "https://dubizzle.com/profolio/api-v7/stats/website-client-leads";

    /// <summary>The lead types worth pulling, paired with the targets each can be raised against.</summary>
    /// <remarks>
    /// sms and phone are deliberately absent: the documentation shows them only under
    /// <c>is_trulead=0</c> (view counts), never as enquiries with a contactable person. Phone
    /// contact arrives instead through <c>call_logs</c>, which carries a real caller number.
    /// </remarks>
    public static readonly (string Type, string Target, string Label)[] LeadQueries =
    [
        ("email",    "listing", "Email"),
        ("email",    "agent",   "Email"),
        ("email",    "agency",  "Email"),
        ("whatsapp", "listing", "WhatsApp lead"),
        ("whatsapp", "agent",   "WhatsApp lead"),
    ];

    /// <summary>
    /// One (type, target) slice of leads created at or after <paramref name="since"/>.
    /// Returns the raw array elements; mapping is the caller's job.
    /// </summary>
    public Task<BayutPullSlice> GetLeadsAsync(
        string baseUrl, string apiKey, string type, string target, DateTime since, CancellationToken ct) =>
        GetAsync(baseUrl, apiKey,
            $"?timestamp={Uri.EscapeDataString(Timestamp(since))}&target={target}&type={type}&is_trulead=1", ct);

    /// <summary>
    /// Call logs. A different shape from the enquiry types — no target and no is_trulead, and the
    /// caller is identified by <c>caller_number</c> rather than an inquirer object.
    /// </summary>
    public Task<BayutPullSlice> GetCallLogsAsync(
        string baseUrl, string apiKey, DateTime since, CancellationToken ct) =>
        GetAsync(baseUrl, apiKey, $"?type=call_logs&timestamp={Uri.EscapeDataString(Timestamp(since))}", ct);

    /// <summary>TruBroker story leads — again no target/is_trulead.</summary>
    public Task<BayutPullSlice> GetStoryLeadsAsync(
        string baseUrl, string apiKey, DateTime since, CancellationToken ct) =>
        GetAsync(baseUrl, apiKey, $"?type=story_leads&timestamp={Uri.EscapeDataString(Timestamp(since))}", ct);

    /// <summary>The documented format. No timezone is carried, here or in the responses.</summary>
    internal static string Timestamp(DateTime utc) => utc.ToString("yyyy-MM-dd HH:mm:ss");

    private async Task<BayutPullSlice> GetAsync(
        string baseUrl, string apiKey, string query, CancellationToken ct)
    {
        var http = httpFactory.CreateClient(HttpClientName);
        using var req = new HttpRequestMessage(HttpMethod.Get, baseUrl + query);
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

        HttpResponseMessage res;
        try
        {
            res = await http.SendAsync(req, ct);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException && !ct.IsCancellationRequested)
        {
            // DNS, TLS, connection refused, timeout. Previously this escaped as-is and killed the
            // whole sweep with a bare "An error occurred while sending the request" — true, but
            // useless to whoever has to fix it. Named here so the integration's error says which
            // portal and what kind of failure.
            logger.LogWarning(ex, "Bayut pull {Query} could not reach the portal.", query);
            return BayutPullSlice.Failed($"Could not reach the portal: {Describe(ex)}");
        }

        using (res)
        {
            if (res.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden)
                throw new BayutPullAuthException(
                    $"The portal rejected the API key ({(int)res.StatusCode} {res.ReasonPhrase}). " +
                    "Re-enter the Pull API key on the integration — this cannot recover on its own.");

            if (!res.IsSuccessStatusCode)
            {
                // A bad slice must not cost the whole sweep: the other type/target combinations may be
                // fine, and a lead we skip today comes back tomorrow — `timestamp` is not a cursor.
                // It IS reported back, so a sweep where every slice failed is recorded as a failure
                // rather than as "nothing new".
                var detail = await SnippetAsync(res, ct);
                logger.LogWarning("Bayut pull {Query} returned {Status}. {Detail}", query, (int)res.StatusCode, detail);
                return BayutPullSlice.Failed($"HTTP {(int)res.StatusCode} {res.ReasonPhrase}{detail}");
            }

            var body = await res.Content.ReadAsStringAsync(ct);
            if (string.IsNullOrWhiteSpace(body)) return BayutPullSlice.Ok([]);

            try
            {
                var root = JsonDocument.Parse(body).RootElement.Clone();
                return BayutPullSlice.Ok(root.ValueKind switch
                {
                    JsonValueKind.Array  => [.. root.EnumerateArray().Select(e => e.Clone())],
                    JsonValueKind.Object => [root],
                    _ => [],
                });
            }
            catch (JsonException ex)
            {
                // Portals answer an expired key with an HTML login page rather than JSON, so this is
                // a real failure signal and not a parsing curiosity to be swallowed.
                logger.LogWarning(ex, "Bayut pull {Query} returned a non-JSON body.", query);
                return BayutPullSlice.Failed(
                    $"The portal returned a non-JSON response ({Trim(body)}) — this usually means the API key has expired.");
            }
        }
    }

    /// <summary>First line of an error body, bounded. Portals answer with anything from a JSON
    /// error object to a full HTML page, and an unbounded snippet would fill the 1000-character
    /// error column with markup.</summary>
    private static async Task<string> SnippetAsync(HttpResponseMessage res, CancellationToken ct)
    {
        try
        {
            var body = await res.Content.ReadAsStringAsync(ct);
            return string.IsNullOrWhiteSpace(body) ? string.Empty : $" — {Trim(body)}";
        }
        catch { return string.Empty; }
    }

    private static string Trim(string body)
    {
        var flat = body.ReplaceLineEndings(" ").Trim();
        return flat.Length > 200 ? flat[..200] + "…" : flat;
    }

    private static string Describe(Exception ex) =>
        ex is TaskCanceledException ? "the request timed out" : (ex.InnerException ?? ex).Message;
}
