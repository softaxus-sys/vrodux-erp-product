namespace Softaxis.Hospitality.Domain.Entities;

// Travel agency / tour operator entities. Calendar days are yyyy-MM-dd strings, as in the hotel side.

/// <summary>A sellable trip: "7 nights Turkey highlights". Priced per person, with a day-by-day itinerary.</summary>
public sealed class TourPackage
{
    private TourPackage() { }

    public TourPackage(string code, string name)
    {
        Id = Guid.NewGuid();
        Code = code.Trim().ToUpperInvariant();
        Name = name.Trim();
    }

    public Guid     Id               { get; private set; }
    public string   Code             { get; private set; } = string.Empty;
    public string   Name             { get; private set; } = string.Empty;
    public string?  Destination      { get; private set; }
    /// <summary>tour | umrah | hajj | honeymoon | business | cruise | custom …, free text.</summary>
    public string?  Category         { get; private set; }
    public int      DurationDays     { get; private set; } = 1;
    public string?  Description      { get; private set; }
    /// <summary>One item per line.</summary>
    public string?  Inclusions       { get; private set; }
    public string?  Exclusions       { get; private set; }
    public decimal  PricePerAdult    { get; private set; }
    public decimal  PricePerChild    { get; private set; }
    public decimal  SingleSupplement { get; private set; }
    public bool     IsActive         { get; private set; } = true;
    public bool     IsDeleted        { get; private set; }
    public DateTime CreatedAt        { get; private set; } = DateTime.UtcNow;
    public DateTime UpdatedAt        { get; private set; } = DateTime.UtcNow;

    private readonly List<TourItineraryDay> _days = [];
    public IReadOnlyList<TourItineraryDay> Days => _days;

    public void Update(string code, string name, string? destination, string? category, int durationDays,
        string? description, string? inclusions, string? exclusions,
        decimal adult, decimal child, decimal singleSupplement, bool isActive)
    {
        Code = code.Trim().ToUpperInvariant();
        Name = name.Trim();
        Destination = RoomType.Clean(destination);
        Category = RoomType.Clean(category);
        DurationDays = Math.Max(1, durationDays);
        Description = RoomType.Clean(description);
        Inclusions = RoomType.Clean(inclusions);
        Exclusions = RoomType.Clean(exclusions);
        PricePerAdult = Math.Round(Math.Max(0, adult), 2);
        PricePerChild = Math.Round(Math.Max(0, child), 2);
        SingleSupplement = Math.Round(Math.Max(0, singleSupplement), 2);
        IsActive = isActive;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>Replaces the itinerary. Days are renumbered 1..n in the order given.</summary>
    public void SetItinerary(IEnumerable<(string Title, string? Description, string? Accommodation, string? Meals)> days)
    {
        _days.Clear();
        var n = 1;
        foreach (var d in days)
            _days.Add(new TourItineraryDay(Id, n++, d.Title, d.Description, d.Accommodation, d.Meals));
        UpdatedAt = DateTime.UtcNow;
    }

    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}

public sealed class TourItineraryDay
{
    private TourItineraryDay() { }

    internal TourItineraryDay(Guid packageId, int dayNumber, string title, string? description, string? accommodation, string? meals)
    {
        Id = Guid.NewGuid();
        TourPackageId = packageId;
        DayNumber = dayNumber;
        Title = title.Trim();
        Description = RoomType.Clean(description);
        Accommodation = RoomType.Clean(accommodation);
        Meals = RoomType.Clean(meals);
    }

    public Guid    Id            { get; private set; }
    public Guid    TourPackageId { get; private set; }
    public int     DayNumber     { get; private set; }
    public string  Title         { get; private set; } = string.Empty;
    public string? Description   { get; private set; }
    public string? Accommodation { get; private set; }
    /// <summary>"B, L, D" style.</summary>
    public string? Meals         { get; private set; }
}

/// <summary>A dated run of a package with a seat limit, e.g. the 12 March group to Istanbul.</summary>
public sealed class TourDeparture
{
    public static readonly string[] Statuses = ["open", "closed", "cancelled", "completed"];

    private TourDeparture() { }

    public TourDeparture(Guid packageId, string startDate, string endDate, int capacity,
        decimal? adultPrice, decimal? childPrice, string? notes)
    {
        Id = Guid.NewGuid();
        TourPackageId = packageId;
        Update(startDate, endDate, capacity, adultPrice, childPrice, notes);
    }

    public Guid     Id                { get; private set; }
    public Guid     TourPackageId     { get; private set; }
    public string   StartDate         { get; private set; } = string.Empty;
    public string   EndDate           { get; private set; } = string.Empty;
    public int      Capacity          { get; private set; }
    /// <summary>Overrides the package price for this departure (peak dates). Null = package price.</summary>
    public decimal? AdultPrice        { get; private set; }
    public decimal? ChildPrice        { get; private set; }
    public string   Status            { get; private set; } = "open";
    public string?  Notes             { get; private set; }
    public bool     IsDeleted         { get; private set; }
    public DateTime CreatedAt         { get; private set; } = DateTime.UtcNow;
    public DateTime UpdatedAt         { get; private set; } = DateTime.UtcNow;

    public void Update(string startDate, string endDate, int capacity, decimal? adultPrice, decimal? childPrice, string? notes)
    {
        StartDate = startDate;
        EndDate = endDate;
        Capacity = Math.Max(1, capacity);
        AdultPrice = adultPrice is null ? null : Math.Round(Math.Max(0, adultPrice.Value), 2);
        ChildPrice = childPrice is null ? null : Math.Round(Math.Max(0, childPrice.Value), 2);
        Notes = RoomType.Clean(notes);
        UpdatedAt = DateTime.UtcNow;
    }

    public void SetStatus(string status) { Status = status; UpdatedAt = DateTime.UtcNow; }
    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}

/// <summary>
/// A customer's trip. Either a seat on a scheduled departure, or a tailor-made trip with its own dates.
/// Its price is the package per person (or a manual amount for a custom trip) plus any services sold
/// as extras, less a discount, plus tax. Supplier costs are tracked against it to show the margin.
/// </summary>
public sealed class TourBooking
{
    public static readonly string[] Statuses = ["enquiry", "confirmed", "completed", "cancelled"];

    private TourBooking() { }

    public TourBooking(string title, string startDate, string endDate, string customerName)
    {
        Id = Guid.NewGuid();
        BookingNumber = $"TB-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString("N")[..6].ToUpperInvariant()}";
        Title = title.Trim();
        StartDate = startDate;
        EndDate = endDate;
        CustomerName = customerName.Trim();
    }

    public Guid     Id             { get; private set; }
    public string   BookingNumber  { get; private set; } = string.Empty;
    public Guid?    TourPackageId  { get; private set; }
    public Guid?    DepartureId    { get; private set; }
    public string   Title          { get; private set; } = string.Empty;
    public string   StartDate      { get; private set; } = string.Empty;
    public string   EndDate        { get; private set; } = string.Empty;
    public Guid?    GuestId        { get; private set; }
    public string   CustomerName   { get; private set; } = string.Empty;
    public string?  CustomerEmail  { get; private set; }
    public string?  CustomerPhone  { get; private set; }
    public int      Adults         { get; private set; } = 1;
    public int      Children       { get; private set; }
    public int      SingleRooms    { get; private set; }
    public decimal  AdultPrice     { get; private set; }
    public decimal  ChildPrice     { get; private set; }
    public decimal  SingleSupplement { get; private set; }
    /// <summary>Per-person price × travellers + single supplements.</summary>
    public decimal  PackageAmount  { get; private set; }
    /// <summary>Services sold on top of the package.</summary>
    public decimal  ExtrasAmount   { get; private set; }
    public decimal  DiscountAmount { get; private set; }
    public decimal  TaxPercent     { get; private set; }
    public decimal  TaxAmount      { get; private set; }
    public decimal  TotalAmount    { get; private set; }
    public decimal  AmountPaid     { get; private set; }
    /// <summary>Supplier cost of every service not cancelled.</summary>
    public decimal  CostAmount     { get; private set; }
    public string   Status         { get; private set; } = "enquiry";
    public string?  Source         { get; private set; }
    public string?  CancelReason   { get; private set; }
    public string?  Notes          { get; private set; }
    public string?  CreatedByName  { get; private set; }
    public bool     IsDeleted      { get; private set; }
    public DateTime CreatedAt      { get; private set; } = DateTime.UtcNow;
    public DateTime UpdatedAt      { get; private set; } = DateTime.UtcNow;

    public decimal Balance => Math.Max(0, TotalAmount - AmountPaid);
    public decimal Margin  => TotalAmount - TaxAmount - CostAmount;
    public bool    IsOpen  => Status is "enquiry" or "confirmed";

    public void LinkPackage(Guid? packageId, Guid? departureId) { TourPackageId = packageId; DepartureId = departureId; }
    public void LinkGuest(Guid? guestId) => GuestId = guestId;
    public void SetCreatedBy(string? name) => CreatedByName = RoomType.Clean(name);

    public void SetDetails(string title, string startDate, string endDate, string customerName, string? email, string? phone,
        string? source, string? notes)
    {
        Title = title.Trim();
        StartDate = startDate;
        EndDate = endDate;
        CustomerName = customerName.Trim();
        CustomerEmail = Guest.Norm(email);
        CustomerPhone = RoomType.Clean(phone);
        Source = RoomType.Clean(source);
        Notes = RoomType.Clean(notes);
        UpdatedAt = DateTime.UtcNow;
    }

    public void SetPricing(int adults, int children, int singleRooms, decimal adultPrice, decimal childPrice,
        decimal singleSupplement, decimal discount, decimal taxPercent)
    {
        Adults = Math.Max(1, adults);
        Children = Math.Max(0, children);
        SingleRooms = Math.Clamp(singleRooms, 0, Adults);
        AdultPrice = Math.Round(Math.Max(0, adultPrice), 2);
        ChildPrice = Math.Round(Math.Max(0, childPrice), 2);
        SingleSupplement = Math.Round(Math.Max(0, singleSupplement), 2);
        DiscountAmount = Math.Round(Math.Max(0, discount), 2);
        TaxPercent = Math.Clamp(taxPercent, 0, 100);
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>Recomputes every total from the price inputs, services and payments.</summary>
    public void Recalculate(IEnumerable<TourService> services, decimal paid)
    {
        var live = services.Where(s => s.Status != "cancelled").ToList();
        PackageAmount = Adults * AdultPrice + Children * ChildPrice + SingleRooms * SingleSupplement;
        ExtrasAmount = live.Where(s => s.IsExtra).Sum(s => s.SellPrice);
        var sub = Math.Max(0, PackageAmount + ExtrasAmount - DiscountAmount);
        TaxAmount = Math.Round(sub * TaxPercent / 100m, 2, MidpointRounding.AwayFromZero);
        TotalAmount = sub + TaxAmount;
        CostAmount = live.Sum(s => s.Cost);
        AmountPaid = paid;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Confirm()  { Status = "confirmed"; UpdatedAt = DateTime.UtcNow; }
    public void Complete() { Status = "completed"; UpdatedAt = DateTime.UtcNow; }
    public void Reopen()   { Status = "confirmed"; CancelReason = null; UpdatedAt = DateTime.UtcNow; }
    public void Cancel(string reason) { Status = "cancelled"; CancelReason = reason.Trim(); UpdatedAt = DateTime.UtcNow; }
    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}

/// <summary>A person on the trip. Passport details are what visas, flights and hotels ask for.</summary>
public sealed class TourTraveller
{
    private TourTraveller() { }

    public TourTraveller(Guid bookingId, string fullName, string type, string? gender, string? dateOfBirth,
        string? nationality, string? passportNumber, string? passportExpiry, string? notes, int sortOrder)
    {
        Id = Guid.NewGuid();
        TourBookingId = bookingId;
        FullName = fullName.Trim();
        Type = type is "child" or "infant" ? type : "adult";
        Gender = RoomType.Clean(gender);
        DateOfBirth = RoomType.Clean(dateOfBirth);
        Nationality = RoomType.Clean(nationality);
        PassportNumber = RoomType.Clean(passportNumber)?.ToUpperInvariant();
        PassportExpiry = RoomType.Clean(passportExpiry);
        Notes = RoomType.Clean(notes);
        SortOrder = sortOrder;
    }

    public Guid    Id             { get; private set; }
    public Guid    TourBookingId  { get; private set; }
    public string  FullName       { get; private set; } = string.Empty;
    /// <summary>adult | child | infant.</summary>
    public string  Type           { get; private set; } = "adult";
    public string? Gender         { get; private set; }
    public string? DateOfBirth    { get; private set; }
    public string? Nationality    { get; private set; }
    public string? PassportNumber { get; private set; }
    public string? PassportExpiry { get; private set; }
    public string? Notes          { get; private set; }
    public int     SortOrder      { get; private set; }
}

/// <summary>
/// Something booked with a supplier for the trip: a hotel, flight, transfer, visa, activity, guide.
/// Cost is what the agency pays. When <see cref="IsExtra"/> it is also sold to the customer on top
/// of the package at <see cref="SellPrice"/>; otherwise it is part of what the package price covers.
/// </summary>
public sealed class TourService
{
    public static readonly string[] Types = ["hotel", "flight", "transfer", "visa", "activity", "guide", "insurance", "other"];
    public static readonly string[] ServiceStatuses = ["pending", "requested", "confirmed", "cancelled"];

    private TourService() { }

    public TourService(Guid bookingId) { Id = Guid.NewGuid(); TourBookingId = bookingId; }

    public Guid     Id                 { get; private set; }
    public Guid     TourBookingId      { get; private set; }
    public string   Type               { get; private set; } = "other";
    public string   SupplierName       { get; private set; } = string.Empty;
    public string   Description        { get; private set; } = string.Empty;
    public string?  ServiceDate        { get; private set; }
    public string?  EndDate            { get; private set; }
    public string?  ConfirmationNumber { get; private set; }
    public decimal  Cost               { get; private set; }
    public decimal  SupplierPaid       { get; private set; }
    public bool     IsExtra            { get; private set; }
    public decimal  SellPrice          { get; private set; }
    public string   Status             { get; private set; } = "pending";
    public string?  Notes              { get; private set; }
    public DateTime CreatedAt          { get; private set; } = DateTime.UtcNow;
    public DateTime UpdatedAt          { get; private set; } = DateTime.UtcNow;

    public decimal SupplierBalance => Status == "cancelled" ? 0 : Math.Max(0, Cost - SupplierPaid);

    public void Update(string type, string supplierName, string description, string? serviceDate, string? endDate,
        string? confirmation, decimal cost, decimal supplierPaid, bool isExtra, decimal sellPrice, string status, string? notes)
    {
        Type = Types.Contains(type) ? type : "other";
        SupplierName = supplierName.Trim();
        Description = description.Trim();
        ServiceDate = RoomType.Clean(serviceDate);
        EndDate = RoomType.Clean(endDate);
        ConfirmationNumber = RoomType.Clean(confirmation);
        Cost = Math.Round(Math.Max(0, cost), 2);
        SupplierPaid = Math.Round(Math.Max(0, supplierPaid), 2);
        IsExtra = isExtra;
        SellPrice = isExtra ? Math.Round(Math.Max(0, sellPrice), 2) : 0;
        Status = ServiceStatuses.Contains(status) ? status : "pending";
        Notes = RoomType.Clean(notes);
        UpdatedAt = DateTime.UtcNow;
    }
}

/// <summary>A planned payment: "Deposit 30% by 1 March", "Balance by 10 April".</summary>
public sealed class TourInstalment
{
    private TourInstalment() { }

    public TourInstalment(Guid bookingId, string label, string dueDate, decimal amount, int sortOrder)
    {
        Id = Guid.NewGuid();
        TourBookingId = bookingId;
        Label = label.Trim();
        DueDate = dueDate;
        Amount = Math.Round(Math.Max(0, amount), 2);
        SortOrder = sortOrder;
    }

    public Guid    Id            { get; private set; }
    public Guid    TourBookingId { get; private set; }
    public string  Label         { get; private set; } = string.Empty;
    public string  DueDate       { get; private set; } = string.Empty;
    public decimal Amount        { get; private set; }
    public int     SortOrder     { get; private set; }
}

/// <summary>Money received from the customer. Voided rather than deleted, so the trail stays.</summary>
public sealed class TourPayment
{
    private TourPayment() { }

    public TourPayment(Guid bookingId, decimal amount, string method, string? reference, string paidOn, string? receivedBy)
    {
        Id = Guid.NewGuid();
        TourBookingId = bookingId;
        Amount = Math.Round(amount, 2);
        Method = method.Trim();
        Reference = RoomType.Clean(reference);
        PaidOn = paidOn;
        ReceivedBy = RoomType.Clean(receivedBy);
    }

    public Guid     Id            { get; private set; }
    public Guid     TourBookingId { get; private set; }
    public decimal  Amount        { get; private set; }
    public string   Method        { get; private set; } = "cash";
    public string?  Reference     { get; private set; }
    public string   PaidOn        { get; private set; } = string.Empty;
    public string?  ReceivedBy    { get; private set; }
    public bool     IsVoided      { get; private set; }
    public string?  VoidReason    { get; private set; }
    public DateTime CreatedAt     { get; private set; } = DateTime.UtcNow;

    public void Void(string reason) { IsVoided = true; VoidReason = reason.Trim(); }
}
