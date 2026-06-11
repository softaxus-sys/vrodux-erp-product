using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Education.Dtos;
using Softaxis.CRM.Application.Education.Queries;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Education;

internal sealed class GetEnrollmentsHandler(CrmDbContext db) : IQueryHandler<GetEnrollmentsQuery, IReadOnlyList<EnrollmentDto>>
{
    public async Task<Result<IReadOnlyList<EnrollmentDto>>> Handle(GetEnrollmentsQuery query, CancellationToken ct)
    {
        var q = db.Enrollments.AsNoTracking().AsQueryable();
        if (query.StudentId.HasValue) q = q.Where(x => x.StudentId == query.StudentId.Value);

        var items = await q.OrderByDescending(x => x.CreatedAt).ToListAsync(ct);
        return Result.Success<IReadOnlyList<EnrollmentDto>>(items.Select(EducationMappings.ToDto).ToList());
    }
}
