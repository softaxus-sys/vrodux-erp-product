namespace Softaxis.CRM.Application.DealContacts.Dtos;

/// <summary>A contact linked to a deal, with its role on that deal.</summary>
public sealed record DealContactDto(
    Guid Id, Guid ContactId, string FullName, string Title, string Email, string Phone,
    string? Department, bool IsPrimary, string Role);
