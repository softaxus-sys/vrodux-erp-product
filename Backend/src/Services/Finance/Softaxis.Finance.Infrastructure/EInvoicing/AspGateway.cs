using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Softaxis.Finance.Application.EInvoicing;
using EInvoiceStatus = Softaxis.Finance.Domain.Entities.EInvoiceStatus;

namespace Softaxis.Finance.Infrastructure.EInvoicing;

/// <summary>
/// Connection to the workspace's Accredited Service Provider, bound from the <c>EInvoicing</c>
/// configuration section. <b>Nothing here is a real provider's address</b>: no ASP has been chosen,
/// and every provider publishes its own token and submission URLs. They are supplied at deploy time.
///
/// Secrets come from environment variables, never from a committed file:
/// <c>EInvoicing__ClientId</c>, <c>EInvoicing__ClientSecret</c>, <c>EInvoicing__TokenUrl</c>,
/// <c>EInvoicing__SubmitUrl</c>, optionally <c>EInvoicing__Scope</c> / <c>EInvoicing__Audience</c>.
/// </summary>
public sealed class EInvoicingOptions
{
    public const string Section = "EInvoicing";

    /// <summary>Master switch. Off by default so a deploy can never start sending invoices on its own.</summary>
    public bool    Enabled       { get; set; }
    public string  ProviderName  { get; set; } = "ASP";
    /// <summary>"sandbox" or "production" — recorded on every submission.</summary>
    public string  Environment   { get; set; } = "sandbox";
    /// <summary>OAuth2 token endpoint (client-credentials grant).</summary>
    public string? TokenUrl      { get; set; }
    /// <summary>Endpoint the PINT AE XML is POSTed to.</summary>
    public string? SubmitUrl     { get; set; }
    public string? ClientId      { get; set; }
    public string? ClientSecret  { get; set; }
    public string? Scope         { get; set; }
    public string? Audience      { get; set; }
    /// <summary>Content type the ASP expects for the document body.</summary>
    public string  ContentType   { get; set; } = "application/xml";
    public int     TimeoutSeconds { get; set; } = 30;
    /// <summary>Plain http is refused unless this is set — for a local ASP mock only.</summary>
    public bool    AllowInsecureHttp { get; set; }

    public bool IsComplete =>
        Enabled
        && !string.IsNullOrWhiteSpace(TokenUrl) && !string.IsNullOrWhiteSpace(SubmitUrl)
        && !string.IsNullOrWhiteSpace(ClientId) && !string.IsNullOrWhiteSpace(ClientSecret);
}

/// <summary>
/// Sends a PINT AE invoice to an ASP over HTTPS with an OAuth2 client-credentials bearer token.
///
/// <list type="bullet">
/// <item>The token is fetched once and reused until shortly before it expires; a 401 on submit
///       drops it and retries exactly once with a fresh one (a rotated or revoked token).</item>
/// <item>Every request carries an <c>Idempotency-Key</c> equal to the submission id, so a retry
///       after a timeout can be recognised by the ASP as the same document rather than a new one.</item>
/// <item>The outcome is classified honestly: 2xx = accepted by the ASP; 4xx = rejected (fix the
///       data); 5xx, timeout or transport error = failed (nothing is known to have arrived — retry).</item>
/// <item>Credentials are never logged and never returned to the caller.</item>
/// </list>
/// </summary>
public sealed class OAuthAspGateway(
    IHttpClientFactory httpFactory,
    IOptionsMonitor<EInvoicingOptions> options,
    ILogger<OAuthAspGateway> log) : IEInvoiceGateway
{
    public const string HttpClientName = "einvoicing-asp";

    private static readonly SemaphoreSlim TokenLock = new(1, 1);
    private static string?  _token;
    private static DateTime _tokenExpiresUtc;
    private static string?  _tokenFor;   // the client id + token url the cached token belongs to

    private EInvoicingOptions O => options.CurrentValue;

    public bool   IsConfigured => O.IsComplete;
    public string ProviderName => O.ProviderName;
    public string Environment  => O.Environment;

    public async Task<EInvoiceSendResult> SendAsync(string invoiceNumber, string xml, string idempotencyKey, CancellationToken ct)
    {
        var o = O;
        if (!o.IsComplete)
            return new(EInvoiceStatus.NotConfigured, null, null,
                "No Accredited Service Provider is configured, so nothing was sent.");

        if (!IsAllowedUrl(o.TokenUrl!, o) || !IsAllowedUrl(o.SubmitUrl!, o))
            return new(EInvoiceStatus.NotConfigured, null, null,
                "The ASP addresses must use https. Correct EInvoicing:TokenUrl / SubmitUrl.");

        try
        {
            var (status, body, retryable) = await PostAsync(o, xml, idempotencyKey, forceNewToken: false, ct);
            if (status == HttpStatusCode.Unauthorized)
                (status, body, retryable) = await PostAsync(o, xml, idempotencyKey, forceNewToken: true, ct);

            var code = (int)status;
            var snippet = Snippet(body);
            if (code is >= 200 and < 300)
                return new(EInvoiceStatus.Accepted, code, ExtractId(body), snippet);

            log.LogWarning("ASP {Provider} answered {Status} for invoice {Invoice}", o.ProviderName, code, invoiceNumber);
            return new(retryable ? EInvoiceStatus.Failed : EInvoiceStatus.Rejected, code, ExtractId(body),
                $"The ASP answered {code} {status}. {snippet}".Trim());
        }
        catch (TokenException ex)
        {
            return new(EInvoiceStatus.Failed, ex.Status, null, ex.Message);
        }
        catch (TaskCanceledException) when (!ct.IsCancellationRequested)
        {
            return new(EInvoiceStatus.Failed, null, null,
                $"The ASP did not answer within {o.TimeoutSeconds} seconds. It is not known whether the invoice arrived; sending again uses the same idempotency key.");
        }
        catch (HttpRequestException ex)
        {
            return new(EInvoiceStatus.Failed, null, null, $"Could not reach the ASP: {ex.Message}");
        }
    }

    private async Task<(HttpStatusCode Status, string Body, bool Retryable)> PostAsync(
        EInvoicingOptions o, string xml, string key, bool forceNewToken, CancellationToken ct)
    {
        var token = await GetTokenAsync(o, forceNewToken, ct);
        using var http = Client(o);
        using var req = new HttpRequestMessage(HttpMethod.Post, o.SubmitUrl)
        {
            Content = new StringContent(xml, new UTF8Encoding(false), o.ContentType),
        };
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        req.Headers.TryAddWithoutValidation("Idempotency-Key", key);
        req.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        using var res = await http.SendAsync(req, ct);
        var body = await res.Content.ReadAsStringAsync(ct);
        var code = (int)res.StatusCode;
        var retryable = code >= 500 || code is 408 or 429;
        return (res.StatusCode, body, retryable);
    }

    private async Task<string> GetTokenAsync(EInvoicingOptions o, bool force, CancellationToken ct)
    {
        var owner = $"{o.ClientId}|{o.TokenUrl}";
        if (!force && _token is not null && _tokenFor == owner && DateTime.UtcNow < _tokenExpiresUtc)
            return _token;

        await TokenLock.WaitAsync(ct);
        try
        {
            if (!force && _token is not null && _tokenFor == owner && DateTime.UtcNow < _tokenExpiresUtc)
                return _token;

            var form = new List<KeyValuePair<string, string>> { new("grant_type", "client_credentials") };
            if (!string.IsNullOrWhiteSpace(o.Scope))    form.Add(new("scope", o.Scope!));
            if (!string.IsNullOrWhiteSpace(o.Audience)) form.Add(new("audience", o.Audience!));

            using var http = Client(o);
            using var req = new HttpRequestMessage(HttpMethod.Post, o.TokenUrl) { Content = new FormUrlEncodedContent(form) };
            // RFC 6749 §2.3.1: client credentials via HTTP Basic.
            req.Headers.Authorization = new AuthenticationHeaderValue("Basic",
                Convert.ToBase64String(Encoding.UTF8.GetBytes(
                    $"{Uri.EscapeDataString(o.ClientId!)}:{Uri.EscapeDataString(o.ClientSecret!)}")));

            using var res = await http.SendAsync(req, ct);
            var body = await res.Content.ReadAsStringAsync(ct);
            if (!res.IsSuccessStatusCode)
                throw new TokenException((int)res.StatusCode,
                    $"The ASP refused the sign-in ({(int)res.StatusCode}). Check EInvoicing:ClientId / ClientSecret / Scope.");

            using var json = JsonDocument.Parse(body);
            var token = json.RootElement.TryGetProperty("access_token", out var t) ? t.GetString() : null;
            if (string.IsNullOrWhiteSpace(token))
                throw new TokenException((int)res.StatusCode, "The ASP's token response contained no access_token.");
            var expiresIn = json.RootElement.TryGetProperty("expires_in", out var e) && e.TryGetInt32(out var s) ? s : 300;

            _token = token;
            _tokenFor = owner;
            // Refresh a minute early so a token never expires between the check and the request.
            _tokenExpiresUtc = DateTime.UtcNow.AddSeconds(Math.Max(30, expiresIn - 60));
            return token;
        }
        catch (JsonException)
        {
            throw new TokenException(null, "The ASP's token response was not valid JSON.");
        }
        finally
        {
            TokenLock.Release();
        }
    }

    private HttpClient Client(EInvoicingOptions o)
    {
        var c = httpFactory.CreateClient(HttpClientName);
        c.Timeout = TimeSpan.FromSeconds(Math.Clamp(o.TimeoutSeconds, 5, 120));
        return c;
    }

    private static bool IsAllowedUrl(string url, EInvoicingOptions o) =>
        Uri.TryCreate(url, UriKind.Absolute, out var u)
        && (u.Scheme == Uri.UriSchemeHttps || (o.AllowInsecureHttp && u.Scheme == Uri.UriSchemeHttp));

    /// <summary>ASPs name their document id differently; take the first common key present.</summary>
    internal static string? ExtractId(string body)
    {
        if (string.IsNullOrWhiteSpace(body)) return null;
        try
        {
            using var json = JsonDocument.Parse(body);
            if (json.RootElement.ValueKind != JsonValueKind.Object) return null;
            foreach (var key in new[] { "id", "messageId", "documentId", "submissionId", "uuid", "transactionId" })
                if (json.RootElement.TryGetProperty(key, out var v) && v.ValueKind is JsonValueKind.String or JsonValueKind.Number)
                    return v.ToString();
        }
        catch (JsonException) { /* not JSON — the snippet still carries it */ }
        return null;
    }

    private static string Snippet(string body) =>
        string.IsNullOrWhiteSpace(body) ? string.Empty : (body.Length > 500 ? body[..500] + "…" : body).Trim();

    private sealed class TokenException(int? status, string message) : Exception(message)
    {
        public int? Status { get; } = status;
    }
}
