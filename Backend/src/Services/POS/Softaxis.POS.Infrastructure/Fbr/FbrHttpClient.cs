using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Softaxis.POS.Application.Fbr;

namespace Softaxis.POS.Infrastructure.Fbr;

/// <summary>
/// Posts invoices to FBR's IMS "PostData" API.
///
/// Endpoints are configurable (appsettings "Fbr:SandboxUrl" / "Fbr:ProductionUrl") because FBR has
/// moved them before; the defaults are the commonly documented ones.
/// ⚠ Confirm both URLs and the response format with FBR/PRAL before going live.
/// </summary>
public sealed class FbrHttpClient(IHttpClientFactory httpFactory, IConfiguration config) : IFbrClient
{
    public const string HttpClientName = "fbr";

    private const string DefaultSandboxUrl    = "https://esp.fbr.gov.pk:8244/FBR/v1/api/Live/PostData";
    private const string DefaultProductionUrl = "https://gw.fbr.gov.pk/imsp/v1/api/Live/PostData";

    /// <summary>FBR's success code in the response body.</summary>
    private const string SuccessCode = "100";

    public async Task<FbrSubmitResult> SubmitAsync(FbrInvoice invoice, string environment, string token, CancellationToken ct)
    {
        var url = environment == "production"
            ? config["Fbr:ProductionUrl"] ?? DefaultProductionUrl
            : config["Fbr:SandboxUrl"]    ?? DefaultSandboxUrl;

        var http = httpFactory.CreateClient(HttpClientName);
        using var req = new HttpRequestMessage(HttpMethod.Post, url)
        {
            // FBR's API is PascalCase - keep property names exactly as declared.
            Content = JsonContent.Create(invoice, options: new JsonSerializerOptions { PropertyNamingPolicy = null }),
        };
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        HttpResponseMessage res;
        try
        {
            res = await http.SendAsync(req, ct);
        }
        catch (TaskCanceledException) when (!ct.IsCancellationRequested)
        {
            return FbrSubmitResult.Retry("FBR did not respond in time.");
        }
        catch (HttpRequestException ex)
        {
            return FbrSubmitResult.Retry($"Cannot reach FBR: {ex.Message}");
        }

        var body = await res.Content.ReadAsStringAsync(ct);

        if (res.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden)
            // Retried, not dropped: once the token is fixed in Settings the queue goes through.
            return FbrSubmitResult.Retry($"FBR rejected the token ({(int)res.StatusCode}). Check the POS ID and token in Settings > FBR Integration.");

        if ((int)res.StatusCode >= 500 || res.StatusCode == HttpStatusCode.TooManyRequests)
            return FbrSubmitResult.Retry($"FBR server error {(int)res.StatusCode}.");

        // FBR answers { "InvoiceNumber": "...", "Code": "100", "Response": "...", "Errors": ... }
        string? number = null, code = null, message = null, errors = null;
        try
        {
            using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(body) ? "{}" : body);
            var root = doc.RootElement;
            number  = Get(root, "InvoiceNumber");
            code    = Get(root, "Code");
            message = Get(root, "Response");
            errors  = root.TryGetProperty("Errors", out var e) && e.ValueKind != JsonValueKind.Null ? e.ToString() : null;
        }
        catch (JsonException)
        {
            return FbrSubmitResult.Retry($"Unexpected FBR response ({(int)res.StatusCode}): {Trim(body)}");
        }

        if (res.IsSuccessStatusCode && code == SuccessCode && !string.IsNullOrWhiteSpace(number))
            return FbrSubmitResult.Ok(number!);

        // FBR looked at the invoice and refused it - resending the same data won't help.
        var reason = string.Join(" ", new[] { message, errors }.Where(x => !string.IsNullOrWhiteSpace(x)));
        return FbrSubmitResult.Rejected($"FBR rejected the invoice (code {code ?? ((int)res.StatusCode).ToString()}): {Trim(reason)}");
    }

    private static string? Get(JsonElement root, string name) =>
        root.TryGetProperty(name, out var v) ? (v.ValueKind == JsonValueKind.String ? v.GetString() : v.ToString()) : null;

    private static string Trim(string? s) => string.IsNullOrEmpty(s) ? "" : (s.Length > 400 ? s[..400] : s);
}
