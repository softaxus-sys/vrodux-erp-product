using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.DealContacts.Commands;
using Softaxis.CRM.Application.DealContacts.Dtos;
using Softaxis.CRM.Domain.Entities;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.DealContacts;

internal sealed class AddDealContactHandler(CrmDbContext db)
    : ICommandHandler<AddDealContactCommand, DealContactDto>
{
    public async Task<Result<DealContactDto>> Handle(AddDealContactCommand cmd, CancellationToken ct)
    {
        var deal = await db.Deals.FindAsync([cmd.DealId], ct);
        if (deal is null)
            return Result.Failure<DealContactDto>(Error.NotFoundById("Deal", cmd.DealId));

        var contact = await db.Contacts.FindAsync([cmd.ContactId], ct);
        if (contact is null)
            return Result.Failure<DealContactDto>(Error.NotFoundById("Contact", cmd.ContactId));

        // A deal linked to an account may only reference contacts of that account.
        if (deal.CustomerId is Guid acct && contact.CustomerId != acct)
            return Result.Failure<DealContactDto>(Error.Custom(
                "DealContact.Conflict", "Contact belongs to a different account than this deal."));

        var exists = await db.DealContacts
            .AnyAsync(x => x.DealId == cmd.DealId && x.ContactId == cmd.ContactId, ct);
        if (exists)
            return Result.Failure<DealContactDto>(Error.Custom(
                "DealContact.Duplicate", "This contact is already linked to the deal."));

        var link = new DealContact(cmd.DealId, cmd.ContactId, cmd.Role);
        db.DealContacts.Add(link);
        await db.SaveChangesAsync(ct);

        return Result.Success(new DealContactDto(link.Id, contact.Id, contact.FullName,
            contact.Title, contact.Email, contact.Phone, contact.Department, contact.IsPrimary, link.Role));
    }
}
