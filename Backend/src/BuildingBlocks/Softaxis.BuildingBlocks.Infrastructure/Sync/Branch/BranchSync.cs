using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Softaxis.BuildingBlocks.Application.Sync;

namespace Softaxis.BuildingBlocks.Infrastructure.Sync.Branch;

/// <summary>
/// Configuration for a branch-server deployment (section <c>BranchSync</c>).
///
/// <para>
/// <b>Mode</b> is <c>Branch</c> on a server that sits in a branch, <c>Cloud</c> on the head-office
/// server that branches report to, and empty everywhere else - so nothing here has any effect on an
/// ordinary deployment.
/// </para>
/// </summary>
public sealed class BranchSyncOptions
{
    public const string Section = "BranchSync";

    public string Mode { get; set; } = string.Empty;

    public bool IsBranch => Mode.Equals("Branch", StringComparison.OrdinalIgnoreCase);
    public bool IsCloud  => Mode.Equals("Cloud",  StringComparison.OrdinalIgnoreCase);

    // ── Branch side ──
    public Guid   TenantId     { get; set; }
    public Guid   BranchId     { get; set; }
    public string CloudBaseUrl { get; set; } = string.Empty;
    /// <summary>The credential this branch holds. Revocable from the cloud by removing its entry.</summary>
    public string BranchKey    { get; set; } = string.Empty;
    /// <summary>Comma-separated modules the workspace subscribes to (from the connection code); decides which tables the branch database gets.</summary>
    public string Modules      { get; set; } = string.Empty;
    public int    IntervalSeconds { get; set; } = 5;
    public int    StartupDelaySeconds { get; set; } = 300;
    /// <summary>Longest wait between attempts while the cloud is unreachable (the interval doubles up to this).</summary>
    public int    MaxBackoffSeconds { get; set; } = 120;
    public int    HeartbeatSeconds  { get; set; } = 30;

    // ── Cloud side: health rules ──
    /// <summary>A branch whose clock differs from the cloud's by more than this may not upload (its order times would be wrong).</summary>
    public int    MaxClockDriftSeconds { get; set; } = 900;
    /// <summary>Head office is alerted when a branch has not been heard from for this long.</summary>
    public int    AlertAfterMinutes { get; set; } = 10;

    // ── Cloud side: the branches allowed to sync, and their keys ──
    public List<BranchCredential> Branches { get; set; } = [];
}

public sealed class BranchCredential
{
    public Guid   BranchId { get; set; }
    public Guid   TenantId { get; set; }
    public string Key      { get; set; } = string.Empty;
}

/// <summary>One page of cloud-owned rows for a branch.</summary>
public sealed record BranchPullResponse(
    string                Mode,        // "seed" or "changes"
    IReadOnlyList<SyncRowDto> Rows,
    long                  ServerVersion,
    long                  ToVersion,
    bool                  HasMore,
    IReadOnlyList<string>? LastKey);

/// <summary>What the branch last did, for the diagnostics endpoint and for support.</summary>
public sealed class BranchSyncStatus
{
    public DateTime? LastUpOkAt    { get; set; }
    public DateTime? LastDownOkAt  { get; set; }
    public string?   LastError     { get; set; }
    public int       UpRowsTotal   { get; set; }
    public int       DownRowsTotal { get; set; }
    public bool      CloudReachable { get; set; }
    public int       Passes        { get; set; }

    /// <summary>Passes in a row that failed. Drives the back-off and is reported to head office.</summary>
    public int       ConsecutiveFailures { get; set; }
    public DateTime? FailingSince  { get; set; }
    public int       UpRowsLastPass { get; set; }
    public DateTime? LastHeartbeatAt { get; set; }
}

/// <summary>What a branch tells head office about itself, once every <c>HeartbeatSeconds</c>.</summary>
public sealed record BranchHeartbeat(
    string    Version,
    DateTime  ClockUtc,
    DateTime? LastUpOkAt,
    DateTime? LastDownOkAt,
    string?   LastError,
    int       ConsecutiveFailures,
    DateTime? FailingSince,
    int       UpRowsTotal,
    int       DownRowsTotal,
    int       UpRowsLastPass);

/// <summary>The software version a server runs, compared between a branch and the cloud.</summary>
public static class BranchSyncVersion
{
    public static readonly string Current =
        (System.Reflection.Assembly.GetEntryAssembly() ?? typeof(BranchSyncVersion).Assembly)
            .GetCustomAttributes(typeof(System.Reflection.AssemblyInformationalVersionAttribute), false)
            .OfType<System.Reflection.AssemblyInformationalVersionAttribute>().FirstOrDefault()?.InformationalVersion
        ?? (System.Reflection.Assembly.GetEntryAssembly() ?? typeof(BranchSyncVersion).Assembly).GetName().Version?.ToString()
        ?? "unknown";
}

/// <summary>Talks to the cloud's <c>/api/sync/branch</c> endpoints. The branch always initiates.</summary>
public sealed class BranchSyncClient(HttpClient http, IOptions<BranchSyncOptions> options)
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    private BranchSyncOptions O => options.Value;

    private HttpRequestMessage Build(HttpMethod method, string path)
    {
        var req = new HttpRequestMessage(method, $"{O.CloudBaseUrl.TrimEnd('/')}/api/sync/branch/{path}");
        req.Headers.Add("X-Branch-Id", O.BranchId.ToString());
        req.Headers.Add("X-Branch-Key", O.BranchKey);
        // Every call carries the branch's clock and version, so the cloud can spot drift and mismatches.
        req.Headers.Add("X-Branch-Clock", DateTime.UtcNow.ToString("O"));
        req.Headers.Add("X-Branch-Version", BranchSyncVersion.Current);
        // Identifies this PC, so head office can refuse the same key on a second machine.
        req.Headers.Add("X-Branch-Machine", BranchMachineId.Current);
        return req;
    }

    public async Task<SyncPushResponse> PushAsync(SyncPushRequest body, CancellationToken ct)
    {
        using var req = Build(HttpMethod.Post, "push");
        req.Content = JsonContent.Create(body, options: Json);
        try
        {
            using var res = await http.SendAsync(req, ct);
            if (res.IsSuccessStatusCode)
                return await res.Content.ReadFromJsonAsync<SyncPushResponse>(Json, ct)
                       ?? throw new SyncTransportException("Empty response from the cloud.", true);

            var text = await SafeBody(res, ct);
            throw new SyncTransportException(
                $"The cloud refused the batch for {body.TableName}: {(int)res.StatusCode} {text}",
                retryable: res.StatusCode is not (HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden or HttpStatusCode.NotFound));
        }
        catch (HttpRequestException ex) { throw new SyncTransportException($"Cannot reach the cloud: {ex.Message}", true, ex); }
        catch (TaskCanceledException ex) when (!ct.IsCancellationRequested) { throw new SyncTransportException("The cloud did not answer in time.", true, ex); }
    }

    public async Task<BranchPullResponse> PullAsync(
        string table, long? since, string? afterKeyJson, int take, CancellationToken ct)
    {
        var q = $"pull?table={Uri.EscapeDataString(table)}&take={take}";
        if (since is not null) q += $"&since={since}";
        if (!string.IsNullOrEmpty(afterKeyJson)) q += $"&afterKey={Uri.EscapeDataString(afterKeyJson)}";

        using var req = Build(HttpMethod.Get, q);
        try
        {
            using var res = await http.SendAsync(req, ct);
            if (res.IsSuccessStatusCode)
                return await res.Content.ReadFromJsonAsync<BranchPullResponse>(Json, ct)
                       ?? throw new SyncTransportException("Empty response from the cloud.", true);

            throw new SyncTransportException(
                $"The cloud refused the pull for {table}: {(int)res.StatusCode} {await SafeBody(res, ct)}",
                retryable: res.StatusCode is not (HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden or HttpStatusCode.NotFound));
        }
        catch (HttpRequestException ex) { throw new SyncTransportException($"Cannot reach the cloud: {ex.Message}", true, ex); }
        catch (TaskCanceledException ex) when (!ct.IsCancellationRequested) { throw new SyncTransportException("The cloud did not answer in time.", true, ex); }
    }

    /// <summary>Reports this branch's health. Best effort: a failed heartbeat never fails the pass.</summary>
    public async Task<bool> HeartbeatAsync(BranchHeartbeat body, CancellationToken ct)
    {
        using var req = Build(HttpMethod.Post, "heartbeat");
        req.Content = JsonContent.Create(body, options: Json);
        try
        {
            using var res = await http.SendAsync(req, ct);
            return res.IsSuccessStatusCode;
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException && !ct.IsCancellationRequested)
        {
            return false;
        }
    }

    private static async Task<string> SafeBody(HttpResponseMessage res, CancellationToken ct)
    {
        try { var b = await res.Content.ReadAsStringAsync(ct); return b.Length > 300 ? b[..300] : b; }
        catch { return string.Empty; }
    }
}
