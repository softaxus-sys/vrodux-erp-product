using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Contacts.Commands;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Contacts;

internal sealed class SetPrimaryContactHandler(CrmDbContext db) : ICommandHandler<SetPrimaryContactCommand>
{
    public async Task<Result> Handle(SetPrimaryContactCommand cmd, CancellationToken ct)
    {
        var c = await db.Contacts.FindAsync([cmd.Id], ct);
        if (c is null)
            return Result.Failure(Error.NotFoundById("Contact", cmd.Id));

        var others = await db.Contacts.Where(x => x.CustomerId == c.CustomerId && x.IsPrimary && x.Id != cmd.Id).ToListAsync(ct);
        foreach (var o in others) o.SetPrimary(false);

        c.SetPrimary(true);
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
