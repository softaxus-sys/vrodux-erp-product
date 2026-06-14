using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.ProjectManagement.Application.Labels.Commands;
using Softaxis.ProjectManagement.Application.Labels.Dtos;
using Softaxis.ProjectManagement.Domain.Entities;
using Softaxis.ProjectManagement.Infrastructure.Persistence;

namespace Softaxis.ProjectManagement.Infrastructure.Handlers.Labels;

internal sealed class CreateLabelHandler(ProjectManagementDbContext db)
    : ICommandHandler<CreateLabelCommand, LabelDto>
{
    public async Task<Result<LabelDto>> Handle(CreateLabelCommand cmd, CancellationToken ct)
    {
        var projectExists = await db.Projects.AnyAsync(x => x.Id == cmd.ProjectId, ct);
        if (!projectExists)
            return Result.Failure<LabelDto>(Error.NotFoundById(nameof(Project), cmd.ProjectId));

        var entity = new Label(cmd.ProjectId, cmd.Name, cmd.Color);

        db.Labels.Add(entity);
        await db.SaveChangesAsync(ct);

        return Result.Success(ToDto(entity));
    }

    internal static LabelDto ToDto(Label l) => new(l.Id, l.ProjectId, l.Name, l.Color);
}
