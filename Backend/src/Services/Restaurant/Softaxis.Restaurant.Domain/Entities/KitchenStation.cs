namespace Softaxis.Restaurant.Domain.Entities;

/// <summary>A physical printer (receipt at the register, or a kitchen ticket printer at a station).</summary>
public sealed class PrinterProfile
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public Guid? BranchId { get; private set; }
    public string Name { get; private set; } = null!;
    public string Type { get; private set; } = "kitchen"; // receipt/kitchen
    public string ConnectionType { get; private set; } = "network"; // network/usb/bluetooth
    public string? IpAddress { get; private set; }
    public int? Port { get; private set; }
    public bool IsDefault { get; private set; }
    public bool IsDeleted { get; private set; }
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; private set; } = DateTime.UtcNow;

    public PrinterProfile(string name, string type, string connectionType, string? ipAddress, int? port,
        bool isDefault, Guid? branchId = null)
    {
        Name = name; Type = type; ConnectionType = connectionType; IpAddress = ipAddress; Port = port;
        IsDefault = isDefault; BranchId = branchId;
    }

    public void Update(string name, string type, string connectionType, string? ipAddress, int? port, bool isDefault)
    {
        Name = name; Type = type; ConnectionType = connectionType; IpAddress = ipAddress; Port = port;
        IsDefault = isDefault; UpdatedAt = DateTime.UtcNow;
    }

    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}

/// <summary>A kitchen prep station (e.g. "Grill"/"Bar"/"Dessert") that KDS tickets route to, based on
/// the MenuItem/MenuCategory assigned to it. Folds in the KDS's per-station display settings.</summary>
public sealed class KitchenStation
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public Guid? BranchId { get; private set; }
    public string Name { get; private set; } = null!;
    public string? DisplayName { get; private set; }
    public string? ColorTag { get; private set; } // hex, e.g. "#f97316"
    public int SortOrder { get; private set; }
    public Guid? PrinterProfileId { get; private set; }
    public bool IsDeleted { get; private set; }
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; private set; } = DateTime.UtcNow;

    public KitchenStation(string name, string? displayName, string? colorTag, int sortOrder,
        Guid? printerProfileId, Guid? branchId = null)
    {
        Name = name; DisplayName = displayName; ColorTag = colorTag; SortOrder = sortOrder;
        PrinterProfileId = printerProfileId; BranchId = branchId;
    }

    public void Update(string name, string? displayName, string? colorTag, int sortOrder, Guid? printerProfileId)
    {
        Name = name; DisplayName = displayName; ColorTag = colorTag; SortOrder = sortOrder;
        PrinterProfileId = printerProfileId; UpdatedAt = DateTime.UtcNow;
    }

    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}
