namespace Softaxis.Restaurant.Domain.Entities;

public sealed class Reservation
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public string ReservationNumber { get; private set; } = null!;
    /// <summary>Scalar reference to Identity's Branch (cross-service, no FK) — null = single-location tenant.</summary>
    public Guid? BranchId { get; private set; }
    public Guid? TableId { get; private set; }
    public string? TableNumber { get; private set; }
    public string GuestName { get; private set; } = null!;
    public string GuestPhone { get; private set; } = null!;
    public string? GuestEmail { get; private set; }
    public int Covers { get; private set; }
    public string ReservationDate { get; private set; } = null!; // yyyy-MM-dd
    public string ReservationTime { get; private set; } = null!; // HH:mm
    public string Status { get; private set; } = "confirmed"; // confirmed/seated/completed/cancelled/no_show
    public string? SpecialRequests { get; private set; }
    /// <summary>Optional grace window (HH:mm) the guest is expected within — drives the
    /// auto-no-show background job together with the branch's ReservationRule.AutoNoShowMinutes.</summary>
    public string? ArrivalWindowStart { get; private set; }
    public string? ArrivalWindowEnd { get; private set; }
    public DateTime? NoShowAt { get; private set; }
    public bool IsDeleted { get; private set; }
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; private set; } = DateTime.UtcNow;

    public Reservation(string guestName, string guestPhone, string? guestEmail, int covers,
        string reservationDate, string reservationTime, string? specialRequests,
        Guid? branchId = null, string? arrivalWindowStart = null, string? arrivalWindowEnd = null)
    {
        ReservationNumber = $"RES-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..4].ToUpper()}";
        GuestName = guestName; GuestPhone = guestPhone; GuestEmail = guestEmail;
        Covers = covers; ReservationDate = reservationDate; ReservationTime = reservationTime;
        SpecialRequests = specialRequests; BranchId = branchId;
        ArrivalWindowStart = arrivalWindowStart; ArrivalWindowEnd = arrivalWindowEnd;
    }

    public void AssignTable(Guid tableId, string tableNumber)
    {
        TableId = tableId; TableNumber = tableNumber; UpdatedAt = DateTime.UtcNow;
    }

    public void Seat() { Status = "seated"; UpdatedAt = DateTime.UtcNow; }
    public void Complete() { Status = "completed"; UpdatedAt = DateTime.UtcNow; }
    public void Cancel() { Status = "cancelled"; UpdatedAt = DateTime.UtcNow; }
    public void NoShow() { Status = "no_show"; NoShowAt = DateTime.UtcNow; UpdatedAt = DateTime.UtcNow; }
    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}

/// <summary>Per-branch reservation policy — drives slot capacity, booking-window limits, and the
/// auto-no-show background job. One row per branch (BranchId null = the tenant's single-location default).</summary>
public sealed class ReservationRule
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public Guid? BranchId { get; private set; }
    public int SlotDurationMinutes { get; private set; } = 90;
    public int MaxCoversPerSlot { get; private set; } = 50;
    public int MaxAdvanceDays { get; private set; } = 60;
    public int MinNoticeMinutes { get; private set; } = 30;
    /// <summary>Minutes past the reservation time (or ArrivalWindowEnd, if set) before the
    /// background job auto-flags the reservation as a no-show. 0 = auto-no-show disabled.</summary>
    public int AutoNoShowMinutes { get; private set; } = 15;
    public bool DepositRequired { get; private set; }
    public decimal DepositAmount { get; private set; }
    public bool IsDeleted { get; private set; }
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; private set; } = DateTime.UtcNow;

    public ReservationRule(Guid? branchId)
    {
        BranchId = branchId;
    }

    public void Update(int slotDurationMinutes, int maxCoversPerSlot, int maxAdvanceDays,
        int minNoticeMinutes, int autoNoShowMinutes, bool depositRequired, decimal depositAmount)
    {
        SlotDurationMinutes = slotDurationMinutes; MaxCoversPerSlot = maxCoversPerSlot;
        MaxAdvanceDays = maxAdvanceDays; MinNoticeMinutes = minNoticeMinutes;
        AutoNoShowMinutes = autoNoShowMinutes; DepositRequired = depositRequired; DepositAmount = depositAmount;
        UpdatedAt = DateTime.UtcNow;
    }
}
