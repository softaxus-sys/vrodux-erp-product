using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Leads.Commands;
using Softaxis.CRM.Application.Leads.Dtos;
using Softaxis.CRM.Domain.Entities;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Leads;

internal sealed class CreateLeadHandler(CrmDbContext db) : ICommandHandler<CreateLeadCommand, LeadDto>
{
    public async Task<Result<LeadDto>> Handle(CreateLeadCommand cmd, CancellationToken ct)
    {
        var l = new Lead(cmd.FirstName, cmd.LastName, cmd.Title, cmd.Company, cmd.Industry,
            cmd.Email, cmd.Phone, cmd.Country, cmd.City, cmd.Source, cmd.Priority,
            cmd.EstimatedValue, cmd.AssignedTo, cmd.Notes);

        db.Leads.Add(l);
        await db.SaveChangesAsync(ct);

        return Result.Success(LeadMappings.ToDto(l));
    }
}
