namespace Softaxis.Hospitality.Domain.Entities;

// Hotel property-management entities. Dates that are calendar days (stay dates, season ranges,
// blocks) are yyyy-MM-dd strings, as Booking already uses — a calendar day has no time zone, and
// a DateTime here would shift a whole night across midnight for any guest outside UTC.

/// <summary>A kind of room the hotel sells (Standard King, Deluxe Twin…). Rates and availability are by type.</summary>
public sealed class RoomType
{
    private RoomType() { }

    public RoomType(string code, string name, decimal baseRate, int maxAdults, int maxChildren,
        string? description, string? amenities)
    {
        Id = Guid.NewGuid();
        Update(code, name, baseRate, maxAdults, maxChildren, description, amenities, true);
    }

    public Guid     Id          { get; private set; }
    public string   Code        { get; private set; } = string.Empty;
    public string   Name        { get; private set; } = string.Empty;
    public string?  Description { get; private set; }
    /// <summary>Comma separated, free text ("Wi-Fi, Sea view, Bathtub").</summary>
    public string?  Amenities   { get; private set; }
    /// <summary>Nightly rate used when no rate plan season covers a night.</summary>
    public decimal  BaseRate    { get; private set; }
    public int      MaxAdults   { get; private set; }
    public int      MaxChildren { get; private set; }
    public bool     IsActive    { get; private set; } = true;
    public bool     IsDeleted   { get; private set; }
    public DateTime CreatedAt   { get; private set; } = DateTime.UtcNow;
    public DateTime UpdatedAt   { get; private set; } = DateTime.UtcNow;

    public int MaxOccupancy => MaxAdults + MaxChildren;

    public void Update(string code, string name, decimal baseRate, int maxAdults, int maxChildren,
        string? description, string? amenities, bool isActive)
    {
        Code = code.Trim().ToUpperInvariant();
        Name = name.Trim();
        BaseRate = Math.Round(baseRate, 2);
        MaxAdults = Math.Max(1, maxAdults);
        MaxChildren = Math.Max(0, maxChildren);
        Description = Clean(description);
        Amenities = Clean(amenities);
        IsActive = isActive;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }

    internal static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
}

/// <summary>A guest or traveller profile, kept across stays so the front desk does not retype it.</summary>
public sealed class Guest
{
    private Guest() { }

    public Guest(string fullName, string? email, string? phone, string? nationality)
    {
        Id = Guid.NewGuid();
        FullName = fullName.Trim();
        Email = Norm(email);
        Phone = RoomType.Clean(phone);
        Nationality = RoomType.Clean(nationality);
    }

    public Guid     Id             { get; private set; }
    public string   FullName       { get; private set; } = string.Empty;
    public string?  Email          { get; private set; }
    public string?  Phone          { get; private set; }
    public string?  Nationality    { get; private set; }
    /// <summary>passport | national_id | driving_licence | other.</summary>
    public string?  DocumentType   { get; private set; }
    public string?  DocumentNumber { get; private set; }
    /// <summary>yyyy-MM-dd.</summary>
    public string?  DocumentExpiry { get; private set; }
    /// <summary>yyyy-MM-dd.</summary>
    public string?  DateOfBirth    { get; private set; }
    public string?  Address        { get; private set; }
    public string?  Company        { get; private set; }
    public bool     IsVip          { get; private set; }
    public string?  Notes          { get; private set; }
    public int      StayCount      { get; private set; }
    public decimal  TotalSpent     { get; private set; }
    /// <summary>yyyy-MM-dd of the last check-out.</summary>
    public string?  LastStayOn     { get; private set; }
    public bool     IsDeleted      { get; private set; }
    public DateTime CreatedAt      { get; private set; } = DateTime.UtcNow;
    public DateTime UpdatedAt      { get; private set; } = DateTime.UtcNow;

    public void Update(string fullName, string? email, string? phone, string? nationality,
        string? documentType, string? documentNumber, string? documentExpiry, string? dateOfBirth,
        string? address, string? company, bool isVip, string? notes)
    {
        FullName = fullName.Trim();
        Email = Norm(email);
        Phone = RoomType.Clean(phone);
        Nationality = RoomType.Clean(nationality);
        DocumentType = RoomType.Clean(documentType)?.ToLowerInvariant();
        DocumentNumber = RoomType.Clean(documentNumber);
        DocumentExpiry = RoomType.Clean(documentExpiry);
        DateOfBirth = RoomType.Clean(dateOfBirth);
        Address = RoomType.Clean(address);
        Company = RoomType.Clean(company);
        IsVip = isVip;
        Notes = RoomType.Clean(notes);
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>Fills only what is missing — a booking form must never overwrite a richer profile.</summary>
    public void FillGaps(string? email, string? phone, string? nationality)
    {
        Email ??= Norm(email);
        Phone ??= RoomType.Clean(phone);
        Nationality ??= RoomType.Clean(nationality);
        UpdatedAt = DateTime.UtcNow;
    }

    public void RecordStay(decimal spent, string checkedOutOn)
    {
        StayCount++;
        TotalSpent += Math.Round(spent, 2);
        LastStayOn = checkedOutOn;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }

    public static string? Norm(string? email) =>
        string.IsNullOrWhiteSpace(email) ? null : email.Trim().ToLowerInvariant();
}

/// <summary>A way of selling a room: Best Available Rate, Bed &amp; Breakfast, Non-refundable…</summary>
public sealed class RatePlan
{
    public static readonly string[] MealPlans = ["room_only", "bed_breakfast", "half_board", "full_board", "all_inclusive"];

    private RatePlan() { }

    public RatePlan(string code, string name, string mealPlan, bool isRefundable, string? description)
    {
        Id = Guid.NewGuid();
        Update(code, name, mealPlan, isRefundable, description, true);
    }

    public Guid     Id           { get; private set; }
    public string   Code         { get; private set; } = string.Empty;
    public string   Name         { get; private set; } = string.Empty;
    public string   MealPlan     { get; private set; } = "room_only";
    public bool     IsRefundable { get; private set; } = true;
    public string?  Description  { get; private set; }
    public bool     IsDefault    { get; private set; }
    public bool     IsActive     { get; private set; } = true;
    public bool     IsDeleted    { get; private set; }
    public DateTime CreatedAt    { get; private set; } = DateTime.UtcNow;
    public DateTime UpdatedAt    { get; private set; } = DateTime.UtcNow;

    public void Update(string code, string name, string mealPlan, bool isRefundable, string? description, bool isActive)
    {
        Code = code.Trim().ToUpperInvariant();
        Name = name.Trim();
        MealPlan = mealPlan.Trim().ToLowerInvariant();
        IsRefundable = isRefundable;
        Description = RoomType.Clean(description);
        IsActive = isActive;
        UpdatedAt = DateTime.UtcNow;
    }

    public void SetDefault(bool value) { IsDefault = value; UpdatedAt = DateTime.UtcNow; }
    public void Delete() { IsDeleted = true; IsDefault = false; UpdatedAt = DateTime.UtcNow; }
}

/// <summary>
/// The price of one room type under one rate plan for a run of dates. Where seasons overlap the
/// one starting latest wins, so a short event period can sit on top of a long high season.
/// </summary>
public sealed class SeasonalRate
{
    private SeasonalRate() { }

    public SeasonalRate(Guid ratePlanId, Guid roomTypeId, string label, string fromDate, string toDate,
        decimal weekdayRate, decimal? weekendRate, int minNights)
    {
        Id = Guid.NewGuid();
        RatePlanId = ratePlanId;
        RoomTypeId = roomTypeId;
        Label = label.Trim();
        FromDate = fromDate;
        ToDate = toDate;
        WeekdayRate = Math.Round(weekdayRate, 2);
        WeekendRate = weekendRate is null ? null : Math.Round(weekendRate.Value, 2);
        MinNights = Math.Max(1, minNights);
    }

    public Guid     Id          { get; private set; }
    public Guid     RatePlanId  { get; private set; }
    public Guid     RoomTypeId  { get; private set; }
    public string   Label       { get; private set; } = string.Empty;
    /// <summary>First night covered, yyyy-MM-dd.</summary>
    public string   FromDate    { get; private set; } = string.Empty;
    /// <summary>Last night covered (inclusive), yyyy-MM-dd.</summary>
    public string   ToDate      { get; private set; } = string.Empty;
    public decimal  WeekdayRate { get; private set; }
    /// <summary>Null = the weekday rate applies every night.</summary>
    public decimal? WeekendRate { get; private set; }
    public int      MinNights   { get; private set; } = 1;
    public DateTime CreatedAt   { get; private set; } = DateTime.UtcNow;
}

/// <summary>A room taken out of sale for a run of nights (repairs, deep clean, owner use).</summary>
public sealed class RoomBlock
{
    private RoomBlock() { }

    public RoomBlock(Guid roomId, string roomNumber, string fromDate, string toDate, string reason)
    {
        Id = Guid.NewGuid();
        RoomId = roomId;
        RoomNumber = roomNumber;
        FromDate = fromDate;
        ToDate = toDate;
        Reason = reason.Trim();
    }

    public Guid     Id         { get; private set; }
    public Guid     RoomId     { get; private set; }
    public string   RoomNumber { get; private set; } = string.Empty;
    /// <summary>First blocked night, yyyy-MM-dd.</summary>
    public string   FromDate   { get; private set; } = string.Empty;
    /// <summary>Night after the last blocked night (exclusive), yyyy-MM-dd — same convention as a stay.</summary>
    public string   ToDate     { get; private set; } = string.Empty;
    public string   Reason     { get; private set; } = string.Empty;
    public DateTime CreatedAt  { get; private set; } = DateTime.UtcNow;
}

/// <summary>The price of one night of one stay, fixed when the night was booked.</summary>
public sealed class BookingNight
{
    private BookingNight() { }

    public BookingNight(Guid bookingId, string date, decimal rate)
    {
        Id = Guid.NewGuid();
        BookingId = bookingId;
        Date = date;
        Rate = Math.Round(rate, 2);
    }

    public Guid    Id        { get; private set; }
    public Guid    BookingId { get; private set; }
    /// <summary>yyyy-MM-dd.</summary>
    public string  Date      { get; private set; } = string.Empty;
    public decimal Rate      { get; private set; }
}

/// <summary>Anything charged to a stay beyond the room nights — minibar, laundry, restaurant…</summary>
public sealed class FolioCharge
{
    public static readonly string[] Categories =
        ["food", "beverage", "room_service", "minibar", "laundry", "spa", "transport", "telephone",
         "extra_bed", "late_checkout", "damage", "cancellation_fee", "other"];

    private FolioCharge() { }

    public FolioCharge(Guid bookingId, string date, string category, string description,
        decimal quantity, decimal unitPrice, string? postedBy)
    {
        Id = Guid.NewGuid();
        BookingId = bookingId;
        Date = date;
        Category = category.Trim().ToLowerInvariant();
        Description = description.Trim();
        Quantity = quantity;
        UnitPrice = Math.Round(unitPrice, 2);
        Amount = Math.Round(quantity * unitPrice, 2);
        PostedBy = RoomType.Clean(postedBy);
    }

    public Guid      Id          { get; private set; }
    public Guid      BookingId   { get; private set; }
    /// <summary>yyyy-MM-dd.</summary>
    public string    Date        { get; private set; } = string.Empty;
    public string    Category    { get; private set; } = "other";
    public string    Description { get; private set; } = string.Empty;
    public decimal   Quantity    { get; private set; }
    public decimal   UnitPrice   { get; private set; }
    public decimal   Amount      { get; private set; }
    public string?   PostedBy    { get; private set; }
    public bool      IsVoided    { get; private set; }
    public string?   VoidReason  { get; private set; }
    public DateTime? VoidedAt    { get; private set; }
    public DateTime  CreatedAt   { get; private set; } = DateTime.UtcNow;

    public void Void(string reason)
    {
        IsVoided = true;
        VoidReason = reason.Trim();
        VoidedAt = DateTime.UtcNow;
    }
}

/// <summary>One row per workspace: how the hotel prices and runs. Created on first read.</summary>
public sealed class HotelSettings
{
    public static readonly string[] DayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    private HotelSettings() { }

    public static HotelSettings CreateDefault() => new()
    {
        Id = Guid.NewGuid(),
        WeekendDays = "Fri,Sat",
        CheckInTime = "14:00",
        CheckOutTime = "12:00",
        TaxPercent = 0,
        ServiceChargePercent = 0,
        TaxLabel = "VAT",
    };

    public Guid     Id                   { get; private set; }
    public string?  PropertyName         { get; private set; }
    /// <summary>Comma separated day names whose night is priced at the weekend rate ("Fri,Sat").</summary>
    public string   WeekendDays          { get; private set; } = "Fri,Sat";
    public string   CheckInTime          { get; private set; } = "14:00";
    public string   CheckOutTime         { get; private set; } = "12:00";
    public decimal  TaxPercent           { get; private set; }
    public string   TaxLabel             { get; private set; } = "VAT";
    public decimal  ServiceChargePercent { get; private set; }
    /// <summary>Flat fee per room per night (municipality / tourism dirham). 0 = none.</summary>
    public decimal  NightlyFee           { get; private set; }
    public string?  NightlyFeeLabel      { get; private set; }
    public DateTime UpdatedAt            { get; private set; } = DateTime.UtcNow;

    public void Update(string? propertyName, string weekendDays, string checkInTime, string checkOutTime,
        decimal taxPercent, string taxLabel, decimal serviceChargePercent, decimal nightlyFee, string? nightlyFeeLabel)
    {
        PropertyName = RoomType.Clean(propertyName);
        WeekendDays = weekendDays;
        CheckInTime = checkInTime;
        CheckOutTime = checkOutTime;
        TaxPercent = Math.Round(taxPercent, 3);
        TaxLabel = string.IsNullOrWhiteSpace(taxLabel) ? "Tax" : taxLabel.Trim();
        ServiceChargePercent = Math.Round(serviceChargePercent, 3);
        NightlyFee = Math.Round(nightlyFee, 2);
        NightlyFeeLabel = RoomType.Clean(nightlyFeeLabel);
        UpdatedAt = DateTime.UtcNow;
    }

    public bool IsWeekendNight(DateOnly night) =>
        WeekendDays.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Contains(DayNames[(int)night.DayOfWeek], StringComparer.OrdinalIgnoreCase);
}
