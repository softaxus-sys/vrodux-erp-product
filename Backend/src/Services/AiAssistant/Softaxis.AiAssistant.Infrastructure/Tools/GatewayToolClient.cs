using System.Net.Http.Headers;
using Softaxis.AiAssistant.Application.Abstractions;

namespace Softaxis.AiAssistant.Infrastructure.Tools;

/// <summary>
/// Calls the ERP's own API as the current user. Tools use this instead of touching databases
/// directly: the request carries the caller's bearer token and hits the same controllers the
/// web UI uses, so tenant isolation, module licensing, and per-permission RBAC are all enforced
/// by the existing pipeline — a tool can never read another tenant's data or exceed the user's rights.
/// </summary>
public sealed class GatewayToolClient(IHttpClientFactory httpClientFactory, ICurrentUser currentUser)
{
    private const int MaxResultChars = 12000; // cap tool output to control token cost

    public Task<string> GetAsync(string relativePath, CancellationToken ct) =>
        SendAsync(HttpMethod.Get, relativePath, null, ct);

    public Task<string> PostAsync(string relativePath, string jsonBody, CancellationToken ct) =>
        SendAsync(HttpMethod.Post, relativePath, jsonBody, ct);

    public Task<string> PatchAsync(string relativePath, string jsonBody, CancellationToken ct) =>
        SendAsync(HttpMethod.Patch, relativePath, jsonBody, ct);

    private async Task<string> SendAsync(HttpMethod method, string relativePath, string? jsonBody, CancellationToken ct)
    {
        var baseUrl = currentUser.RequestBaseUrl;
        if (string.IsNullOrEmpty(baseUrl))
            return "{\"error\":\"Internal API base URL unavailable.\"}";

        using var http = httpClientFactory.CreateClient("ai");
        using var request = new HttpRequestMessage(method, $"{baseUrl.TrimEnd('/')}/{relativePath.TrimStart('/')}");
        if (!string.IsNullOrEmpty(currentUser.BearerToken))
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", currentUser.BearerToken);
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        if (jsonBody is not null)
            request.Content = new StringContent(jsonBody, System.Text.Encoding.UTF8, "application/json");

        using var response = await http.SendAsync(request, ct);
        var body = await response.Content.ReadAsStringAsync(ct);

        if (!response.IsSuccessStatusCode)
            return $"{{\"error\":\"HTTP {(int)response.StatusCode}\",\"detail\":{System.Text.Json.JsonSerializer.Serialize(Truncate(body))}}}";

        return string.IsNullOrWhiteSpace(body) ? "{\"ok\":true}" : Truncate(body);
    }

    private static string Truncate(string s) =>
        s.Length > MaxResultChars ? s[..MaxResultChars] + "\n…(truncated)" : s;
}
