using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Integrations.Dtos;
using Softaxis.CRM.Application.Integrations.Queries;
using Softaxis.CRM.Application.LeadIntake.Abstractions;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Integrations;

/// <summary>
/// Merges the code-owned provider catalog (every registered <see cref="ILeadProvider"/>)
/// with this tenant's live connections — one card per provider.
/// </summary>
internal sealed class GetProviderCatalogHandler(CrmDbContext db, ILeadProviderRegistry registry)
    : IQueryHandler<GetProviderCatalogQuery, IReadOnlyList<ProviderCatalogItemDto>>
{
    public async Task<Result<IReadOnlyList<ProviderCatalogItemDto>>> Handle(GetProviderCatalogQuery query, CancellationToken ct)
    {
        // Tenant filter is applied automatically (ambient tenant resolved on authed requests).
        var connections = await db.Integrations.AsNoTracking()
            .Where(x => !x.IsDeleted)
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => new { x.Id, x.ProviderKey, x.Status, x.Health, x.LastSyncAt })
            .ToListAsync(ct);

        var byProvider = connections
            .GroupBy(c => c.ProviderKey, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);

        var items = registry.All.Select(p =>
        {
            byProvider.TryGetValue(p.Key, out var conn);
            return new ProviderCatalogItemDto(
                p.Key, p.Descriptor.DisplayName, p.Descriptor.Category, p.Descriptor.Description,
                CapabilityNames(p.Descriptor.Capabilities), p.Descriptor.ComingSoon,
                Connected: conn is not null && conn.Status == Domain.Entities.Integrations.IntegrationStatus.Connected,
                IntegrationId: conn?.Id, Status: conn?.Status, Health: conn?.Health, LastSyncAt: conn?.LastSyncAt);
        }).ToList();

        return Result.Success<IReadOnlyList<ProviderCatalogItemDto>>(items);
    }

    private static IReadOnlyList<string> CapabilityNames(ProviderCapabilities caps) =>
        Enum.GetValues<ProviderCapabilities>()
            .Where(c => c != ProviderCapabilities.None && caps.HasFlag(c))
            .Select(c => char.ToLowerInvariant(c.ToString()[0]) + c.ToString()[1..])
            .ToList();
}
