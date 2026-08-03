namespace Softaxis.Restaurant.Domain.Entities;

public sealed class Table
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public string TableNumber { get; private set; } = null!;
    public string Section { get; private set; } = null!; // indoor/outdoor/vip/bar — legacy fallback display, superseded by DiningArea when set
    public int Capacity { get; private set; }
    public string Status { get; private set; } = "available"; // available/occupied/reserved/cleaning
    public Guid? CurrentOrderId { get; private set; }
    public string? CurrentWaiter { get; private set; }
    public DateTime? OccupiedSince { get; private set; }
    /// <summary>Scalar reference to Identity's Branch (cross-service, no FK constraint) — null = single-location tenant.</summary>
    public Guid? BranchId { get; private set; }
    /// <summary>Which dining area this table sits in (null = not yet placed on the floor designer).</summary>
    public Guid? DiningAreaId { get; private set; }
    public double? PosX { get; private set; }
    public double? PosY { get; private set; }
    public string Shape { get; private set; } = "square"; // round/square/rect
    public int Rotation { get; private set; } // degrees, 0-359
    /// <summary>Set when this table has been merged into another (self-FK). A merged table is
    /// hidden from normal seating flows — its capacity/orders are represented by the target table.</summary>
    public Guid? MergedIntoTableId { get; private set; }
    /// <summary>Unguessable token for QR table ordering — a guest scans a code encoding this token,
    /// which opens the public menu scoped to this table (see the anonymous public-orders endpoint).</summary>
    public string QrCode { get; private set; } = Guid.NewGuid().ToString("N");
    public bool IsDeleted { get; private set; }
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; private set; } = DateTime.UtcNow;

    public Table(string tableNumber, string section, int capacity, Guid? branchId = null, Guid? diningAreaId = null)
    {
        TableNumber = tableNumber; Section = section; Capacity = capacity;
        BranchId = branchId; DiningAreaId = diningAreaId;
    }

    public void Occupy(Guid orderId, string waiter)
    {
        CurrentOrderId = orderId; CurrentWaiter = waiter;
        Status = "occupied"; OccupiedSince = DateTime.UtcNow; UpdatedAt = DateTime.UtcNow;
    }

    public void Free()
    {
        CurrentOrderId = null; CurrentWaiter = null; OccupiedSince = null;
        Status = "cleaning"; UpdatedAt = DateTime.UtcNow;
    }

    public void SetAvailable() { Status = "available"; UpdatedAt = DateTime.UtcNow; }
    public void Reserve() { Status = "reserved"; UpdatedAt = DateTime.UtcNow; }
    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }

    public void UpdateDetails(string tableNumber, string section, int capacity, Guid? diningAreaId)
    {
        TableNumber = tableNumber; Section = section; Capacity = capacity; DiningAreaId = diningAreaId;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>Updates the table's position/shape/rotation on the floor designer canvas.</summary>
    public void Reposition(double posX, double posY, string shape, int rotation)
    {
        PosX = posX; PosY = posY; Shape = shape; Rotation = ((rotation % 360) + 360) % 360;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>Merges this table into another (e.g. pushing two tables together for a large party).
    /// A merged table can't be independently occupied — the target table represents the combined seating.</summary>
    public void MergeInto(Guid targetTableId)
    {
        MergedIntoTableId = targetTableId;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>Reverses a merge — the table becomes independently seatable again.</summary>
    public void Unmerge()
    {
        MergedIntoTableId = null;
        UpdatedAt = DateTime.UtcNow;
    }

    public bool IsMerged => MergedIntoTableId is not null;
}
