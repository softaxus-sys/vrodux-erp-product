namespace Softaxis.Fitness.Domain.Entities;

/// <summary>
/// One row per workspace: whether members can use the online portal. Off until the gym turns it
/// on, because a deployment must never open member accounts to the internet by itself.
/// </summary>
public sealed class PortalSettings
{
    private PortalSettings() { }
    public PortalSettings(bool enabled) { Id = Guid.NewGuid(); Enabled = enabled; }

    public Guid      Id           { get; private set; }
    public bool      Enabled      { get; private set; }
    /// <summary>Members may book and cancel classes themselves. The usual class rules still apply.</summary>
    public bool      AllowBooking { get; private set; } = true;
    public DateTime  CreatedAt    { get; private set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt    { get; private set; }

    public void Update(bool enabled, bool allowBooking) { Enabled = enabled; AllowBooking = allowBooking; UpdatedAt = DateTime.UtcNow; }
}
