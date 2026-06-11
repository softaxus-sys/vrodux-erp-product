using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Education.Dtos;
using Softaxis.CRM.Application.Education.Queries;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Education;

internal sealed class GetAdmissionsHandler(CrmDbContext db) : IQueryHandler<GetAdmissionsQuery, IReadOnlyList<AdmissionDto>>
{
    public async Task<Result<IReadOnlyList<AdmissionDto>>> Handle(GetAdmissionsQuery query, CancellationToken ct)
    {
        var items = await db.Admissions.AsNoTracking().OrderByDescending(x => x.CreatedAt).ToListAsync(ct);
        return Result.Success<IReadOnlyList<AdmissionDto>>(items.Select(EducationMappings.ToDto).ToList());
    }
}
