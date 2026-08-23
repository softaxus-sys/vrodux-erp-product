using System.Text.Json;
using Softaxis.BuildingBlocks.Application.AiEvents;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Abstractions;
using Softaxis.CRM.Application.Leads.Commands;
using Softaxis.CRM.Application.Leads.Dtos;
using Softaxis.CRM.Domain.Entities;
using Softaxis.CRM.Infrastructure.Persistence;
using Softaxis.CRM.Infrastructure.Services;

namespace Softaxis.CRM.Infrastructure.Handlers.Leads;

internal sealed class CreateLeadHandler(CrmDbContext db, IAiEventBus aiEvents, ICurrentUser currentUser, ILeadAccessGuard access) : ICommandHandler<CreateLeadCommand, LeadDto>
{
    public async Task<Result<LeadDto>> Handle(CreateLeadCommand cmd, CancellationToken ct)
    {
        var l = new Lead(cmd.FirstName, cmd.LastName, cmd.Title, cmd.Company, cmd.Industry,
            cmd.Email, cmd.Phone, cmd.Country, cmd.City, cmd.Source, cmd.Priority,
            cmd.EstimatedValue, cmd.AssignedTo, cmd.Notes,
            cmd.WhatsApp, cmd.InterestedIn, cmd.Budget, cmd.Message, cmd.AssignedToUserId, cmd.PurchaseTimeframe);

        // Owner + team. Two things happen here:
        //
        //  1. If no owner was chosen, the CREATOR becomes the owner. Without this a rep who adds a
        //     lead ends up with an unowned record — and an unowned record is visible only to the
        //     full-access tier, so they immediately lose the lead they just typed in.
        //  2. If no team was chosen, file it to the creator's team when that is unambiguous (they
        //     belong to exactly one). Someone in several teams is left unfiled rather than guessed at.
        //
        // An explicit choice from the form always wins over both defaults.
        var ownerId = cmd.AssignedToUserId ?? currentUser.Id;
        var ownerName = cmd.AssignedToUserId is not null
            ? cmd.AssignedTo
            : (string.IsNullOrWhiteSpace(cmd.AssignedTo) ? currentUser.Username ?? "" : cmd.AssignedTo);

        if (ownerId is not null)
        {
            var teamId = cmd.TeamId ?? await access.SoleTeamOfCurrentUserAsync(ct);
            l.AssignTo(ownerId, ownerName, teamId);
        }

        // Derive value from the budget when none was entered, detect an urgency tag from the message
        // when no explicit timeframe was given, then score (no activity yet → 0).
        l.DeriveEstimatedValueFromBudget();
        l.DetectTimeframeFromText();
        l.RecalculateScore(0);

        db.Leads.Add(l);

        // Seed the handoff history with the initial assignment when an owner is set.
        if (cmd.AssignedToUserId is { } toId)
            db.LeadAssignments.Add(new LeadAssignment(l.Id, null, null, toId, cmd.AssignedTo,
                currentUser.Id, currentUser.Username, "Initial assignment"));

        await db.SaveChangesAsync(ct);

        // Fire an AI event so event-triggered automations can react (best-effort, never throws).
        var title = $"{l.FirstName} {l.LastName}".Trim();
        if (!string.IsNullOrWhiteSpace(l.Company)) title = string.IsNullOrWhiteSpace(title) ? l.Company : $"{title} — {l.Company}";
        await aiEvents.PublishAsync(new AiTriggerEvent(
            AiEventKeys.CrmLeadCreated, l.Id, $"New lead: {title}",
            JsonSerializer.Serialize(new { l.Id, l.FirstName, l.LastName, l.Company, l.Email, l.Phone, l.Source })), ct);

        return Result.Success(LeadMappings.ToDto(l));
    }
}
