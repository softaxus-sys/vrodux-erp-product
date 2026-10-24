using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;

namespace Softaxis.Hospitality.Application.Tours;

// ── DTOs ─────────────────────────────────────────────────────────────────────

public sealed record ItineraryDayDto(int DayNumber, string Title, string? Description, string? Accommodation, string? Meals);

public sealed record TourPackageDto(
    Guid Id, string Code, string Name, string? Destination, string? Category, int DurationDays,
    string? Description, string? Inclusions, string? Exclusions,
    decimal PricePerAdult, decimal PricePerChild, decimal SingleSupplement, bool IsActive,
    IReadOnlyList<ItineraryDayDto> Days, int UpcomingDepartures, DateTime CreatedAt);

public sealed record TourDepartureDto(
    Guid Id, Guid PackageId, string PackageCode, string PackageName, string? Destination,
    string StartDate, string EndDate, int Capacity, int SeatsBooked, int SeatsLeft,
    decimal AdultPrice, decimal ChildPrice, bool HasPriceOverride,
    string Status, string? Notes, int BookingCount, decimal Revenue);

/// <summary>Costs and margin are null unless the caller may see supplier costs.</summary>
public sealed record TourBookingDto(
    Guid Id, string BookingNumber, Guid? PackageId, Guid? DepartureId, string Title,
    string StartDate, string EndDate, Guid? GuestId, string CustomerName, string? CustomerEmail, string? CustomerPhone,
    int Adults, int Children, int SingleRooms, decimal AdultPrice, decimal ChildPrice, decimal SingleSupplement,
    decimal PackageAmount, decimal ExtrasAmount, decimal DiscountAmount, decimal TaxPercent, decimal TaxAmount,
    decimal TotalAmount, decimal AmountPaid, decimal Balance, decimal? CostAmount, decimal? Margin,
    string Status, string? Source, string? CancelReason, string? Notes, string? CreatedByName,
    string? NextDueDate, decimal OverdueAmount, DateTime CreatedAt);

public sealed record TourTravellerDto(Guid Id, string FullName, string Type, string? Gender, string? DateOfBirth,
    string? Nationality, string? PassportNumber, string? PassportExpiry, string? Notes, bool PassportProblem);

public sealed record TourServiceDto(Guid Id, string Type, string SupplierName, string Description,
    string? ServiceDate, string? EndDate, string? ConfirmationNumber, decimal? Cost, decimal? SupplierPaid,
    decimal? SupplierBalance, bool IsExtra, decimal SellPrice, string Status, string? Notes,
    IReadOnlyDictionary<string, string> Details);

/// <summary>Status: paid | partial | overdue | due (today) | upcoming.</summary>
public sealed record TourInstalmentDto(Guid Id, string Label, string DueDate, decimal Amount, decimal Paid, string Status);

public sealed record TourPaymentDto(Guid Id, decimal Amount, string Method, string? Reference, string PaidOn,
    string? ReceivedBy, bool IsVoided, string? VoidReason, DateTime CreatedAt);

public sealed record TourBookingDetailDto(
    TourBookingDto Booking,
    string? PackageName, string? Destination, string? Inclusions, string? Exclusions,
    IReadOnlyList<ItineraryDayDto> Itinerary,
    IReadOnlyList<TourTravellerDto> Travellers,
    IReadOnlyList<TourServiceDto> Services,
    IReadOnlyList<TourInstalmentDto> Instalments,
    IReadOnlyList<TourPaymentDto> Payments,
    bool CanSeeCosts);

public sealed record TourAttentionDto(Guid BookingId, string BookingNumber, string CustomerName, string Title,
    string StartDate, string Kind, string Message, decimal? Amount);

public sealed record TourDashboardDto(
    int Enquiries, int Confirmed, int TravellingNow, int DepartingNext30Days,
    decimal BalanceDue, decimal OverdueAmount, decimal? SupplierBalanceDue, decimal? MarginThisMonth,
    decimal SalesThisMonth, int ServicesNotConfirmed,
    IReadOnlyList<TourDepartureDto> UpcomingDepartures,
    IReadOnlyList<TourAttentionDto> Attention);

// ── Queries ──────────────────────────────────────────────────────────────────

public sealed record GetTourPackagesQuery(string? Search = null, bool IncludeInactive = false) : IQuery<IReadOnlyList<TourPackageDto>>;
public sealed record GetTourPackageByIdQuery(Guid Id) : IQuery<TourPackageDto>;

public sealed record GetTourDeparturesQuery(Guid? PackageId = null, string? From = null, string? To = null, bool IncludeClosed = true)
    : IQuery<IReadOnlyList<TourDepartureDto>>;

public sealed record GetTourBookingsQuery(
    string? Status = null, string? Search = null, Guid? DepartureId = null, Guid? GuestId = null,
    string? From = null, string? To = null, bool BalanceOnly = false,
    int Page = 1, int PageSize = 30, bool CanSeeCosts = false, string? Today = null) : IQuery<PagedResult<TourBookingDto>>;

public sealed record GetTourBookingByIdQuery(Guid Id, bool CanSeeCosts, string? Today = null) : IQuery<TourBookingDetailDto>;

public sealed record GetTourDashboardQuery(bool CanSeeCosts, string? Today = null) : IQuery<TourDashboardDto>;

// ── Packages ─────────────────────────────────────────────────────────────────

public sealed record ItineraryDayInput(string Title, string? Description, string? Accommodation, string? Meals);

public sealed record UpsertTourPackageCommand(
    Guid? Id, string Code, string Name, string? Destination, string? Category, int DurationDays,
    string? Description, string? Inclusions, string? Exclusions,
    decimal PricePerAdult, decimal PricePerChild, decimal SingleSupplement, bool IsActive,
    IReadOnlyList<ItineraryDayInput>? Days) : ICommand<TourPackageDto>;

public sealed class UpsertTourPackageValidator : AbstractValidator<UpsertTourPackageCommand>
{
    public UpsertTourPackageValidator()
    {
        RuleFor(x => x.Code).NotEmpty().WithMessage("Code is required.").MaximumLength(20);
        RuleFor(x => x.Name).NotEmpty().WithMessage("Name is required.").MaximumLength(200);
        RuleFor(x => x.DurationDays).InclusiveBetween(1, 365).WithMessage("Duration must be 1 to 365 days.");
        RuleFor(x => x.PricePerAdult).GreaterThanOrEqualTo(0);
        RuleFor(x => x.PricePerChild).GreaterThanOrEqualTo(0);
        RuleFor(x => x.SingleSupplement).GreaterThanOrEqualTo(0);
        RuleForEach(x => x.Days).ChildRules(d => d.RuleFor(y => y.Title).NotEmpty().WithMessage("Each itinerary day needs a title.").MaximumLength(200));
        RuleFor(x => x.Days).Must(d => d is null || d.Count <= 120).WithMessage("An itinerary can have at most 120 days.");
    }
}

public sealed record DeleteTourPackageCommand(Guid Id) : ICommand;

// ── Departures ───────────────────────────────────────────────────────────────

public sealed record UpsertTourDepartureCommand(
    Guid? Id, Guid PackageId, string StartDate, string? EndDate, int Capacity,
    decimal? AdultPrice, decimal? ChildPrice, string? Notes) : ICommand<TourDepartureDto>;

public sealed class UpsertTourDepartureValidator : AbstractValidator<UpsertTourDepartureCommand>
{
    public UpsertTourDepartureValidator()
    {
        RuleFor(x => x.StartDate).Must(TourDates.IsDate).WithMessage("Start date must be yyyy-MM-dd.");
        RuleFor(x => x.EndDate).Must(e => string.IsNullOrWhiteSpace(e) || TourDates.IsDate(e)).WithMessage("End date must be yyyy-MM-dd.");
        RuleFor(x => x).Must(x => string.IsNullOrWhiteSpace(x.EndDate) || string.CompareOrdinal(x.EndDate, x.StartDate) >= 0)
            .WithMessage("The trip cannot end before it starts.");
        RuleFor(x => x.Capacity).InclusiveBetween(1, 5000).WithMessage("Seats must be between 1 and 5,000.");
    }
}

public sealed record SetTourDepartureStatusCommand(Guid Id, string Status) : ICommand<TourDepartureDto>;
public sealed record DeleteTourDepartureCommand(Guid Id) : ICommand;

// ── Bookings ─────────────────────────────────────────────────────────────────

public sealed record TravellerInput(string FullName, string Type, string? Gender, string? DateOfBirth,
    string? Nationality, string? PassportNumber, string? PassportExpiry, string? Notes);

public sealed record CreateTourBookingCommand(
    Guid? DepartureId, Guid? PackageId, string? Title, string? StartDate, string? EndDate,
    Guid? GuestId, string CustomerName, string? CustomerEmail, string? CustomerPhone,
    int Adults, int Children, int SingleRooms,
    decimal? AdultPrice, decimal? ChildPrice, decimal? SingleSupplement,
    decimal Discount, decimal TaxPercent, string? Source, string? Notes, bool Confirm,
    IReadOnlyList<TravellerInput>? Travellers, string? CreatedByName = null) : ICommand<TourBookingDto>;

public sealed class CreateTourBookingValidator : AbstractValidator<CreateTourBookingCommand>
{
    public CreateTourBookingValidator()
    {
        RuleFor(x => x.CustomerName).NotEmpty().WithMessage("Customer name is required.").MaximumLength(200);
        RuleFor(x => x.CustomerEmail).EmailAddress().When(x => !string.IsNullOrWhiteSpace(x.CustomerEmail))
            .WithMessage("That email address does not look right.");
        RuleFor(x => x.Adults).InclusiveBetween(1, 500).WithMessage("At least one adult is required.");
        RuleFor(x => x.Children).InclusiveBetween(0, 500);
        RuleFor(x => x.SingleRooms).GreaterThanOrEqualTo(0);
        RuleFor(x => x.Discount).GreaterThanOrEqualTo(0);
        RuleFor(x => x.TaxPercent).InclusiveBetween(0, 100);
        RuleFor(x => x).Must(x => x.DepartureId is not null || (TourDates.IsDate(x.StartDate) && TourDates.IsDate(x.EndDate)))
            .WithMessage("Pick a departure, or enter the trip's start and end dates.");
        RuleFor(x => x).Must(x => x.DepartureId is not null || string.IsNullOrWhiteSpace(x.StartDate) || string.IsNullOrWhiteSpace(x.EndDate)
                                  || string.CompareOrdinal(x.EndDate, x.StartDate) >= 0)
            .WithMessage("The trip cannot end before it starts.");
        RuleFor(x => x).Must(x => x.DepartureId is not null || x.PackageId is not null || !string.IsNullOrWhiteSpace(x.Title))
            .WithMessage("Give a tailor-made trip a title.");
        RuleForEach(x => x.Travellers).SetValidator(new TravellerValidator());
    }
}

public sealed class TravellerValidator : AbstractValidator<TravellerInput>
{
    public TravellerValidator()
    {
        RuleFor(x => x.FullName).NotEmpty().WithMessage("Each traveller needs a name.").MaximumLength(200);
        RuleFor(x => x.DateOfBirth).Must(d => string.IsNullOrWhiteSpace(d) || TourDates.IsDate(d)).WithMessage("Date of birth must be yyyy-MM-dd.");
        RuleFor(x => x.PassportExpiry).Must(d => string.IsNullOrWhiteSpace(d) || TourDates.IsDate(d)).WithMessage("Passport expiry must be yyyy-MM-dd.");
    }
}

public sealed record UpdateTourBookingCommand(
    Guid Id, string Title, string StartDate, string EndDate,
    string CustomerName, string? CustomerEmail, string? CustomerPhone,
    int Adults, int Children, int SingleRooms, decimal AdultPrice, decimal ChildPrice, decimal SingleSupplement,
    decimal Discount, decimal TaxPercent, string? Source, string? Notes) : ICommand<TourBookingDto>;

public sealed class UpdateTourBookingValidator : AbstractValidator<UpdateTourBookingCommand>
{
    public UpdateTourBookingValidator()
    {
        RuleFor(x => x.Title).NotEmpty().MaximumLength(200);
        RuleFor(x => x.CustomerName).NotEmpty().WithMessage("Customer name is required.").MaximumLength(200);
        RuleFor(x => x.StartDate).Must(TourDates.IsDate).WithMessage("Start date must be yyyy-MM-dd.");
        RuleFor(x => x.EndDate).Must(TourDates.IsDate).WithMessage("End date must be yyyy-MM-dd.");
        RuleFor(x => x).Must(x => string.CompareOrdinal(x.EndDate, x.StartDate) >= 0).WithMessage("The trip cannot end before it starts.");
        RuleFor(x => x.Adults).InclusiveBetween(1, 500).WithMessage("At least one adult is required.");
        RuleFor(x => x.Children).InclusiveBetween(0, 500);
        RuleFor(x => x.AdultPrice).GreaterThanOrEqualTo(0);
        RuleFor(x => x.ChildPrice).GreaterThanOrEqualTo(0);
        RuleFor(x => x.Discount).GreaterThanOrEqualTo(0);
        RuleFor(x => x.TaxPercent).InclusiveBetween(0, 100);
    }
}

/// <summary>Action: confirm | complete | reopen | cancel. Cancel needs a reason.</summary>
public sealed record SetTourBookingStatusCommand(Guid Id, string Action, string? Reason) : ICommand<TourBookingDto>;
public sealed record DeleteTourBookingCommand(Guid Id) : ICommand;

public sealed record SaveTourTravellersCommand(Guid BookingId, IReadOnlyList<TravellerInput> Travellers) : ICommand;

public sealed class SaveTourTravellersValidator : AbstractValidator<SaveTourTravellersCommand>
{
    public SaveTourTravellersValidator()
    {
        RuleFor(x => x.Travellers).Must(t => t.Count <= 500).WithMessage("At most 500 travellers on one booking.");
        RuleForEach(x => x.Travellers).SetValidator(new TravellerValidator());
    }
}

public sealed record UpsertTourServiceCommand(
    Guid BookingId, Guid? Id, string Type, string SupplierName, string Description,
    string? ServiceDate, string? EndDate, string? ConfirmationNumber,
    decimal Cost, decimal SupplierPaid, bool IsExtra, decimal SellPrice, string Status, string? Notes,
    IReadOnlyDictionary<string, string>? Details = null) : ICommand<TourServiceDto>;

public sealed class UpsertTourServiceValidator : AbstractValidator<UpsertTourServiceCommand>
{
    public UpsertTourServiceValidator()
    {
        RuleFor(x => x.SupplierName).NotEmpty().WithMessage("Supplier is required.").MaximumLength(200);
        RuleFor(x => x.Description).NotEmpty().WithMessage("Say what was booked.").MaximumLength(500);
        RuleFor(x => x.ServiceDate).Must(d => string.IsNullOrWhiteSpace(d) || TourDates.IsDate(d)).WithMessage("Date must be yyyy-MM-dd.");
        RuleFor(x => x.EndDate).Must(d => string.IsNullOrWhiteSpace(d) || TourDates.IsDate(d)).WithMessage("End date must be yyyy-MM-dd.");
        RuleFor(x => x.Cost).GreaterThanOrEqualTo(0);
        RuleFor(x => x.SupplierPaid).GreaterThanOrEqualTo(0);
        RuleFor(x => x).Must(x => x.SupplierPaid <= x.Cost).WithMessage("Paid to the supplier cannot be more than the cost.");
        RuleFor(x => x.SellPrice).GreaterThanOrEqualTo(0);
    }
}

public sealed record DeleteTourServiceCommand(Guid BookingId, Guid Id) : ICommand;

public sealed record InstalmentInput(string Label, string DueDate, decimal Amount);

public sealed record SaveTourInstalmentsCommand(Guid BookingId, IReadOnlyList<InstalmentInput> Instalments) : ICommand;

public sealed class SaveTourInstalmentsValidator : AbstractValidator<SaveTourInstalmentsCommand>
{
    public SaveTourInstalmentsValidator()
    {
        RuleFor(x => x.Instalments).Must(i => i.Count <= 24).WithMessage("At most 24 instalments.");
        RuleForEach(x => x.Instalments).ChildRules(i =>
        {
            i.RuleFor(y => y.Label).NotEmpty().WithMessage("Each instalment needs a label.").MaximumLength(100);
            i.RuleFor(y => y.DueDate).Must(TourDates.IsDate).WithMessage("Due date must be yyyy-MM-dd.");
            i.RuleFor(y => y.Amount).GreaterThan(0).WithMessage("Each instalment needs an amount.");
        });
    }
}

public sealed record AddTourPaymentCommand(Guid BookingId, decimal Amount, string Method, string? Reference,
    string? PaidOn, string? ReceivedBy = null) : ICommand<TourPaymentDto>;

public sealed class AddTourPaymentValidator : AbstractValidator<AddTourPaymentCommand>
{
    public AddTourPaymentValidator()
    {
        RuleFor(x => x.Amount).GreaterThan(0).WithMessage("Enter the amount received.");
        RuleFor(x => x.Method).NotEmpty().MaximumLength(30);
        RuleFor(x => x.PaidOn).Must(d => string.IsNullOrWhiteSpace(d) || TourDates.IsDate(d)).WithMessage("Date must be yyyy-MM-dd.");
    }
}

public sealed record VoidTourPaymentCommand(Guid BookingId, Guid PaymentId, string Reason) : ICommand;

public static class TourDates
{
    public static bool IsDate(string? s) => DateOnly.TryParseExact(s, "yyyy-MM-dd", out _);
}
