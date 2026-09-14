using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Integrations.Dtos;
using Softaxis.CRM.Application.Integrations.Queries;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Integrations;

/// <summary>One delivery with its raw payload — what the provider actually sent, unedited.</summary>
internal sealed class GetLeadInboxEntryHandler(CrmDbContext db)
    : IQueryHandler<GetLeadInboxEntryQuery, LeadInboxEntryDto>
{
    public async Task<Result<LeadInboxEntryDto>> Handle(GetLeadInboxEntryQuery query, CancellationToken ct)
    {
        var row = await db.RawLeadInbox.AsNoTracking().FirstOrDefaultAsync(x => x.Id == query.Id, ct);
        if (row is null) return Result.Failure<LeadInboxEntryDto>(Error.NotFoundById("LeadInbox", query.Id));

        var (integrations, leads) = await LeadInboxEnrichment.LookupAsync(db, [row], ct);
        var leadName = row.CreatedLeadId is { } lid && leads.TryGetValue(lid, out var ln) && ln.Length > 0 ? ln : null;

        return Result.Success(new LeadInboxEntryDto(
            row.Id, row.IntegrationId, row.ProviderKey,
            integrations.TryGetValue(row.IntegrationId, out var n) ? n : row.ProviderKey,
            row.ExternalId, row.Status, row.Attempts, row.LastError,
            row.CreatedLeadId, leadName,
            row.ReceivedAt, row.ProcessedAt, row.NextAttemptAt,
            row.Payload));
    }
}
