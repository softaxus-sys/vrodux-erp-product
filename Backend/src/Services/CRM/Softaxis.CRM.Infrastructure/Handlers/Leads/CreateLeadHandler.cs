using System.Text.Json;
using Softaxis.BuildingBlocks.Application.AiEvents;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Abstractions;
using Softaxis.CRM.Application.Leads.Commands;
using Softaxis.CRM.Application.Leads.Dtos;
using Softaxis.CRM.Domain.Entities;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Leads;

internal sealed class CreateLeadHandler(CrmDbContext db, IAiEventBus aiEvents, ICurrentUser currentUser) : ICommandHandler<CreateLeadCommand, LeadDto>
{
    public async Task<Result<LeadDto>> Handle(CreateLeadCommand cmd, CancellationToken ct)
    {
        var l = new Lead(cmd.FirstName, cmd.LastName, cmd.Title, cmd.Company, cmd.Industry,
            cmd.Email, cmd.Phone, cmd.Country, cmd.City, cmd.Source, cmd.Priority,
            cmd.EstimatedValue, cmd.AssignedTo, cmd.Notes,
            cmd.WhatsApp, cmd.InterestedIn, cmd.Budget, cmd.Message, cmd.AssignedToUserId, cmd.PurchaseTimeframe);

        // The ctor does not take a team, so stamp it here. Only meaningful with an owner — AssignTo
        // clears the team when the owner is null.
        if (cmd.AssignedToUserId is not null)
            l.AssignTo(cmd.AssignedToUserId, cmd.AssignedTo, cmd.TeamId);

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
