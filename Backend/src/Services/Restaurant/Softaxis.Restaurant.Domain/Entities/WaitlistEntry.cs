namespace Softaxis.Restaurant.Domain.Entities;

/// <summary>A walk-in party waiting for a table (not a reservation — no advance booking). Tracks
/// arrival, quoted wait, and how it resolved (seated/no-show/cancelled).</summary>
public sealed class WaitlistEntry
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    /// <summary>Scalar reference to Identity's Branch (cross-service, no FK) — null = single-location tenant.</summary>
    public Guid? BranchId { get; private set; }
    public string GuestName { get; private set; } = null!;
    public string GuestPhone { get; private set; } = null!;
    public int PartySize { get; private set; }
    public int QuotedWaitMinutes { get; private set; }
    public string Status { get; private set; } = "waiting"; // waiting/seated/no_show/cancelled
    public DateTime ArrivedAt { get; private set; } = DateTime.UtcNow;
    public DateTime? SeatedAt { get; private set; }
    public Guid? TableId { get; private set; }
    public string? Notes { get; private set; }
    public bool IsDeleted { get; private set; }
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; private set; } = DateTime.UtcNow;

    public WaitlistEntry(string guestName, string guestPhone, int partySize, int quotedWaitMinutes,
        string? notes, Guid? branchId = null)
    {
        GuestName = guestName; GuestPhone = guestPhone; PartySize = partySize;
        QuotedWaitMinutes = quotedWaitMinutes; Notes = notes; BranchId = branchId;
    }

    public void Seat(Guid tableId)
    {
        Status = "seated"; TableId = tableId; SeatedAt = DateTime.UtcNow; UpdatedAt = DateTime.UtcNow;
    }

    public void Cancel() { Status = "cancelled"; UpdatedAt = DateTime.UtcNow; }
    public void NoShow() { Status = "no_show"; UpdatedAt = DateTime.UtcNow; }
    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}
