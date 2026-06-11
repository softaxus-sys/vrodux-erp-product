using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.B2B.Commands;
using Softaxis.CRM.Application.B2B.Dtos;
using Softaxis.CRM.Domain.Entities;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.B2B;

internal sealed class CreateTicketHandler(CrmDbContext db) : ICommandHandler<CreateTicketCommand, SupportTicketDto>
{
    public async Task<Result<SupportTicketDto>> Handle(CreateTicketCommand cmd, CancellationToken ct)
    {
        var t = new SupportTicket(cmd.ContractId, cmd.CustomerId, cmd.ClientName, cmd.Subject, cmd.Priority ?? "medium", cmd.Description);
        db.SupportTickets.Add(t);
        await db.SaveChangesAsync(ct);

        return Result.Success(B2BMappings.ToDto(t));
    }
}
