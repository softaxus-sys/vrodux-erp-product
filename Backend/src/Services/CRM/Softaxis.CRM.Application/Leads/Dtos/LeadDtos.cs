namespace Softaxis.CRM.Application.Leads.Dtos;

public sealed record LeadDto(
    Guid Id, string FirstName, string LastName, string FullName, string Title, string Company,
    string Industry, string Email, string Phone, string Country, string City, string Source,
    string Status, string Priority, int Score, decimal EstimatedValue, string Currency,
    string AssignedTo, string CreatedDate, string? LastContactDate, string? NextFollowUp,
    string? Notes, string? ConvertedDealId, IReadOnlyList<string> Tags, IReadOnlyList<object> Activities,
    DateTime CreatedAt, DateTime? UpdatedAt);

public sealed record LeadsSummaryDto(
    int Total, int NewThisWeek, int Qualified, int Contacted, int Converted,
    double ConversionRate, decimal TotalEstimatedValue);

public sealed record ConvertLeadResultDto(Guid CustomerId, Guid DealId);
