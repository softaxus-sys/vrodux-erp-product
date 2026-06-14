using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.ProjectManagement.Application.Labels.Commands;
using Softaxis.ProjectManagement.Application.Labels.Dtos;
using Softaxis.ProjectManagement.Domain.Entities;
using Softaxis.ProjectManagement.Infrastructure.Persistence;

namespace Softaxis.ProjectManagement.Infrastructure.Handlers.Labels;

internal sealed class UpdateLabelHandler(ProjectManagementDbContext db)
    : ICommandHandler<UpdateLabelCommand, LabelDto>
{
    public async Task<Result<LabelDto>> Handle(UpdateLabelCommand cmd, CancellationToken ct)
    {
        var entity = await db.Labels.FindAsync([cmd.Id], ct);
        if (entity is null)
            return Result.Failure<LabelDto>(Error.NotFoundById(nameof(Label), cmd.Id));

        entity.Update(cmd.Name, cmd.Color);
        await db.SaveChangesAsync(ct);

        return Result.Success(CreateLabelHandler.ToDto(entity));
    }
}
