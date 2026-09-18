namespace Softaxis.Identity.Domain.Entities;

/// <summary>
/// One mobile device registered for push notifications, keyed by its Expo push token rather than
/// a device id — that token is already the unique, stable handle Expo hands the app, and re-issuing
/// it (reinstall, new device) naturally supersedes the old row via <see cref="ReRegister"/>.
///
/// <para>Deliberately structured like <see cref="RefreshToken"/>: a plain per-user row, no TenantId
/// column (scoped via <c>UserId</c>, same as refresh tokens) — a push token identifies a device, not
/// a tenant, and a user can only ever belong to one tenant anyway.</para>
///
/// <para>A shared device (or a user signing into a different account on the same phone) re-registers
/// the same Expo token under the new <c>UserId</c> — the unique index on the token forces this to be
/// an update, not a duplicate row, so a stale login can never keep receiving another user's pushes.</para>
/// </summary>
public sealed class UserDeviceToken
{
    private UserDeviceToken() { }

    public UserDeviceToken(Guid userId, string expoPushToken, string platform, string? deviceName)
    {
        Id             = Guid.NewGuid();
        UserId         = userId;
        ExpoPushToken  = expoPushToken;
        Platform       = platform;
        DeviceName     = deviceName;
        RegisteredAt   = DateTime.UtcNow;
        LastSeenAt     = DateTime.UtcNow;
    }

    public Guid     Id            { get; private set; }
    public Guid     UserId        { get; private set; }
    public string   ExpoPushToken { get; private set; } = string.Empty;
    /// <summary>"ios" | "android".</summary>
    public string   Platform      { get; private set; } = string.Empty;
    public string?  DeviceName    { get; private set; }
    public DateTime RegisteredAt  { get; private set; }
    public DateTime LastSeenAt    { get; private set; }

    // Navigation
    public User User { get; private set; } = null!;

    /// <summary>Re-registering an already-known token just bumps ownership + freshness — never a
    /// second row for the same physical device.</summary>
    public void ReRegister(Guid userId, string platform, string? deviceName)
    {
        UserId     = userId;
        Platform   = platform;
        DeviceName = deviceName;
        LastSeenAt = DateTime.UtcNow;
    }
}
