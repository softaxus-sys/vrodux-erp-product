using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.VisaServices.Application.Channels;
using Softaxis.VisaServices.Application.Channels.Dtos;
using Softaxis.VisaServices.Application.Channels.Queries;
using Softaxis.VisaServices.Infrastructure.Persistence;

namespace Softaxis.VisaServices.Infrastructure.Handlers.Channels;

internal sealed class GetChannelsHandler(VisaDbContext db)
    : IQueryHandler<GetChannelsQuery, IReadOnlyList<ChannelDto>>
{
    public async Task<Result<IReadOnlyList<ChannelDto>>> Handle(GetChannelsQuery query, CancellationToken ct)
    {
        var accounts = await db.ChannelAccounts.AsNoTracking().ToListAsync(ct);
        var byChannel = accounts.ToDictionary(a => a.Channel, StringComparer.OrdinalIgnoreCase);

        var items = ChannelCatalogue.All.Select(c =>
        {
            byChannel.TryGetValue(c.Key, out var acct);
            var connected = acct is { Status: "connected" };
            return new ChannelDto(c.Key, c.Name, c.Description, c.RequiresCredentials, c.Status, c.SetupGuide,
                connected, acct?.EstablishmentCard, acct?.AccountRef,
                !string.IsNullOrEmpty(acct?.SecretProtected), connected ? acct?.CreatedAt : null);
        }).ToList();

        return Result.Success<IReadOnlyList<ChannelDto>>(items);
    }
}

internal sealed class GetCaseSubmissionsHandler(VisaDbContext db)
    : IQueryHandler<GetCaseSubmissionsQuery, IReadOnlyList<GovtSubmissionDto>>
{
    public async Task<Result<IReadOnlyList<GovtSubmissionDto>>> Handle(GetCaseSubmissionsQuery query, CancellationToken ct)
    {
        var items = await db.GovtSubmissions.AsNoTracking()
            .Where(s => s.VisaCaseId == query.CaseId)
            .OrderByDescending(s => s.SubmittedAt)
            .Select(s => new GovtSubmissionDto(s.Id, s.VisaCaseId, s.Channel, s.SubmissionType,
                s.ExternalReference, s.Status, s.Notes, s.SubmittedAt, s.UpdatedAt))
            .ToListAsync(ct);

        return Result.Success<IReadOnlyList<GovtSubmissionDto>>(items);
    }
}
