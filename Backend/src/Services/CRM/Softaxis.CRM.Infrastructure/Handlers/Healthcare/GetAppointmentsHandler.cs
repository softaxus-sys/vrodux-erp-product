using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Healthcare.Dtos;
using Softaxis.CRM.Application.Healthcare.Queries;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Healthcare;

internal sealed class GetAppointmentsHandler(CrmDbContext db) : IQueryHandler<GetAppointmentsQuery, IReadOnlyList<AppointmentDto>>
{
    public async Task<Result<IReadOnlyList<AppointmentDto>>> Handle(GetAppointmentsQuery query, CancellationToken ct)
    {
        var q = db.Appointments.AsNoTracking().AsQueryable();
        if (query.PatientId.HasValue) q = q.Where(x => x.PatientId == query.PatientId.Value);

        var items = await q.OrderByDescending(x => x.CreatedAt).ToListAsync(ct);
        return Result.Success<IReadOnlyList<AppointmentDto>>(items.Select(HealthcareMappings.ToDto).ToList());
    }
}
