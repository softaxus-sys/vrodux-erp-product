namespace Softaxis.Restaurant.Domain.Entities;

/// <summary>A physical floor/level of a branch (e.g. "Ground Floor", "Rooftop") — the top level of the
/// floor designer hierarchy: Floor → DiningArea → Table.</summary>
public sealed class Floor
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    /// <summary>Scalar reference to Identity's Branch (cross-service, no FK) — null = single-location tenant.</summary>
    public Guid? BranchId { get; private set; }
    public string Name { get; private set; } = null!;
    public int SortOrder { get; private set; }
    public bool IsDeleted { get; private set; }
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; private set; } = DateTime.UtcNow;

    public Floor(string name, int sortOrder, Guid? branchId = null)
    {
        Name = name; SortOrder = sortOrder; BranchId = branchId;
    }

    public void Update(string name, int sortOrder)
    {
        Name = name; SortOrder = sortOrder; UpdatedAt = DateTime.UtcNow;
    }

    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}

/// <summary>A seating zone within a floor (e.g. "Main Hall", "Patio", "VIP Room") — tables are placed
/// within a dining area on the designer canvas.</summary>
public sealed class DiningArea
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public Guid FloorId { get; private set; }
    public string Name { get; private set; } = null!;
    public string Type { get; private set; } = "indoor"; // indoor/outdoor/vip/bar/rooftop
    public int SortOrder { get; private set; }
    public bool IsDeleted { get; private set; }
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; private set; } = DateTime.UtcNow;

    public DiningArea(Guid floorId, string name, string type, int sortOrder)
    {
        FloorId = floorId; Name = name; Type = type; SortOrder = sortOrder;
    }

    public void Update(string name, string type, int sortOrder)
    {
        Name = name; Type = type; SortOrder = sortOrder; UpdatedAt = DateTime.UtcNow;
    }

    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}

/// <summary>Audit trail row for moving an in-progress order from one table to another (e.g. a guest
/// asks to switch tables mid-meal) — distinct from a table *merge*, which combines seating capacity.</summary>
public sealed class TableTransferLog
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public Guid OrderId { get; private set; }
    public Guid FromTableId { get; private set; }
    public Guid ToTableId { get; private set; }
    public Guid TransferredByUserId { get; private set; }
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;

    public TableTransferLog(Guid orderId, Guid fromTableId, Guid toTableId, Guid transferredByUserId)
    {
        OrderId = orderId; FromTableId = fromTableId; ToTableId = toTableId; TransferredByUserId = transferredByUserId;
    }
}
