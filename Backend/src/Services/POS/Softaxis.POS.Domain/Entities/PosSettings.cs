using Softaxis.BuildingBlocks.Domain.Primitives;

namespace Softaxis.POS.Domain.Entities;

/// <summary>
/// Per-tenant POS behaviour switches. One row per tenant, created on first read.
/// </summary>
public sealed class PosSettings : AuditableEntity<Guid>
{
    /// <summary>
    /// When on, tills record sales, refunds, voids, cash movements and shifts locally and upload
    /// them only when the cashier presses "Sync to Cloud". Off by default: a tenant has to opt in,
    /// because offline sales bypass live stock checks and reach the books only at day end.
    /// </summary>
    public bool OfflineModeEnabled { get; private set; }

    private PosSettings() { }

    public static PosSettings CreateDefault() => new() { Id = Guid.NewGuid() };

    public void SetOfflineMode(bool enabled) => OfflineModeEnabled = enabled;
}
