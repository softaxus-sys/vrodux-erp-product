using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Contacts.Commands;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Contacts;

internal sealed class DeleteContactHandler(CrmDbContext db) : ICommandHandler<DeleteContactCommand>
{
    public async Task<Result> Handle(DeleteContactCommand cmd, CancellationToken ct)
    {
        var c = await db.Contacts.FindAsync([cmd.Id], ct);
        if (c is null)
            return Result.Failure(Error.NotFoundById("Contact", cmd.Id));

        c.Delete();
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
