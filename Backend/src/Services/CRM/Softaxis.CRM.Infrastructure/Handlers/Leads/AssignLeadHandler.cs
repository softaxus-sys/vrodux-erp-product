using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Application.Notifications;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Abstractions;
using Softaxis.CRM.Application.Leads.Commands;
using Softaxis.CRM.Domain.Entities;
using Softaxis.CRM.Infrastructure.Handlers.Notifications;
using Softaxis.CRM.Infrastructure.Persistence;
using Softaxis.CRM.Infrastructure.Services;

namespace Softaxis.CRM.Infrastructure.Handlers.Leads;

internal sealed class AssignLeadHandler(
    CrmDbContext db, ILeadAccessGuard access, ICurrentUser currentUser, ICrmAssignmentNotifier notifications)
    : ICommandHandler<AssignLeadCommand>
{
    public async Task<Result> Handle(AssignLeadCommand cmd, CancellationToken ct)
    {
        var l = await db.Leads.FindAsync([cmd.Id], ct);
        // Reassigning requires edit rights on the lead — full-edit users can assign any lead;
        // assigned-edit users can only hand on a lead they currently own.
        if (l is null || !await access.CanEditAsync(l, ct))
            return Result.Failure(Error.NotFoundById("Lead", cmd.Id));

        var prevUserId = l.AssignedToUserId;
        var prevName   = l.AssignedTo;

        l.AssignTo(cmd.ToUserId, cmd.ToUserName, cmd.TeamId);

        db.LeadAssignments.Add(new LeadAssignment(l.Id, prevUserId, prevName,
            cmd.ToUserId, cmd.ToUserName, currentUser.Id, currentUser.Username, cmd.Note));

        await db.SaveChangesAsync(ct);

        // After the save, so an alert can never describe a handover that failed to commit. The
        // publisher never throws, so the assignment stands regardless of what happens here.
        // Notifies the new owner AND the team leads above them — see ICrmAssignmentNotifier.
        await notifications.NotifyAssignmentAsync(new CrmAssignment(
            cmd.ToUserId, cmd.ToUserName, prevUserId, l.TeamId, currentUser.Id, currentUser.Username,
            NotificationEvents.LeadAssigned, NotificationEvents.LeadAssignedToMember,
            "Lead", l.FullName, $"/crm/leads?lead={l.Id}", "lead", l.Id), ct: ct);

        return Result.Success();
    }
}
