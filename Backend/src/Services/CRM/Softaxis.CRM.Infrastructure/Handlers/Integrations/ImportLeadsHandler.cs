using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.LeadIntake.Abstractions;
using Softaxis.CRM.Application.LeadIntake.Commands;
using Softaxis.CRM.Application.LeadIntake.Dtos;

namespace Softaxis.CRM.Infrastructure.Handlers.Integrations;

/// <summary>
/// Bulk import: runs every submitted row through the shared intake pipeline for the
/// authenticated tenant and returns a created/duplicate/failed tally. A bad row never aborts
/// the batch — it is counted as failed with its row index so the UI can surface it.
/// </summary>
internal sealed class ImportLeadsHandler(ILeadIntakeService intake, ILogger<ImportLeadsHandler> logger)
    : ICommandHandler<ImportLeadsCommand, ImportLeadsResult>
{
    public async Task<Result<ImportLeadsResult>> Handle(ImportLeadsCommand cmd, CancellationToken ct)
    {
        if (TenantAmbient.TenantId is not { } tenantId)
            return Result.Failure<ImportLeadsResult>(Error.Custom("Integration.NoTenant",
                "No tenant resolved for this request."));

        int created = 0, duplicates = 0, failed = 0;
        var errors = new List<ImportRowError>();

        for (var i = 0; i < cmd.Leads.Count; i++)
        {
            ct.ThrowIfCancellationRequested();
            var input = cmd.Leads[i];

            var lead = new CanonicalLead
            {
                FirstName = input.FirstName, LastName = input.LastName, FullName = input.FullName,
                Email = input.Email, Phone = input.Phone, Company = input.Company, Title = input.Title,
                Industry = input.Industry, Address = input.Address, City = input.City, Country = input.Country,
                Notes = input.Notes, Campaign = input.Campaign,
                WhatsApp = input.WhatsApp, InterestedIn = input.InterestedIn, Budget = input.Budget,
                Message = input.Message, FormName = input.FormName,
                UtmSource = string.IsNullOrWhiteSpace(input.Source) ? "import" : input.Source,
            };
            if (input.Fields is not null)
                foreach (var (k, v) in input.Fields) lead.RawFields[k] = v;

            try
            {
                var result = await intake.IngestAsync(lead, tenantId, integration: null, ct);
                switch (result.Outcome)
                {
                    case IntakeOutcome.Created:   created++; break;
                    case IntakeOutcome.Duplicate: duplicates++; break;
                    default:
                        failed++;
                        errors.Add(new ImportRowError(i, result.Message ?? "Rejected."));
                        break;
                }
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                failed++;
                errors.Add(new ImportRowError(i, "Could not import this row."));
                logger.LogWarning(ex, "Lead import: row {Row} failed for tenant {Tenant}.", i, tenantId);
            }
        }

        // Cap the returned error detail so a mostly-bad file doesn't return a huge payload.
        var trimmed = errors.Count > 100 ? errors.Take(100).ToList() : errors;
        logger.LogInformation("Lead import for tenant {Tenant}: {Created} created, {Dup} dup, {Failed} failed.",
            tenantId, created, duplicates, failed);
        return Result.Success(new ImportLeadsResult(created, duplicates, failed, trimmed));
    }
}
