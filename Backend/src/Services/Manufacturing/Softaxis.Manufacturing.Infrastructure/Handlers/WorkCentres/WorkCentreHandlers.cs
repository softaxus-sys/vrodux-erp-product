using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Manufacturing.Application.WorkCentres;
using Softaxis.Manufacturing.Domain.Entities;
using Softaxis.Manufacturing.Infrastructure.Persistence;

namespace Softaxis.Manufacturing.Infrastructure.Handlers.WorkCentres;

internal static class WorkCentreMappings
{
    public static WorkCentreDto ToDto(WorkCentre w) =>
        new(w.Id, w.Name, w.Code, w.LabourRatePerHour, w.OverheadRatePerHour, w.IsActive, w.CapacityHoursPerDay);
}

internal sealed class GetWorkCentresHandler(ManufacturingDbContext db)
    : IQueryHandler<GetWorkCentresQuery, IReadOnlyList<WorkCentreDto>>
{
    public async Task<Result<IReadOnlyList<WorkCentreDto>>> Handle(GetWorkCentresQuery q, CancellationToken ct)
    {
        var query = db.WorkCentres.AsNoTracking().Where(w => !w.IsDeleted);
        if (q.ActiveOnly) query = query.Where(w => w.IsActive);

        var rows = await query.OrderBy(w => w.Name).ToListAsync(ct);
        return Result.Success<IReadOnlyList<WorkCentreDto>>(rows.Select(WorkCentreMappings.ToDto).ToList());
    }
}

internal sealed class CreateWorkCentreHandler(ManufacturingDbContext db)
    : ICommandHandler<CreateWorkCentreCommand, WorkCentreDto>
{
    public async Task<Result<WorkCentreDto>> Handle(CreateWorkCentreCommand cmd, CancellationToken ct)
    {
        var name = cmd.Name.Trim();
        if (await db.WorkCentres.AnyAsync(w => !w.IsDeleted && w.Name == name, ct))
            return Result.Failure<WorkCentreDto>(Error.Custom("WorkCentre.Duplicate",
                $"A work centre named \"{name}\" already exists."));

        var centre = new WorkCentre(name, cmd.Code, cmd.LabourRatePerHour, cmd.OverheadRatePerHour, cmd.CapacityHoursPerDay);
        db.WorkCentres.Add(centre);
        await db.SaveChangesAsync(ct);
        return Result.Success(WorkCentreMappings.ToDto(centre));
    }
}

internal sealed class UpdateWorkCentreHandler(ManufacturingDbContext db)
    : ICommandHandler<UpdateWorkCentreCommand, WorkCentreDto>
{
    public async Task<Result<WorkCentreDto>> Handle(UpdateWorkCentreCommand cmd, CancellationToken ct)
    {
        var centre = await db.WorkCentres.FirstOrDefaultAsync(w => w.Id == cmd.Id && !w.IsDeleted, ct);
        if (centre is null) return Result.Failure<WorkCentreDto>(Error.NotFoundById("WorkCentre", cmd.Id));

        var name = cmd.Name.Trim();
        if (await db.WorkCentres.AnyAsync(w => !w.IsDeleted && w.Id != cmd.Id && w.Name == name, ct))
            return Result.Failure<WorkCentreDto>(Error.Custom("WorkCentre.Duplicate",
                $"A work centre named \"{name}\" already exists."));

        // New rates apply to BOMs saved and orders planned from now on. Existing ones keep the
        // rates they were costed with.
        centre.Update(name, cmd.Code, cmd.LabourRatePerHour, cmd.OverheadRatePerHour, cmd.IsActive, cmd.CapacityHoursPerDay);
        await db.SaveChangesAsync(ct);
        return Result.Success(WorkCentreMappings.ToDto(centre));
    }
}

internal sealed class DeleteWorkCentreHandler(ManufacturingDbContext db) : ICommandHandler<DeleteWorkCentreCommand>
{
    public async Task<Result> Handle(DeleteWorkCentreCommand cmd, CancellationToken ct)
    {
        var centre = await db.WorkCentres.FirstOrDefaultAsync(w => w.Id == cmd.Id && !w.IsDeleted, ct);
        if (centre is null) return Result.Failure(Error.NotFoundById("WorkCentre", cmd.Id));

        var inUse = await (
            from op in db.BomOperations
            join bom in db.Boms on op.BomId equals bom.Id
            where op.WorkCentreId == cmd.Id && !bom.IsDeleted
            select bom.Id).Distinct().CountAsync(ct);
        if (inUse > 0)
            return Result.Failure(Error.Custom("WorkCentre.Conflict",
                $"{inUse} bill(s) of materials route through this work centre. Remove it from them first, or mark it inactive instead."));

        centre.Delete();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
