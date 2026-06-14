namespace Softaxis.CRM.Application.Contacts.Dtos;

public sealed record ContactDto(
    Guid Id, Guid CustomerId, string FirstName, string LastName, string FullName, string Title,
    string Email, string Phone, string? Department, bool IsPrimary, string? Notes,
    DateTime CreatedAt, DateTime? UpdatedAt);
