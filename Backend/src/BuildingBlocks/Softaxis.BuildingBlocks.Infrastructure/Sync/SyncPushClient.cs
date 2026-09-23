using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Application.Sync;

namespace Softaxis.BuildingBlocks.Infrastructure.Sync;

/// <summary>Raised when a batch could not be delivered. Carries whether retrying is worth it.</summary>
public sealed class SyncTransportException(string message, bool retryable, Exception? inner = null)
    : Exception(message, inner)
{
    /// <summary>
    /// False for a refusal that will repeat until a human acts - a rejected licence, a workspace
    /// that is not a mirror. Retrying those just burns the window and fills the log.
    /// </summary>
    public bool Retryable { get; } = retryable;
}

/// <summary>
/// Posts batches to the cloud mirror's <c>/api/sync/push</c>.
///
/// <para>
/// <b>No request compression.</b> The design doc suggested gzip, but ASP.NET Core does not
/// decompress request bodies by default and the receiver has no decompression middleware, so a
/// gzipped body would arrive as unreadable bytes. Adding it needs a change on both sides; until
/// then the batch size (500 rows) is what keeps a request sane.
/// </para>
/// </summary>
public sealed class SyncPushClient(HttpClient http, ILogger<SyncPushClient> logger)
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    /// <summary>
    /// Sends one batch. On a timeout it asks the receiver whether the batch landed rather than
    /// guessing - a lost response and a lost request are indistinguishable to the sender, and
    /// guessing either way is how a batch gets skipped or applied twice.
    /// </summary>
    public async Task<SyncPushResponse> PushAsync(
        string baseUrl, SyncPushRequest request, CancellationToken ct = default)
    {
        var url = $"{baseUrl.TrimEnd('/')}/api/sync/push";

        try
        {
            using var response = await http.PostAsJsonAsync(url, request, Json, ct);
            return await ReadResponseAsync(response, request, ct);
        }
        catch (TaskCanceledException) when (!ct.IsCancellationRequested)
        {
            logger.LogWarning(
                "Sync: batch {BatchId} for {Table} timed out; asking the mirror whether it landed.",
                request.BatchId, request.TableName);

            if (await WasAppliedAsync(baseUrl, request, ct))
                return new SyncPushResponse(request.BatchId, request.Rows.Count, 0, 0, true, []);

            throw new SyncTransportException(
                $"The mirror did not answer in time and has not recorded batch {request.BatchId}.", retryable: true);
        }
        catch (HttpRequestException ex)
        {
            throw new SyncTransportException(
                $"Could not reach the cloud mirror at {baseUrl}: {ex.Message}", retryable: true, ex);
        }
    }

    private async Task<SyncPushResponse> ReadResponseAsync(
        HttpResponseMessage response, SyncPushRequest request, CancellationToken ct)
    {
        if (response.IsSuccessStatusCode)
        {
            var result = await response.Content.ReadFromJsonAsync<SyncPushResponse>(Json, ct);
            return result ?? throw new SyncTransportException(
                "The mirror returned an empty response.", retryable: true);
        }

        var body = await SafeBodyAsync(response, ct);

        // A refusal that repeats until someone acts: the licence, or the target not being a mirror.
        // Retrying these is pointless and hides the real message behind a wall of attempts.
        var permanent = response.StatusCode is HttpStatusCode.Unauthorized
                                            or HttpStatusCode.Forbidden
                                            or HttpStatusCode.Conflict
                                            or HttpStatusCode.NotFound;

        throw new SyncTransportException(
            $"The mirror refused batch {request.BatchId} for {request.TableName}: " +
            $"{(int)response.StatusCode} {response.ReasonPhrase}. {body}",
            retryable: !permanent);
    }

    /// <summary>
    /// Asks whether a batch already landed. Any failure here answers "no", because re-sending an
    /// idempotent batch is safe while skipping an unsent one loses data permanently.
    /// </summary>
    private async Task<bool> WasAppliedAsync(string baseUrl, SyncPushRequest request, CancellationToken ct)
    {
        try
        {
            var url = $"{baseUrl.TrimEnd('/')}/api/sync/batches/{request.BatchId}" +
                      $"?tenantId={request.TenantId}&licenseKey={Uri.EscapeDataString(request.LicenseKey)}";

            using var response = await http.GetAsync(url, ct);
            if (!response.IsSuccessStatusCode) return false;

            using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct));
            return doc.RootElement.TryGetProperty("applied", out var applied) &&
                   applied.ValueKind == JsonValueKind.True;
        }
        catch
        {
            return false;
        }
    }

    private static async Task<string> SafeBodyAsync(HttpResponseMessage response, CancellationToken ct)
    {
        try
        {
            var body = await response.Content.ReadAsStringAsync(ct);
            return body.Length > 300 ? body[..300] : body;
        }
        catch { return string.Empty; }
    }
}
