using Softaxis.BuildingBlocks.Domain.Primitives;

namespace Softaxis.POS.Domain.Entities;

/// <summary>
/// Last reported state of one offline-capable till (a browser or desktop install), keyed by a
/// device id the till generates once. The server cannot see what a till holds locally, so this is
/// how it knows whether switching the tenant between online and offline would strand unsynced work.
/// </summary>
public sealed class PosTillStatus : AuditableEntity<Guid>
{
    public string   DeviceId        { get; private set; } = default!;
    public string?  RegisterId      { get; private set; }
    public Guid     UserId          { get; private set; }
    public string?  UserName        { get; private set; }
    public int      PendingRecords  { get; private set; }
    public int      UnsyncedShifts  { get; private set; }
    public DateTime ReportedAt      { get; private set; }

    public bool HasUnsyncedWork => PendingRecords > 0 || UnsyncedShifts > 0;

    private PosTillStatus() { }

    public static PosTillStatus Create(string deviceId) => new()
    {
        Id       = Guid.NewGuid(),
        DeviceId = deviceId.Trim(),
    };

    public void Report(string? registerId, Guid userId, string? userName, int pendingRecords, int unsyncedShifts)
    {
        RegisterId     = string.IsNullOrWhiteSpace(registerId) ? RegisterId : registerId.Trim();
        UserId         = userId;
        UserName       = userName;
        PendingRecords = Math.Max(0, pendingRecords);
        UnsyncedShifts = Math.Max(0, unsyncedShifts);
        ReportedAt     = DateTime.UtcNow;
    }

    /// <summary>An administrator forced offline mode off; this till's backlog is written off from the server's view.</summary>
    public void Clear() { PendingRecords = 0; UnsyncedShifts = 0; }
}
