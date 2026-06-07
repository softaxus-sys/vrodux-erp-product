namespace Softaxis.Hospitality.Domain.Entities;

public sealed class HousekeepingTask
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public Guid RoomId { get; private set; }
    public string RoomNumber { get; private set; } = null!;
    public string TaskType { get; private set; } = null!; // checkout_clean/stay_clean/deep_clean/inspection
    public string Priority { get; private set; } = "normal"; // low/normal/high/urgent
    public string Status { get; private set; } = "pending"; // pending/in_progress/completed/verified
    public string? AssignedTo { get; private set; }
    public DateTime? StartedAt { get; private set; }
    public DateTime? CompletedAt { get; private set; }
    public string? Notes { get; private set; }
    public bool IsDeleted { get; private set; }
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; private set; } = DateTime.UtcNow;

    public HousekeepingTask(Guid roomId, string roomNumber, string taskType, string priority, string? notes)
    {
        RoomId = roomId; RoomNumber = roomNumber; TaskType = taskType; Priority = priority; Notes = notes;
    }

    public void Assign(string staffName) { AssignedTo = staffName; UpdatedAt = DateTime.UtcNow; }

    public void Start()
    {
        Status = "in_progress"; StartedAt = DateTime.UtcNow; UpdatedAt = DateTime.UtcNow;
    }

    public void Complete()
    {
        Status = "completed"; CompletedAt = DateTime.UtcNow; UpdatedAt = DateTime.UtcNow;
    }

    public void Verify() { Status = "verified"; UpdatedAt = DateTime.UtcNow; }
    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}
