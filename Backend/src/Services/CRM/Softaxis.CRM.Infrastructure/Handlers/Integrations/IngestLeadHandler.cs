using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.LeadIntake.Abstractions;
using Softaxis.CRM.Application.LeadIntake.Commands;
using Softaxis.CRM.Application.LeadIntake.Dtos;

namespace Softaxis.CRM.Infrastructure.Handlers.Integrations;

/// <summary>
/// Handles the internal endpoint: maps the flat input to a <see cref="CanonicalLead"/> and
/// runs it through the shared intake pipeline for the authenticated tenant.
/// </summary>
internal sealed class IngestLeadHandler(ILeadIntakeService intake)
    : ICommandHandler<IngestLeadCommand, IngestLeadResult>
{
    public async Task<Result<IngestLeadResult>> Handle(IngestLeadCommand cmd, CancellationToken ct)
    {
        if (TenantAmbient.TenantId is not { } tenantId)
            return Result.Failure<IngestLeadResult>(Error.Custom("Integration.NoTenant",
                "No tenant resolved for this request."));

        var input = cmd.Lead;
        var lead = new CanonicalLead
        {
            FirstName = input.FirstName, LastName = input.LastName, FullName = input.FullName,
            Email = input.Email, Phone = input.Phone, Company = input.Company, Title = input.Title,
            Industry = input.Industry, Address = input.Address, City = input.City, Country = input.Country,
            Notes = input.Notes, Campaign = input.Campaign, UtmSource = input.Source,
            WhatsApp = input.WhatsApp, InterestedIn = input.InterestedIn, Budget = input.Budget,
            Message = input.Message, FormName = input.FormName,
        };
        if (input.Fields is not null)
            foreach (var (k, v) in input.Fields) lead.RawFields[k] = v;

        var result = await intake.IngestAsync(lead, tenantId, integration: null, ct);
        return Result.Success(new IngestLeadResult(result.Outcome.ToString().ToLowerInvariant(), result.LeadId, result.Message));
    }
}
