namespace Softaxis.Restaurant.Domain.Entities;

/// <summary>
/// A trust-anchor record for a POS terminal/tablet — a device announces itself once (register) and
/// pings periodically (heartbeat) while in use. This is purely observability/inventory (which devices
/// have accessed this tenant's POS, when, from which branch) — it does not gate access to anything.
/// It's the deliberate first slice of the design doc's "Device Registration / Offline Sync" item:
/// the trust anchor a future offline-sync trust model would build on, without committing to that
/// model here (see docs/restaurant-pos-enterprise-redesign.md §1.14/Phase 5).
///
/// DeviceFingerprint is a client-generated persistent UUID (localStorage), not a hardware fingerprint
/// — good enough to recognize "this browser instance" across sessions, not intended as a strong
/// anti-spoofing identity. No DB-level unique constraint on DeviceFingerprint alone (same tenant-
/// scoping pitfall as NotificationProviderConfig.Channel) — uniqueness per (tenant, fingerprint) is
/// enforced at the application level (see RegisterDeviceHandler's upsert-by-fingerprint).
/// </summary>
public sealed class DeviceRegistration
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public Guid? BranchId { get; private set; }
    public string DeviceFingerprint { get; private set; } = null!;
    public string DeviceName { get; private set; } = null!;
    public Guid RegisteredByUserId { get; private set; }
    public DateTime LastSeenAt { get; private set; } = DateTime.UtcNow;
    public bool IsActive { get; private set; } = true;
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;

    public DeviceRegistration(Guid? branchId, string deviceFingerprint, string deviceName, Guid registeredByUserId)
    {
        BranchId = branchId;
        DeviceFingerprint = deviceFingerprint;
        DeviceName = deviceName;
        RegisteredByUserId = registeredByUserId;
    }

    public void Heartbeat() => LastSeenAt = DateTime.UtcNow;
    public void Rename(string name) => DeviceName = name;
    public void SetActive(bool active) => IsActive = active;
    public void SetBranch(Guid? branchId) => BranchId = branchId;
}
