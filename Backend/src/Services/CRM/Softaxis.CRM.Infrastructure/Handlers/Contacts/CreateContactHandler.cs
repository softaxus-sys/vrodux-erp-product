using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Contacts.Commands;
using Softaxis.CRM.Application.Contacts.Dtos;
using Softaxis.CRM.Domain.Entities;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Contacts;

internal sealed class CreateContactHandler(CrmDbContext db) : ICommandHandler<CreateContactCommand, ContactDto>
{
    public async Task<Result<ContactDto>> Handle(CreateContactCommand cmd, CancellationToken ct)
    {
        // If this contact is primary, demote any existing primary for the account.
        if (cmd.IsPrimary)
        {
            var others = await db.Contacts.Where(c => c.CustomerId == cmd.CustomerId && c.IsPrimary).ToListAsync(ct);
            foreach (var o in others) o.SetPrimary(false);
        }

        var c = new Contact(cmd.CustomerId, cmd.FirstName, cmd.LastName, cmd.Title,
            cmd.Email, cmd.Phone, cmd.Department, cmd.IsPrimary, cmd.Notes);

        db.Contacts.Add(c);
        await db.SaveChangesAsync(ct);

        return Result.Success(ContactMappings.ToDto(c));
    }
}
