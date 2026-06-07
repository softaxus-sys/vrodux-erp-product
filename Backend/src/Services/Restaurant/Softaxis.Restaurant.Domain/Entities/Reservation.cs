namespace Softaxis.Restaurant.Domain.Entities;

public sealed class Reservation
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public string ReservationNumber { get; private set; } = null!;
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
    public bool IsDeleted { get; private set; }
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; private set; } = DateTime.UtcNow;

    public Reservation(string guestName, string guestPhone, string? guestEmail, int covers,
        string reservationDate, string reservationTime, string? specialRequests)
    {
        ReservationNumber = $"RES-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..4].ToUpper()}";
        GuestName = guestName; GuestPhone = guestPhone; GuestEmail = guestEmail;
        Covers = covers; ReservationDate = reservationDate; ReservationTime = reservationTime;
        SpecialRequests = specialRequests;
    }

    public void AssignTable(Guid tableId, string tableNumber)
    {
        TableId = tableId; TableNumber = tableNumber; UpdatedAt = DateTime.UtcNow;
    }

    public void Seat() { Status = "seated"; UpdatedAt = DateTime.UtcNow; }
    public void Complete() { Status = "completed"; UpdatedAt = DateTime.UtcNow; }
    public void Cancel() { Status = "cancelled"; UpdatedAt = DateTime.UtcNow; }
    public void NoShow() { Status = "no_show"; UpdatedAt = DateTime.UtcNow; }
    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}
