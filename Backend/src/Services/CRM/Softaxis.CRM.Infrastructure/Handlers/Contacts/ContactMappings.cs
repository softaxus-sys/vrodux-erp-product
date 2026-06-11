using Softaxis.CRM.Application.Contacts.Dtos;
using Softaxis.CRM.Domain.Entities;

namespace Softaxis.CRM.Infrastructure.Handlers.Contacts;

internal static class ContactMappings
{
    public static ContactDto ToDto(Contact c) => new(
        c.Id, c.CustomerId, c.FirstName, c.LastName, c.FullName, c.Title,
        c.Email, c.Phone, c.Department, c.IsPrimary, c.Notes, c.CreatedAt, c.UpdatedAt);
}
