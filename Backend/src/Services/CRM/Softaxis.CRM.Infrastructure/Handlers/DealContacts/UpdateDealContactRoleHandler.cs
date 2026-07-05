using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.DealContacts.Commands;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.DealContacts;

internal sealed class UpdateDealContactRoleHandler(CrmDbContext db)
    : ICommandHandler<UpdateDealContactRoleCommand>
{
    public async Task<Result> Handle(UpdateDealContactRoleCommand cmd, CancellationToken ct)
    {
        var link = await db.DealContacts
            .FirstOrDefaultAsync(x => x.Id == cmd.Id && x.DealId == cmd.DealId, ct);
        if (link is null)
            return Result.Failure(Error.NotFoundById("DealContact", cmd.Id));

        link.SetRole(cmd.Role);
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
