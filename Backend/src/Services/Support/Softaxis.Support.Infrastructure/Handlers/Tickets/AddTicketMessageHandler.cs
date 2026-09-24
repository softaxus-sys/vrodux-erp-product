using Microsoft.Extensions.Configuration;
using Softaxis.Support.Application.Tickets;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Support.Application.Abstractions;
using Softaxis.Support.Application.Tickets.Commands;
using Softaxis.Support.Application.Tickets.Dtos;
using Softaxis.Support.Domain.Entities;
using Softaxis.Support.Infrastructure.Persistence;
using Softaxis.Support.Infrastructure.Services;

namespace Softaxis.Support.Infrastructure.Handlers.Tickets;

/// <summary>
/// Either side of the conversation can reply — <see cref="TicketAccess.CanReply"/> covers both.
/// Whether the new message renders as "from support" is decided here from who the caller
/// actually is (an operator-tenant agent), never trusted from the request.
/// </summary>
internal sealed class AddTicketMessageHandler(
    SupportDbContext db, ICurrentUser currentUser, ISupportAccessGuard guard, ISupportEmailService email,
    ISupportRealtimeNotifier realtime, IConfiguration configuration)
    : ICommandHandler<AddTicketMessageCommand, TicketMessageDto>
{
    public async Task<Result<TicketMessageDto>> Handle(AddTicketMessageCommand cmd, CancellationToken ct)
    {
        var ticket = await db.Tickets.FindAsync([cmd.TicketId], ct);
        if (ticket is null || !TicketAccess.CanReply(ticket, currentUser, guard))
            return Result.Failure<TicketMessageDto>(Error.NotFoundById("SupportTicket", cmd.TicketId));

        if (currentUser.Id is null)
            return Result.Failure<TicketMessageDto>(Error.Custom("Support.Unresolved", "Could not resolve the signed-in user."));

        var isFromAgent = TicketAccess.IsAgent(currentUser, guard);
        var message = new TicketMessage(ticket.Id, currentUser.Id.Value,
            currentUser.Username ?? "Unknown user", isFromAgent, cmd.Body);
        db.Messages.Add(message);

        var attachments = TicketAttachmentFactory.Build(
            ticket.Id, message.Id, cmd.Attachments, currentUser.Id.Value, currentUser.Username ?? "Unknown user");
        db.Attachments.AddRange(attachments);

        ticket.Touch();
        await db.SaveChangesAsync(ct);

        if (isFromAgent)
        {
            // Agent replied — email the customer.
            try
            {
                var (subject, html) = SupportEmailTemplates.NewReply(ticket, message, toCustomer: true);
                if (!string.IsNullOrWhiteSpace(ticket.RequestingUserEmail))
                    await email.SendAsync(ticket.RequestingUserEmail, ticket.RequestingUserName, subject, html, ct);
            }
            catch { /* logged inside the email service; never blocks the response */ }
        }
        else
        {
            // Customer replied — alert the operator team, same as a brand-new ticket. Previously
            // unbuilt: an agent had to notice the queue update on their own.
            try
            {
                var alertRecipients = SupportAlertRecipients.Get(configuration);
                if (alertRecipients.Count > 0)
                {
                    var (subject, html) = SupportEmailTemplates.NewReply(ticket, message, toCustomer: false);
                    foreach (var address in alertRecipients)
                        await email.SendAsync(address, "Vrodux Support", subject, html, ct);
                }
            }
            catch { /* logged inside the email service; never blocks the response */ }
        }

        await realtime.NotifyTicketUpdatedAsync(ticket.Id, ct);
        await realtime.NotifyQueueChangedAsync(ct);

        return Result.Success(TicketMappings.ToDto(message, attachments));
    }
}
