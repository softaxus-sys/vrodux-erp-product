using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Leads.Commands;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Leads;

internal sealed class UpdateLeadHandler(CrmDbContext db) : ICommandHandler<UpdateLeadCommand>
{
    public async Task<Result> Handle(UpdateLeadCommand cmd, CancellationToken ct)
    {
        var l = await db.Leads.FindAsync([cmd.Id], ct);
        if (l is null)
            return Result.Failure(Error.NotFoundById("Lead", cmd.Id));

        l.Update(cmd.FirstName, cmd.LastName, cmd.Title, cmd.Company, cmd.Industry,
            cmd.Email, cmd.Phone, cmd.Country, cmd.City, cmd.Source, cmd.Priority,
            cmd.EstimatedValue, cmd.AssignedTo, cmd.Score, cmd.NextFollowUp, cmd.Notes, cmd.Tags,
            cmd.WhatsApp, cmd.InterestedIn, cmd.Budget, cmd.Message);

        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
