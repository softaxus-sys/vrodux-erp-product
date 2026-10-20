namespace Softaxis.Hospitality.Domain.Entities;

public sealed class Booking
{
    private Booking() { }

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

    // ── PMS fields (all optional: bookings taken before the PMS have none of them) ──────────────
    public Guid?     GuestId              { get; private set; }
    public Guid?     RoomTypeId           { get; private set; }
    public Guid?     RatePlanId           { get; private set; }
    public string?   RatePlanName         { get; private set; }
    public string?   MealPlan             { get; private set; }
    /// <summary>Sum of the priced nights.</summary>
    public decimal   RoomCharge           { get; private set; }
    /// <summary>Sum of folio charges that are not voided.</summary>
    public decimal   ExtrasTotal          { get; private set; }
    public decimal   DiscountAmount       { get; private set; }
    public string?   DiscountReason       { get; private set; }
    /// <summary>Snapshot of the hotel's rates when the booking was taken; a later change to settings never reprices a stay.</summary>
    public decimal   ServiceChargePercent { get; private set; }
    public decimal   ServiceAmount        { get; private set; }
    public decimal   TaxPercent           { get; private set; }
    public decimal   TaxAmount            { get; private set; }
    public decimal   NightlyFee           { get; private set; }
    public decimal   FeeAmount            { get; private set; }
    public string?   CancelReason         { get; private set; }
    public DateTime? CancelledAt          { get; private set; }
    public DateTime? ActualCheckInAt      { get; private set; }
    public DateTime? ActualCheckOutAt     { get; private set; }
    public string?   Notes                { get; private set; }

    // computed — not mapped
    public decimal Balance => TotalAmount - PaidAmount;
    public bool IsOpen => Status is "confirmed" or "checked_in";

    public void LinkPms(Guid? guestId, Guid? roomTypeId, Guid? ratePlanId, string? ratePlanName, string? mealPlan,
        decimal serviceChargePercent, decimal taxPercent, decimal nightlyFee, string? notes)
    {
        GuestId = guestId; RoomTypeId = roomTypeId; RatePlanId = ratePlanId;
        RatePlanName = ratePlanName; MealPlan = mealPlan;
        ServiceChargePercent = serviceChargePercent; TaxPercent = taxPercent; NightlyFee = nightlyFee;
        Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
        UpdatedAt = DateTime.UtcNow;
    }

    public void LinkGuest(Guid guestId) { GuestId = guestId; UpdatedAt = DateTime.UtcNow; }

    /// <summary>
    /// Re-derives every money figure from the priced nights and the folio. Order matters and is the
    /// GCC convention: service charge on the subtotal, tax on subtotal + service, the per-night
    /// fee added on top untaxed.
    /// </summary>
    public void Recalculate(IReadOnlyCollection<BookingNight> nights, decimal extras)
    {
        Nights = nights.Count;
        RoomCharge = nights.Sum(n => n.Rate);
        RatePerNight = Nights == 0 ? 0 : Math.Round(RoomCharge / Nights, 2);
        ExtrasTotal = Math.Round(extras, 2);
        var sub = Math.Max(0, RoomCharge + ExtrasTotal - DiscountAmount);
        ServiceAmount = Math.Round(sub * ServiceChargePercent / 100m, 2);
        TaxAmount = Math.Round((sub + ServiceAmount) * TaxPercent / 100m, 2);
        FeeAmount = Math.Round(NightlyFee * Nights, 2);
        TotalAmount = sub + ServiceAmount + TaxAmount + FeeAmount;
        UpdatedAt = DateTime.UtcNow;
    }

    public void SetDiscount(decimal amount, string? reason)
    {
        DiscountAmount = Math.Max(0, Math.Round(amount, 2));
        DiscountReason = string.IsNullOrWhiteSpace(reason) ? null : reason.Trim();
    }

    public void SetDates(string checkIn, string checkOut)
    {
        CheckIn = checkIn; CheckOut = checkOut; UpdatedAt = DateTime.UtcNow;
    }

    public void MoveTo(Guid roomId, string roomNumber, string roomType, Guid? roomTypeId)
    {
        RoomId = roomId; RoomNumber = roomNumber; RoomType = roomType; RoomTypeId = roomTypeId;
        UpdatedAt = DateTime.UtcNow;
    }

    public void UpdateGuestDetails(string guestName, string guestEmail, string guestPhone, string guestNationality,
        int adults, int children, string source, string? specialRequests)
    {
        GuestName = guestName; GuestEmail = guestEmail; GuestPhone = guestPhone; GuestNationality = guestNationality;
        Adults = adults; Children = children; Source = source; SpecialRequests = specialRequests;
        UpdatedAt = DateTime.UtcNow;
    }

    public void MarkNoShow() { Status = "no_show"; UpdatedAt = DateTime.UtcNow; }

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

    public void DoCheckIn()  { Status = "checked_in";  ActualCheckInAt = DateTime.UtcNow;  UpdatedAt = DateTime.UtcNow; }
    public void DoCheckOut() { Status = "checked_out"; ActualCheckOutAt = DateTime.UtcNow; UpdatedAt = DateTime.UtcNow; }
    public void Cancel(string? reason = null)
    {
        Status = "cancelled"; CancelledAt = DateTime.UtcNow;
        CancelReason = string.IsNullOrWhiteSpace(reason) ? null : reason.Trim();
        UpdatedAt = DateTime.UtcNow;
    }
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
