namespace Softaxis.RealEstate.Application.Sales.Dtos;

public sealed record SiteVisitDto(
    Guid Id, string VisitNumber, Guid? LeadId, Guid? CustomerId, string CustomerName,
    Guid PropertyId, Guid? UnitId, string ScheduledAt, string Status, string? Feedback,
    string AssignedTo, string? Notes, DateTime CreatedAt);

public sealed record ReservationDto(
    Guid Id, string ReservationNumber, Guid? LeadId, Guid? DealId, Guid? CustomerId, string CustomerName,
    Guid PropertyId, Guid UnitId, string ReservationDate, string ExpiryDate, decimal TokenAmount,
    string Status, string? Notes, DateTime CreatedAt);

public sealed record BookingDto(
    Guid Id, string BookingNumber, Guid? DealId, Guid? CustomerId, string CustomerName,
    Guid PropertyId, Guid UnitId, string BookingDate, decimal SalePrice, decimal DownPayment,
    int InstallmentCount, decimal InstallmentAmount, decimal PaidAmount, decimal Balance,
    string Status, string? Broker, string? Notes, DateTime CreatedAt);

public sealed record SalesSummaryDto(
    int SiteVisits, int ActiveReservations, int Bookings,
    decimal BookedValue, decimal Collected, decimal Outstanding, int InHandover);
