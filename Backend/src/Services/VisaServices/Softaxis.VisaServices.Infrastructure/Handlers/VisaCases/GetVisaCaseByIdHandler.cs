using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.VisaServices.Application.VisaCases.Dtos;
using Softaxis.VisaServices.Application.VisaCases.Queries;
using Softaxis.VisaServices.Infrastructure.Persistence;

namespace Softaxis.VisaServices.Infrastructure.Handlers.VisaCases;

internal sealed class GetVisaCaseByIdHandler(VisaDbContext db)
    : IQueryHandler<GetVisaCaseByIdQuery, VisaCaseDetailDto>
{
    public async Task<Result<VisaCaseDetailDto>> Handle(GetVisaCaseByIdQuery query, CancellationToken ct)
    {
        var vcase = await db.VisaCases.AsNoTracking().FirstOrDefaultAsync(c => c.Id == query.Id && !c.IsDeleted, ct);
        if (vcase is null)
            return Result.Failure<VisaCaseDetailDto>(Error.NotFoundById("VisaCase", query.Id));

        var applicants = await db.Applicants.AsNoTracking()
            .Where(a => a.VisaCaseId == query.Id)
            .OrderByDescending(a => a.Relationship == "primary").ThenBy(a => a.CreatedAt)
            .ToListAsync(ct);
        var documents = await db.CaseDocuments.AsNoTracking()
            .Where(d => d.VisaCaseId == query.Id).OrderBy(d => d.CreatedAt).ToListAsync(ct);
        var timeline = await db.CaseStatusEvents.AsNoTracking()
            .Where(e => e.VisaCaseId == query.Id).OrderByDescending(e => e.CreatedAt).ToListAsync(ct);

        return Result.Success(VisaCaseMappings.ToDetailDto(vcase, applicants, documents, timeline));
    }
}
