using Softaxis.BuildingBlocks.Domain.Primitives;

namespace Softaxis.Identity.Domain.Entities;

/// <summary>
/// Nightly cloud-mirror push configuration, held by an ON-PREMISES installation.
///
/// <para>
/// One row per installation. The box is the system of record; the cloud holds a read-only mirror
/// under the same tenant id, refreshed by a one-way push at a configured local time. See
/// <c>docs/on-premises-cloud-mirror.md</c>.
/// </para>
///
/// <para>
/// Deliberately separate from <c>Tenant.DeploymentType</c>: that enum answers "how is this
/// installation licensed and enforced" and stays <c>OnPremises</c> here. Whether the box also
/// mirrors to the cloud is a different question, and folding the two together would force every
/// licensing branch to reason about a third deployment kind.
/// </para>
///
/// <para>
/// No credentials live here. The push authenticates with the RSA-signed license key already on the
/// box, so there is no second secret to store or rotate.
/// </para>
/// </summary>
public sealed class TenantSyncSettings : AuditableEntity<Guid>
{
    private TenantSyncSettings() { }

    public TenantSyncSettings(Guid tenantId) : base(Guid.NewGuid())
    {
        TenantId  = tenantId;
        CreatedAt = DateTime.UtcNow;
    }

    public Guid   TenantId       { get; private set; }
    public bool   Enabled        { get; private set; }

    /// <summary>Base URL of the cloud installation to push to, e.g. <c>https://erp.vrodux.com</c>.</summary>
    public string CloudBaseUrl   { get; private set; } = string.Empty;

    /// <summary>Local wall-clock time to run, <c>HH:mm</c>.</summary>
    public string RunAtLocalTime { get; private set; } = "23:30";

    /// <summary>
    /// IANA/Windows time zone the schedule is expressed in. Stored, never assumed: "day end at
    /// 23:30" is a local instant, and a UTC schedule drifts against the trading day and lands
    /// mid-shift after a clock change. Same reasoning as <c>WorkSchedule.TimeZoneId</c>.
    /// </summary>
    public string TimeZoneId     { get; private set; } = "Asia/Dubai";

    // ── Operational state, written by the push service ────────────────────────

    public DateTime? LastAttemptAt       { get; private set; }
    public DateTime? LastSuccessAt       { get; private set; }
    public int       ConsecutiveFailures { get; private set; }
    public string?   LastError           { get; private set; }

    /// <summary>
    /// Set when the change-tracking watermark has aged past the database's retention window, so an
    /// incremental push can no longer say what changed and a full reseed is the only correct move.
    /// Continuing from an invalid version would leave the mirror quietly missing rows.
    /// </summary>
    public bool      ReseedRequired      { get; private set; }

    // ── Behaviour ─────────────────────────────────────────────────────────────

    public void Configure(bool enabled, string cloudBaseUrl, string runAtLocalTime, string timeZoneId)
    {
        Enabled        = enabled;
        CloudBaseUrl   = (cloudBaseUrl ?? string.Empty).Trim().TrimEnd('/');
        RunAtLocalTime = string.IsNullOrWhiteSpace(runAtLocalTime) ? "23:30" : runAtLocalTime.Trim();
        TimeZoneId     = string.IsNullOrWhiteSpace(timeZoneId) ? "UTC" : timeZoneId.Trim();
        UpdatedAt      = DateTime.UtcNow;
    }

    public void RecordAttempt()
    {
        LastAttemptAt = DateTime.UtcNow;
        UpdatedAt     = DateTime.UtcNow;
    }

    public void RecordSuccess()
    {
        LastSuccessAt       = DateTime.UtcNow;
        ConsecutiveFailures = 0;
        LastError           = null;
        UpdatedAt           = DateTime.UtcNow;
    }

    /// <summary>
    /// Records a failed run. The message is kept in full rather than summarised - the first question
    /// after a failure alert is always what actually went wrong.
    /// </summary>
    public void RecordFailure(string error)
    {
        ConsecutiveFailures++;
        LastError = error.Length > 2000 ? error[..2000] : error;
        UpdatedAt = DateTime.UtcNow;
    }

    public void FlagReseedRequired(bool required)
    {
        ReseedRequired = required;
        UpdatedAt      = DateTime.UtcNow;
    }
}
