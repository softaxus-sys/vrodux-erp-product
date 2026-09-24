using Microsoft.Extensions.Configuration;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Support.Application.Abstractions;
using Softaxis.Support.Application.Tickets.Commands;
using Softaxis.Support.Domain.Entities;
using Softaxis.Support.Infrastructure.Persistence;
using Softaxis.Support.Infrastructure.Services;

namespace Softaxis.Support.Infrastructure.Handlers.Tickets;

/// <summary>
/// Raises a ticket for the CALLER'S OWN tenant — every identity field is read from
/// <see cref="ICurrentUser"/>, never accepted from the request body, so nobody can raise a
/// ticket "as" another tenant or user. Available to any authenticated user (no permission gate
/// at the controller) — the same posture as changing your own password.
/// </summary>
internal sealed class CreateTicketHandler(
    SupportDbContext db, ICurrentUser currentUser, ISupportEmailService email, ISupportRealtimeNotifier realtime,
    IConfiguration configuration)
    : ICommandHandler<CreateTicketCommand, Application.Tickets.Dtos.TicketDetailDto>
{
    public async Task<Result<Application.Tickets.Dtos.TicketDetailDto>> Handle(CreateTicketCommand cmd, CancellationToken ct)
    {
        if (currentUser.Id is null || currentUser.TenantId is null)
            return Result.Failure<Application.Tickets.Dtos.TicketDetailDto>(
                Error.Custom("Support.NoTenant", "You must be signed in to a workspace to raise a ticket."));

        var ticket = new SupportTicket(
            currentUser.TenantId.Value, currentUser.TenantName ?? "Unknown workspace",
            currentUser.Id.Value, currentUser.Username ?? "Unknown user", currentUser.Email ?? "",
            cmd.Subject, cmd.Category, cmd.Priority);
        db.Tickets.Add(ticket);

        var firstMessage = new TicketMessage(ticket.Id, currentUser.Id.Value,
            currentUser.Username ?? "Unknown user", isFromAgent: false, cmd.Message);
        db.Messages.Add(firstMessage);

        var attachments = TicketAttachmentFactory.Build(
            ticket.Id, firstMessage.Id, cmd.Attachments, currentUser.Id.Value, currentUser.Username ?? "Unknown user");
        db.Attachments.AddRange(attachments);

        await db.SaveChangesAsync(ct);

        // Best-effort — a failed confirmation email must never fail ticket creation. The ticket
        // is already saved; the caller sees it either way.
        try
        {
            var (subject, html) = SupportEmailTemplates.TicketCreated(ticket);
            if (!string.IsNullOrWhiteSpace(ticket.RequestingUserEmail))
                await email.SendAsync(ticket.RequestingUserEmail, ticket.RequestingUserName, subject, html, ct);
        }
        catch { /* logged inside the email service; never blocks the response */ }

        // Operator-side alert — so a new ticket gets a prompt response instead of waiting for
        // someone to notice it in the queue. Same best-effort posture as the customer email above.
        try
        {
            var alertRecipients = SupportAlertRecipients.Get(configuration);
            if (alertRecipients.Count > 0)
            {
                var frontendUrl = (configuration["FrontendUrl"] ?? "http://localhost:5173").TrimEnd('/');
                var (subject, html) = SupportEmailTemplates.NewTicketAlert(ticket, $"{frontendUrl}/support/queue");
                foreach (var address in alertRecipients)
                    await email.SendAsync(address, "Vrodux Support", subject, html, ct);
            }
        }
        catch { /* logged inside the email service; never blocks the response */ }

        await realtime.NotifyQueueChangedAsync(ct);

        return Result.Success(TicketMappings.ToDetailDto(ticket, [firstMessage], [], attachments));
    }
}
