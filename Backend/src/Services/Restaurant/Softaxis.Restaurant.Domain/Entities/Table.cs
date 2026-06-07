namespace Softaxis.Restaurant.Domain.Entities;

public sealed class Table
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public string TableNumber { get; private set; } = null!;
    public string Section { get; private set; } = null!; // indoor/outdoor/vip/bar
    public int Capacity { get; private set; }
    public string Status { get; private set; } = "available"; // available/occupied/reserved/cleaning
    public Guid? CurrentOrderId { get; private set; }
    public string? CurrentWaiter { get; private set; }
    public DateTime? OccupiedSince { get; private set; }
    public bool IsDeleted { get; private set; }
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; private set; } = DateTime.UtcNow;

    public Table(string tableNumber, string section, int capacity)
    {
        TableNumber = tableNumber; Section = section; Capacity = capacity;
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
}
