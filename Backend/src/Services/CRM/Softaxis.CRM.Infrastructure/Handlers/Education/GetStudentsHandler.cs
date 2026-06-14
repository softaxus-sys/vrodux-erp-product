using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Education.Dtos;
using Softaxis.CRM.Application.Education.Queries;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Education;

internal sealed class GetStudentsHandler(CrmDbContext db) : IQueryHandler<GetStudentsQuery, IReadOnlyList<StudentDto>>
{
    public async Task<Result<IReadOnlyList<StudentDto>>> Handle(GetStudentsQuery query, CancellationToken ct)
    {
        var items = await db.Students.AsNoTracking().OrderByDescending(x => x.CreatedAt).ToListAsync(ct);
        return Result.Success<IReadOnlyList<StudentDto>>(items.Select(EducationMappings.ToDto).ToList());
    }
}
