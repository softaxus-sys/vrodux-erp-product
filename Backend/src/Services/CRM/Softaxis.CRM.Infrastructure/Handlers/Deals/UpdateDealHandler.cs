using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Deals.Commands;
using Softaxis.CRM.Infrastructure.Persistence;
using Softaxis.CRM.Infrastructure.Services;

namespace Softaxis.CRM.Infrastructure.Handlers.Deals;

internal sealed class UpdateDealHandler(CrmDbContext db, ILeadAccessGuard access, IDealStageRecorder stageRecorder) : ICommandHandler<UpdateDealCommand>
{
    public async Task<Result> Handle(UpdateDealCommand cmd, CancellationToken ct)
    {
        var d = await db.Deals.FindAsync([cmd.Id], ct);
        if (d is null)
            return Result.Failure(Error.NotFoundById("Deal", cmd.Id));

        // Restricted tiers may only act on opportunities they own (or their team owns).
        if (!await access.CanEditDealAsync(d, ct))
            return Result.Failure(Error.NotFoundById("Deal", cmd.Id));

        // When linked to an account, use its canonical name as the denormalized display company.
        var company = cmd.Company;
        if (cmd.CustomerId is Guid cid)
        {
            var acct = await db.Customers.FindAsync([cid], ct);
            if (acct is not null) company = acct.Name;
        }

        var previousStage = d.Stage;
        d.Update(cmd.Title, company, cmd.Value, cmd.Stage, cmd.Priority, cmd.Probability,
            cmd.ExpectedCloseDate, cmd.AssignedTo, cmd.Source, cmd.Industry, cmd.Description,
            cmd.NextAction, cmd.NextActionDate, cmd.Tags, cmd.ForecastCategory, cmd.CustomerId, cmd.AssignedToUserId);

        // Update() does not carry the team, so re-stamp owner + team together — an edit that changes
        // the owner must not leave the deal filed under the previous owner's team.
        d.AssignTo(cmd.AssignedToUserId, cmd.AssignedTo, cmd.TeamId);

        // The edit form can change stage too — record it so history is not blind to that path.
        await stageRecorder.RecordMoveAsync(d, previousStage, ct);
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
