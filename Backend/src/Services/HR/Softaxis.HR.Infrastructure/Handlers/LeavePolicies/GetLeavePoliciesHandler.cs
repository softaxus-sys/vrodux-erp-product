using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.LeavePolicies.Dtos;
using Softaxis.HR.Application.LeavePolicies.Queries;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.LeavePolicies;

internal sealed class GetLeavePoliciesHandler(HrDbContext db)
    : IQueryHandler<GetLeavePoliciesQuery, IReadOnlyList<LeavePolicyDto>>
{
    public async Task<Result<IReadOnlyList<LeavePolicyDto>>> Handle(
        GetLeavePoliciesQuery query, CancellationToken ct)
    {
        var policies = await LeavePolicySeeder.EnsureSeededAsync(db, ct);

        var items = policies
            .OrderByDescending(x => x.AnnualEntitlementDays)
            .ThenBy(x => x.LeaveType)
            .Select(x => new LeavePolicyDto(
                x.Id, x.LeaveType, x.AnnualEntitlementDays, x.IsPaid, x.Description, x.IsActive))
            .ToList();

        return Result.Success<IReadOnlyList<LeavePolicyDto>>(items);
    }
}

internal static class LeavePolicySeeder
{
    /// <summary>
    /// Seeds the tenant's default policies on first read. Tenant-scoped because it runs in a
    /// request (the ambient tenant is resolved), so the rows get stamped on save.
    /// </summary>
    public static async Task<List<Domain.Entities.LeavePolicy>> EnsureSeededAsync(
        HrDbContext db, CancellationToken ct)
    {
        var existing = await db.LeavePolicies.Where(x => !x.IsDeleted).ToListAsync(ct);
        if (existing.Count > 0) return existing;

        var defaults = LeavePolicyDefaults.Build().ToList();
        db.LeavePolicies.AddRange(defaults);
        await db.SaveChangesAsync(ct);
        return defaults;
    }
}
