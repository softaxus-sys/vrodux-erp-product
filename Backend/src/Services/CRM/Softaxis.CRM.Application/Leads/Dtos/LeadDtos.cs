namespace Softaxis.CRM.Application.Leads.Dtos;

public sealed record LeadDto(
    Guid Id, string FirstName, string LastName, string FullName, string Title, string Company,
    string Industry, string Email, string Phone, string Country, string City, string Source,
    string Status, string Priority, int Score, decimal EstimatedValue, string Currency,
    string AssignedTo, string CreatedDate, string? LastContactDate, string? NextFollowUp,
    string? Notes, string? ConvertedDealId, IReadOnlyList<string> Tags, IReadOnlyList<object> Activities,
    DateTime CreatedAt, DateTime? UpdatedAt, Guid? ConvertedCustomerId = null,
    // Requirements (lead-gen form / manual entry)
    string? WhatsApp = null, string? InterestedIn = null, string? Budget = null, string? Message = null,
    // Marketing / attribution
    string? Platform = null, string? FormName = null, bool? IsOrganic = null, string? Campaign = null,
    string? AdName = null, string? AdSetName = null, string? PlatformCreatedTime = null,
    IReadOnlyDictionary<string, string>? CustomFields = null,
    // Identity user id of the current owner (drives "my assigned leads" scoping on the client).
    Guid? AssignedToUserId = null,
    // Purchase intent: raw "when planning to buy" text + its classified urgency bucket key.
    string? PurchaseTimeframe = null, string? PurchaseUrgency = null);

public sealed record LeadsSummaryDto(
    int Total, int NewThisWeek, int Qualified, int Contacted, int Converted,
    double ConversionRate, decimal TotalEstimatedValue);

public sealed record ConvertLeadResultDto(Guid CustomerId, Guid DealId);

/// <summary>One handoff in a lead's assignment history (newest first when listed).</summary>
public sealed record LeadAssignmentDto(
    Guid Id, Guid? FromUserId, string? FromUserName, Guid? ToUserId, string ToUserName,
    Guid? AssignedByUserId, string? AssignedByName, string? Note, DateTime CreatedAt);
