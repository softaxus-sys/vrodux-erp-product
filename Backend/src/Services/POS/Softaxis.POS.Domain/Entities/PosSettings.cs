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

    /// <summary>
    /// When on, the till sells a tracked item even when its recorded stock is zero or below, and
    /// stock simply goes negative. For shops that don't keep stock counts in the system - without
    /// this they couldn't ring up anything they never received through a stock entry. Off by
    /// default: refusing to oversell is the right behaviour for anyone who does keep stock.
    /// </summary>
    public bool AllowOutOfStockSales { get; private set; }

    // ── Receipt printer ──────────────────────────────────────────────────────
    // Chosen from Settings -> Receipt Printer. All null = never configured here, so the server's
    // appsettings.json PrinterSettings (and auto-detection) still apply - an existing install keeps
    // printing exactly as before until someone saves a choice.

    /// <summary>"windows" (USB/installed on the server PC) or "network" (TCP 9100).</summary>
    public string? PrinterMode { get; private set; }
    /// <summary>Windows printer name, exactly as in Windows "Printers &amp; scanners".</summary>
    public string? PrinterName { get; private set; }
    public string? PrinterIp   { get; private set; }
    public int?    PrinterPort { get; private set; }

    private PosSettings() { }

    public static PosSettings CreateDefault() => new() { Id = Guid.NewGuid() };

    public void SetOfflineMode(bool enabled) => OfflineModeEnabled = enabled;

    public void SetAllowOutOfStockSales(bool allowed) => AllowOutOfStockSales = allowed;

    public void SetPrinter(string mode, string? name, string? ip, int? port)
    {
        PrinterMode = mode;
        PrinterName = string.IsNullOrWhiteSpace(name) ? null : name.Trim();
        PrinterIp   = string.IsNullOrWhiteSpace(ip)   ? null : ip.Trim();
        PrinterPort = port;
    }
}
