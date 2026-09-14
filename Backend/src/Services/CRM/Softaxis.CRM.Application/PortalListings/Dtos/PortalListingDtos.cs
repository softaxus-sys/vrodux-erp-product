namespace Softaxis.CRM.Application.PortalListings.Dtos;

public sealed record PortalListingDto(
    Guid Id,
    string Portal,
    string? Reference,
    string? ListingId,
    string? Url,
    string? Title,
    Guid AgentUserId,
    string AgentName,
    Guid? TeamId,
    bool IsActive,
    int EnquiryCount,
    DateTime? LastEnquiryAt,
    DateTime CreatedAt);
