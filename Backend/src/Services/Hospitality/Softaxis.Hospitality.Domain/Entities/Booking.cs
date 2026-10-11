namespace Softaxis.Hospitality.Domain.Entities;

public sealed class Booking
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public string BookingNumber { get; private set; } = null!;
    public Guid RoomId { get; private set; }
    public string RoomNumber { get; private set; } = null!;
    public string RoomType { get; private set; } = null!;
    public string GuestName { get; private set; } = null!;
    public string GuestEmail { get; private set; } = null!;
    public string GuestPhone { get; private set; } = null!;
    public string GuestNationality { get; private set; } = null!;
    public string CheckIn { get; private set; } = null!;
    public string CheckOut { get; private set; } = null!;
    public int Nights { get; private set; }
    public int Adults { get; private set; }
    public int Children { get; private set; }
    public decimal RatePerNight { get; private set; }
    public decimal TotalAmount { get; private set; }
    public decimal PaidAmount { get; private set; }
    public string Status { get; private set; } = "confirmed"; // confirmed/checked_in/checked_out/cancelled/no_show
    public string Source { get; private set; } = null!; // direct/online/agent/corporate
    public string? SpecialRequests { get; private set; }
    public bool IsDeleted { get; private set; }
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; private set; } = DateTime.UtcNow;

    // computed — not mapped
    public decimal Balance => TotalAmount - PaidAmount;

    public Booking(Guid roomId, string roomNumber, string roomType, string guestName, string guestEmail,
        string guestPhone, string guestNationality, string checkIn, string checkOut, int nights,
        int adults, int children, decimal ratePerNight, string source, string? specialRequests)
    {
        BookingNumber = $"BK-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..4].ToUpper()}";
        RoomId = roomId; RoomNumber = roomNumber; RoomType = roomType;
        GuestName = guestName; GuestEmail = guestEmail; GuestPhone = guestPhone;
        GuestNationality = guestNationality; CheckIn = checkIn; CheckOut = checkOut;
        Nights = nights; Adults = adults; Children = children; RatePerNight = ratePerNight;
        TotalAmount = nights * ratePerNight; Source = source; SpecialRequests = specialRequests;
    }

    public void DoCheckIn()  { Status = "checked_in";  UpdatedAt = DateTime.UtcNow; }
    public void DoCheckOut() { Status = "checked_out"; UpdatedAt = DateTime.UtcNow; }
    public void Cancel() { Status = "cancelled"; UpdatedAt = DateTime.UtcNow; }
    public void RecordPayment(decimal amount) { PaidAmount += amount; UpdatedAt = DateTime.UtcNow; }
    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}

/// <summary>
/// One amount a guest paid against a booking. The booking itself only carries the running total;
/// without these rows nobody could say how much came in on a given day, or by what method.
/// </summary>
public sealed class BookingPayment
{
    public static readonly string[] Methods = ["cash", "card", "bank_transfer", "cheque"];

    private BookingPayment() { }

    public BookingPayment(Guid bookingId, decimal amount, string method, string paidOn, string? reference)
    {
        Id        = Guid.NewGuid();
        BookingId = bookingId;
        Amount    = Math.Round(amount, 2);
        Method    = method.Trim().ToLowerInvariant();
        PaidOn    = paidOn;
        Reference = string.IsNullOrWhiteSpace(reference) ? null : reference.Trim();
        CreatedAt = DateTime.UtcNow;
    }

    public Guid     Id        { get; private set; }
    public Guid     BookingId { get; private set; }
    public decimal  Amount    { get; private set; }
    /// <summary>cash | card | bank_transfer | cheque.</summary>
    public string   Method    { get; private set; } = "cash";
    /// <summary>yyyy-MM-dd.</summary>
    public string   PaidOn    { get; private set; } = string.Empty;
    public string?  Reference { get; private set; }
    public DateTime CreatedAt { get; private set; }
}
