namespace Softaxis.Library.Domain.Entities;

/// <summary>
/// One row per workspace: whether members can use the online portal, and what they may do there.
/// Off until the library turns it on — a deployment must never open a library's catalogue and
/// member accounts to the internet by itself.
/// </summary>
public sealed class PortalSettings
{
    private PortalSettings() { }

    public PortalSettings(bool enabled) { Id = Guid.NewGuid(); Enabled = enabled; }

    public Guid      Id                { get; private set; }
    public bool      Enabled           { get; private set; }
    /// <summary>Members may renew their own loans online. The usual renewal rules still apply.</summary>
    public bool      AllowRenewals     { get; private set; } = true;
    /// <summary>Members may reserve titles online.</summary>
    public bool      AllowReservations { get; private set; } = true;
    /// <summary>Anyone with the link may search the catalogue without signing in.</summary>
    public bool      PublicCatalogue   { get; private set; }
    public DateTime  CreatedAt         { get; private set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt         { get; private set; }

    public void Update(bool enabled, bool allowRenewals, bool allowReservations, bool publicCatalogue)
    {
        Enabled           = enabled;
        AllowRenewals     = allowRenewals;
        AllowReservations = allowReservations;
        PublicCatalogue   = publicCatalogue;
        UpdatedAt         = DateTime.UtcNow;
    }
}
