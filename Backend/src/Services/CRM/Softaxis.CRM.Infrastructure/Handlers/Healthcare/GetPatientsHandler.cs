using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Healthcare.Dtos;
using Softaxis.CRM.Application.Healthcare.Queries;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Healthcare;

internal sealed class GetPatientsHandler(CrmDbContext db) : IQueryHandler<GetPatientsQuery, IReadOnlyList<PatientDto>>
{
    public async Task<Result<IReadOnlyList<PatientDto>>> Handle(GetPatientsQuery query, CancellationToken ct)
    {
        var items = await db.Patients.AsNoTracking().OrderByDescending(x => x.CreatedAt).ToListAsync(ct);
        return Result.Success<IReadOnlyList<PatientDto>>(items.Select(HealthcareMappings.ToDto).ToList());
    }
}
