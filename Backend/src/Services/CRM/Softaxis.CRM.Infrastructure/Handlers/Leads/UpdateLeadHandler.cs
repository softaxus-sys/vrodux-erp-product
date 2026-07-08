using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Abstractions;
using Softaxis.CRM.Application.Leads.Commands;
using Softaxis.CRM.Domain.Entities;
using Softaxis.CRM.Infrastructure.Persistence;
using Softaxis.CRM.Infrastructure.Services;

namespace Softaxis.CRM.Infrastructure.Handlers.Leads;

internal sealed class UpdateLeadHandler(CrmDbContext db, ILeadAccessGuard access, ICurrentUser currentUser) : ICommandHandler<UpdateLeadCommand>
{
    public async Task<Result> Handle(UpdateLeadCommand cmd, CancellationToken ct)
    {
        var l = await db.Leads.FindAsync([cmd.Id], ct);
        // Not found, or not editable by this user (assigned-only user editing someone else's lead).
        if (l is null || !access.CanEdit(l))
            return Result.Failure(Error.NotFoundById("Lead", cmd.Id));

        var prevUserId = l.AssignedToUserId;
        var prevName   = l.AssignedTo;

        l.Update(cmd.FirstName, cmd.LastName, cmd.Title, cmd.Company, cmd.Industry,
            cmd.Email, cmd.Phone, cmd.Country, cmd.City, cmd.Source, cmd.Priority,
            cmd.EstimatedValue, cmd.AssignedTo, cmd.Score, cmd.NextFollowUp, cmd.Notes, cmd.Tags,
            cmd.WhatsApp, cmd.InterestedIn, cmd.Budget, cmd.Message, cmd.AssignedToUserId, cmd.PurchaseTimeframe);

        // Value & score are computed, not free-form — derive value from budget when unset, then
        // recompute the score from the edited signals + engagement.
        l.DeriveEstimatedValueFromBudget();
        var activityCount = await db.Activities
            .CountAsync(a => !a.IsDeleted && a.RelatedToType == "lead" && a.RelatedToId == l.Id, ct);
        l.RecalculateScore(activityCount);

        // If the owner changed as part of this edit, record it in the handoff history.
        if (cmd.AssignedToUserId != prevUserId && cmd.AssignedToUserId is { } toId)
            db.LeadAssignments.Add(new LeadAssignment(l.Id, prevUserId, prevName, toId, cmd.AssignedTo,
                currentUser.Id, currentUser.Username, "Reassigned via edit"));

        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
