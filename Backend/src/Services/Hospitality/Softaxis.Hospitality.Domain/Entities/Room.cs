namespace Softaxis.Hospitality.Domain.Entities;

public sealed class Room
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public string RoomNumber { get; private set; } = null!;
    public string RoomType { get; private set; } = null!; // standard/deluxe/suite/presidential
    public int Floor { get; private set; }
    public int Capacity { get; private set; }
    public decimal RatePerNight { get; private set; }
    public string Status { get; private set; } = "available"; // available/occupied/maintenance/cleaning
    public string HousekeepingStatus { get; private set; } = "clean"; // clean/dirty/inspected
    public string? CurrentGuestName { get; private set; }
    public string? CurrentBookingId { get; private set; }
    public string? View { get; private set; } // sea/city/garden/pool
    public bool HasBalcony { get; private set; }
    public Guid? RoomTypeId { get; private set; }
    public string? Notes { get; private set; }
    public bool IsDeleted { get; private set; }
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; private set; } = DateTime.UtcNow;

    public Room(string roomNumber, string roomType, int floor, int capacity, decimal ratePerNight,
        string? view, bool hasBalcony)
    {
        RoomNumber = roomNumber; RoomType = roomType; Floor = floor; Capacity = capacity;
        RatePerNight = ratePerNight; View = view; HasBalcony = hasBalcony;
    }

    public void CheckIn(string guestName, string bookingId)
    {
        CurrentGuestName = guestName; CurrentBookingId = bookingId;
        Status = "occupied"; HousekeepingStatus = "dirty"; UpdatedAt = DateTime.UtcNow;
    }

    public void CheckOut()
    {
        CurrentGuestName = null; CurrentBookingId = null;
        Status = "available"; HousekeepingStatus = "dirty"; UpdatedAt = DateTime.UtcNow;
    }

    private Room() { }

    public void Update(string roomNumber, Guid? roomTypeId, string roomType, int floor, int capacity,
        decimal ratePerNight, string? view, bool hasBalcony, string? notes)
    {
        RoomNumber = roomNumber.Trim(); RoomTypeId = roomTypeId; RoomType = roomType; Floor = floor;
        Capacity = Math.Max(1, capacity); RatePerNight = Math.Round(ratePerNight, 2);
        View = string.IsNullOrWhiteSpace(view) ? null : view.Trim(); HasBalcony = hasBalcony;
        Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
        UpdatedAt = DateTime.UtcNow;
    }

    public void LinkType(Guid roomTypeId) { RoomTypeId = roomTypeId; UpdatedAt = DateTime.UtcNow; }

    /// <summary>Back in service after maintenance.</summary>
    public void SetAvailable() { if (Status == "maintenance") Status = CurrentBookingId is null ? "available" : "occupied"; UpdatedAt = DateTime.UtcNow; }

    public void SetHousekeeping(string status) { HousekeepingStatus = status; UpdatedAt = DateTime.UtcNow; }
    public void SetMaintenance() { Status = "maintenance"; UpdatedAt = DateTime.UtcNow; }
    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}
